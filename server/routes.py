from flask import Blueprint, request, jsonify, g
from db import get_connection, row_to_dict
from auth import (
    hash_password, verify_password, validate_email, 
    validate_phone, validate_string, validate_password, 
    validate_integer, ValidationError, check_admin_auth, check_student_auth,
    generate_auth_token, verify_password_or_legacy, is_password_hash
)
from urllib.parse import urlparse

api_bp = Blueprint('api', __name__)
DEFAULT_BEDS_PER_ROOM = 4
MAX_BEDS_PER_ROOM = 5
BED_STATUSES = {'available', 'booked', 'occupied'}
ACTIVE_STUDENT_STATUSES = {'allocated', 'completed'}
FOOD_PREFERENCES = {'veg', 'non-veg', 'allergies', 'other', ''}
GOVERNMENT_ID_MAX_SIZE = 2 * 1024 * 1024
PAYMENT_STATUSES = {'pending', 'partial', 'paid'}
SAFE_IMAGE_PREFIXES = ('data:image/jpeg', 'data:image/jpg', 'data:image/png', 'data:image/gif', 'data:image/webp', 'data:image/bmp', 'data:image/avif')
SAFE_DOCUMENT_PREFIXES = SAFE_IMAGE_PREFIXES + ('data:application/pdf',)


@api_bp.before_request
def protect_admin_routes():
    if request.method == 'OPTIONS':
        return None
    if request.path.startswith('/api/admin/'):
        payload = None
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            from auth import verify_auth_token
            payload = verify_auth_token(auth_header[7:], 'admin')
        if not payload:
            return jsonify({'message': 'Admin authentication required.'}), 401
        g.auth_user = payload


def query_all(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    rows = cursor.fetchall()
    results = [row_to_dict(cursor, row) for row in rows]
    cursor.close()
    conn.close()
    return results


def query_one(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    row = cursor.fetchone()
    try:
        cursor.fetchall()
    except Exception:
        pass
    result = row_to_dict(cursor, row) if row else None
    cursor.close()
    conn.close()
    return result


def execute(sql, params=None):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(sql, params or [])
    conn.commit()
    rowcount = cursor.rowcount
    lastrowid = cursor.lastrowid
    cursor.close()
    conn.close()
    return rowcount, lastrowid


def ensure_student_profiles_table():
    execute(
        '''CREATE TABLE IF NOT EXISTS student_profiles (
            id INT AUTO_INCREMENT PRIMARY KEY,
            student_id INT UNIQUE NOT NULL,
            first_name VARCHAR(100),
            middle_name VARCHAR(100),
            last_name VARCHAR(100),
            gender VARCHAR(20) DEFAULT 'male',
            date_of_birth DATE,
            course_major VARCHAR(150),
            current_year_semester VARCHAR(100),
            government_id_type VARCHAR(50),
            government_id_file_name VARCHAR(255),
            government_id_file_data LONGTEXT,
            guardian_name VARCHAR(150),
            guardian_relationship VARCHAR(50),
            guardian_phone VARCHAR(20),
            permanent_address TEXT,
            admission_date DATE,
            food_preference VARCHAR(50),
            food_allergies TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE
        )'''
    )


def ensure_payments_schema():
    try:
        execute('ALTER TABLE payments ADD COLUMN paid_amount DECIMAL(10,2) DEFAULT 0.00 AFTER amount')
    except Exception:
        pass


def ensure_booking_fee(booking_id):
    ensure_payments_schema()
    booking = query_one(
        '''SELECT b.id, b.student_id, r.price
           FROM bookings b
           JOIN beds bed ON bed.id = b.bed_id
           JOIN rooms r ON r.id = bed.room_id
           WHERE b.id = %s''',
        [booking_id]
    )
    if not booking:
        return

    existing = query_one('SELECT id, amount, COALESCE(paid_amount, 0) AS paid_amount FROM payments WHERE booking_id = %s', [booking_id])
    if existing:
        if float(existing.get('paid_amount') or 0) == 0 and float(existing.get('amount') or 0) != float(booking['price'] or 0):
            execute(
                'UPDATE payments SET amount = %s, payment_status = %s WHERE id = %s',
                [booking['price'] or 0, 'pending', existing['id']]
            )
        return

    execute(
        'INSERT INTO payments (student_id, booking_id, amount, paid_amount, payment_status, due_date) VALUES (%s, %s, %s, %s, %s, CURDATE())',
        [booking['student_id'], booking_id, booking['price'] or 0, 0, 'pending']
    )


def get_allocated_student_context(registration_no=None, booking_id=None):
    ensure_student_profiles_table()
    filters = ["b.status IN ('allocated', 'completed')", 'b.bed_id IS NOT NULL']
    values = []
    if registration_no:
        filters.append('s.registration_no = %s')
        values.append(registration_no)
    if booking_id:
        filters.append('b.id = %s')
        values.append(booking_id)

    context = query_one(
        f'''SELECT b.id AS booking_id, b.status AS booking_status, b.requested_at, b.bed_id,
                  s.id AS student_id, s.registration_no, s.name, s.email, s.phone,
                  r.room_number, r.room_type, bed.bed_label
           FROM bookings b
           JOIN students s ON s.id = b.student_id
           JOIN beds bed ON bed.id = b.bed_id
           JOIN rooms r ON r.id = bed.room_id
           WHERE {' AND '.join(filters)}
           ORDER BY b.requested_at DESC
           LIMIT 1''',
        values
    )
    if not context:
        return None

    execute('INSERT IGNORE INTO student_profiles (student_id, gender) VALUES (%s, %s)', [context['student_id'], 'male'])
    profile = query_one('SELECT * FROM student_profiles WHERE student_id = %s', [context['student_id']]) or {}
    context['profile'] = profile
    return context


def serialize_student_context(context):
    profile = context.get('profile') or {}
    for date_key in ['date_of_birth', 'admission_date', 'created_at', 'updated_at']:
        if profile.get(date_key) and hasattr(profile[date_key], 'isoformat'):
            profile[date_key] = profile[date_key].isoformat()
    if context.get('requested_at') and hasattr(context['requested_at'], 'isoformat'):
        context['requested_at'] = context['requested_at'].isoformat()
    ensure_payments_schema()
    payments = query_all(
        '''SELECT id, amount, COALESCE(paid_amount, 0) AS paid_amount,
                  GREATEST(amount - COALESCE(paid_amount, 0), 0) AS balance_amount,
                  payment_status, due_date, paid_at, created_at
           FROM payments
           WHERE student_id = %s
           ORDER BY COALESCE(due_date, created_at) DESC''',
        [context.get('student_id')]
    )
    total_paid = sum(float(payment.get('paid_amount') or 0) for payment in payments)
    total_pending = sum(float(payment.get('balance_amount') or 0) for payment in payments)

    return {
        'booking': {
            'id': context.get('booking_id'),
            'status': context.get('booking_status'),
            'requested_at': context.get('requested_at'),
        },
        'student': {
            'id': context.get('student_id'),
            'registration_no': context.get('registration_no'),
            'name': context.get('name'),
            'email': context.get('email'),
            'phone': context.get('phone'),
        },
        'hostel': {
            'room_number': context.get('room_number'),
            'room_type': context.get('room_type'),
            'bed_label': context.get('bed_label'),
        },
        'profile': profile,
        'fees': {
            'payments': payments,
            'total_paid': total_paid,
            'total_pending': total_pending,
        },
    }


def normalize_profile_payload(data):
    government_id_data = data.get('government_id_file_data') or ''
    if government_id_data and len(government_id_data) > GOVERNMENT_ID_MAX_SIZE:
        raise ValidationError('Government ID upload is too large. Maximum allowed size is 2MB.')
    if government_id_data and not government_id_data.startswith(SAFE_DOCUMENT_PREFIXES):
        raise ValidationError('Government ID upload must be an image or PDF file.')

    food_preference = (data.get('food_preference') or '').strip().lower()
    if food_preference not in FOOD_PREFERENCES:
        raise ValidationError('Food preference must be Veg, Non-Veg, Allergies, or Other.')

    phone = validate_phone(data.get('phone', ''))
    guardian_phone = validate_phone(data.get('guardian_phone', ''))
    if phone and guardian_phone and phone == guardian_phone:
        raise ValidationError('Guardian phone number must be different from student contact number.')

    return {
        'first_name': validate_string(data.get('first_name', ''), 'First Name', max_length=100),
        'middle_name': (data.get('middle_name') or '').strip()[:100],
        'last_name': validate_string(data.get('last_name', ''), 'Last Name', max_length=100),
        'gender': 'male',
        'date_of_birth': (data.get('date_of_birth') or None),
        'email': validate_email(data.get('email', '')),
        'phone': phone,
        'course_major': (data.get('course_major') or '').strip()[:150],
        'current_year_semester': (data.get('current_year_semester') or '').strip()[:100],
        'government_id_type': (data.get('government_id_type') or '').strip()[:50],
        'government_id_file_name': (data.get('government_id_file_name') or '').strip()[:255],
        'government_id_file_data': government_id_data,
        'guardian_name': validate_string(data.get('guardian_name', ''), 'Guardian Name', max_length=150),
        'guardian_relationship': (data.get('guardian_relationship') or '').strip()[:50],
        'guardian_phone': guardian_phone,
        'permanent_address': (data.get('permanent_address') or '').strip(),
        'admission_date': (data.get('admission_date') or None),
        'food_preference': food_preference,
        'food_allergies': (data.get('food_allergies') or '').strip(),
    }


def validate_public_url(value, field_name='URL'):
    value = (value or '').strip()
    if not value:
        return ''
    if len(value) > 2048:
        raise ValidationError(f'{field_name} is too long.')
    parsed = urlparse(value)
    if parsed.scheme not in {'http', 'https'} or not parsed.netloc:
        raise ValidationError(f'{field_name} must start with http:// or https://.')
    return value


def validate_base64_image(value):
    value = value or ''
    if not value:
        return ''
    if len(value) > GALLERY_MAX_BASE64_SIZE:
        raise ValidationError('Image file is too large. Maximum size is 5MB.')
    if not value.startswith(SAFE_IMAGE_PREFIXES):
        raise ValidationError('Invalid image format. Use JPG, PNG, WEBP, GIF, BMP, or AVIF.')
    return value


def normalize_capacity(value=None, default=DEFAULT_BEDS_PER_ROOM):
    try:
        capacity = int(value or default)
    except (TypeError, ValueError):
        raise ValidationError('Room capacity must be a valid number.')

    if capacity < 1 or capacity > MAX_BEDS_PER_ROOM:
        raise ValidationError(f'Room capacity must be between 1 and {MAX_BEDS_PER_ROOM} beds.')
    return capacity


def get_bed_index(bed_label):
    try:
        return int(str(bed_label).rsplit('-B', 1)[1])
    except (IndexError, TypeError, ValueError):
        return None


def get_room_beds(room):
    try:
        capacity = normalize_capacity(room.get('capacity'))
    except ValidationError:
        capacity = DEFAULT_BEDS_PER_ROOM
        room['capacity'] = DEFAULT_BEDS_PER_ROOM
        execute('UPDATE rooms SET capacity = %s WHERE id = %s', [DEFAULT_BEDS_PER_ROOM, room['id']])

    beds = query_all('SELECT id, bed_label, status FROM beds WHERE room_id = %s ORDER BY bed_label', [room['id']])
    existing_labels = {bed['bed_label'] for bed in beds}

    for bed in beds:
        bed_index = get_bed_index(bed['bed_label'])
        if not bed_index or bed_index < 1 or bed_index > capacity:
            continue

        expected_label = f"{room['room_number']}-B{bed_index}"
        if bed['bed_label'] == expected_label:
            continue

        if expected_label not in existing_labels:
            execute('UPDATE beds SET bed_label = %s WHERE id = %s', [expected_label, bed['id']])
            existing_labels.add(expected_label)
            existing_labels.discard(bed['bed_label'])
        elif bed['status'] == 'available':
            execute('DELETE FROM beds WHERE id = %s', [bed['id']])

    beds = query_all('SELECT id, bed_label, status FROM beds WHERE room_id = %s ORDER BY bed_label', [room['id']])
    existing_labels = {bed['bed_label'] for bed in beds}

    for index in range(1, capacity + 1):
        bed_label = f"{room['room_number']}-B{index}"
        if bed_label not in existing_labels:
            execute(
                'INSERT INTO beds (room_id, bed_label, status) VALUES (%s, %s, %s)',
                [room['id'], bed_label, 'available']
            )

    for bed in beds:
        bed_index = get_bed_index(bed['bed_label'])
        if bed_index and bed_index > capacity and bed['status'] == 'available':
            execute('DELETE FROM beds WHERE id = %s', [bed['id']])

    return query_all('SELECT id, bed_label, status FROM beds WHERE room_id = %s ORDER BY bed_label', [room['id']])


@api_bp.route('/register/student', methods=['POST'])
def register_student():
    try:
        data = request.get_json() or {}
        
        # SECURITY: Validate all inputs
        registration_no = validate_string(data.get('registration_no', ''), 'Registration No', max_length=50)
        name = validate_string(data.get('name', ''), 'Name', max_length=150)
        email = validate_email(data.get('email', ''))
        phone = validate_phone(data.get('phone', ''))
        password = validate_password(data.get('password', ''))
        
        # Check if student already exists
        existing = query_one(
            'SELECT id FROM students WHERE registration_no = %s OR email = %s',
            [registration_no, email]
        )
        if existing:
            return jsonify({'message': 'Student already registered with this registration number or email.'}), 409
        
        # SECURITY: Hash password before storing
        hashed_password = hash_password(password)
        
        execute(
            'INSERT INTO students (registration_no, name, email, phone, password) VALUES (%s, %s, %s, %s, %s)',
            [registration_no, name, email, phone, hashed_password]
        )
        return jsonify({'message': 'Student registered successfully.'}), 201
    
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        return jsonify({'message': 'Registration failed. Please try again.'}), 500


@api_bp.route('/register/admin', methods=['POST'])
@check_admin_auth
def register_admin():
    try:
        data = request.get_json() or {}
        
        # SECURITY: Validate all inputs
        username = validate_string(data.get('username', ''), 'Username', max_length=100, min_length=3)
        email = validate_email(data.get('email', ''))
        password = validate_password(data.get('password', ''))
        
        # Check if admin already exists
        existing = query_one(
            'SELECT id FROM admins WHERE username = %s OR email = %s',
            [username, email]
        )
        if existing:
            return jsonify({'message': 'Admin already exists with this username or email.'}), 409
        
        # SECURITY: Hash password before storing
        hashed_password = hash_password(password)
        
        execute(
            'INSERT INTO admins (username, email, password) VALUES (%s, %s, %s)',
            [username, email, hashed_password]
        )
        return jsonify({'message': 'Admin registered successfully.'}), 201
    
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        return jsonify({'message': 'Registration failed. Please try again.'}), 500


@api_bp.route('/login/student', methods=['POST'])
def login_student():
    try:
        data = request.get_json() or {}
        registration_no = validate_string(data.get('registration_no', ''), 'Registration No', max_length=50)
        password = data.get('password', '').strip()
        
        if not password:
            return jsonify({'message': 'Password is required.'}), 400
        
        # Get student with hashed password
        student = query_one(
            'SELECT id, registration_no, name, password FROM students WHERE registration_no = %s',
            [registration_no]
        )
        
        if not student or not verify_password_or_legacy(student['password'], password):
            return jsonify({'message': 'Invalid registration number or password.'}), 401
        if not is_password_hash(student['password']):
            execute('UPDATE students SET password = %s WHERE id = %s', [hash_password(password), student['id']])

        token = generate_auth_token(student['id'], 'student', {'registration_no': student['registration_no']})
        
        # Return student info without password hash
        return jsonify({
            'message': 'Student login successful.',
            'student': {
                'id': student['id'],
                'registration_no': student['registration_no'],
                'name': student['name']
            },
            'token': token
        })
    
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        return jsonify({'message': 'Login failed. Please try again.'}), 500


@api_bp.route('/login/admin', methods=['POST'])
def login_admin():
    try:
        data = request.get_json() or {}
        username = validate_string(data.get('username', ''), 'Username', max_length=100)
        password = data.get('password', '').strip()
        
        if not password:
            return jsonify({'message': 'Password is required.'}), 400
        
        # Get admin with hashed password
        admin = query_one(
            'SELECT id, username, email, password FROM admins WHERE username = %s',
            [username]
        )
        
        if not admin or not verify_password_or_legacy(admin['password'], password):
            return jsonify({'message': 'Invalid username or password.'}), 401
        if not is_password_hash(admin['password']):
            execute('UPDATE admins SET password = %s WHERE id = %s', [hash_password(password), admin['id']])

        token = generate_auth_token(admin['id'], 'admin', {'username': admin['username']})
        
        # Return admin info without password hash
        return jsonify({
            'message': 'Admin login successful.',
            'admin': {
                'id': admin['id'],
                'username': admin['username'],
                'email': admin['email']
            },
            'token': token
        })
    
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        return jsonify({'message': 'Login failed. Please try again.'}), 500


@api_bp.route('/booking/rooms', methods=['GET'])
def get_rooms_with_beds():
    rooms = query_all('SELECT id, room_number, room_type, capacity, price FROM rooms ORDER BY room_number')
    for room in rooms:
        room['beds'] = get_room_beds(room)
    return jsonify(rooms)


@api_bp.route('/student/profile', methods=['GET'])
@check_student_auth
def get_student_profile():
    registration_no = (g.auth_user.get('registration_no') or '').strip()
    if not registration_no:
        return jsonify({'message': 'Student registration number is required.'}), 400

    context = get_allocated_student_context(registration_no=registration_no)
    if not context:
        return jsonify({'message': 'Student section opens after admin allocates a bed to your booking.'}), 403

    return jsonify(serialize_student_context(context))


@api_bp.route('/student/profile', methods=['POST'])
@check_student_auth
def update_student_profile():
    registration_no = (g.auth_user.get('registration_no') or '').strip()
    if not registration_no:
        return jsonify({'message': 'Student registration number is required.'}), 400

    context = get_allocated_student_context(registration_no=registration_no)
    if not context:
        return jsonify({'message': 'Student section opens after admin allocates a bed to your booking.'}), 403

    try:
        payload = normalize_profile_payload(request.get_json() or {})
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400

    new_registration_no = validate_string((request.get_json() or {}).get('registration_no', registration_no), 'Registration No', max_length=50)
    if new_registration_no != registration_no:
        existing = query_one('SELECT id FROM students WHERE registration_no = %s AND id != %s', [new_registration_no, context['student_id']])
        if existing:
            return jsonify({'message': 'Another student is already registered with this registration number.'}), 409

    full_name = ' '.join(part for part in [payload['first_name'], payload['middle_name'], payload['last_name']] if part).strip()
    execute(
        'UPDATE students SET registration_no = %s, name = %s, email = %s, phone = %s WHERE id = %s',
        [new_registration_no, full_name, payload['email'], payload['phone'], context['student_id']]
    )
    execute(
        '''UPDATE student_profiles
           SET first_name = %s, middle_name = %s, last_name = %s, gender = %s, date_of_birth = %s,
               course_major = %s, current_year_semester = %s, government_id_type = %s,
               government_id_file_name = %s, government_id_file_data = %s, guardian_name = %s,
               guardian_relationship = %s, guardian_phone = %s, permanent_address = %s,
               admission_date = %s, food_preference = %s, food_allergies = %s
           WHERE student_id = %s''',
        [
            payload['first_name'], payload['middle_name'], payload['last_name'], payload['gender'], payload['date_of_birth'],
            payload['course_major'], payload['current_year_semester'], payload['government_id_type'],
            payload['government_id_file_name'], payload['government_id_file_data'], payload['guardian_name'],
            payload['guardian_relationship'], payload['guardian_phone'], payload['permanent_address'],
            payload['admission_date'], payload['food_preference'], payload['food_allergies'], context['student_id']
        ]
    )

    updated_context = get_allocated_student_context(registration_no=new_registration_no)
    return jsonify({
        'message': 'Student information saved successfully.',
        'token': generate_auth_token(context['student_id'], 'student', {'registration_no': new_registration_no}),
        **serialize_student_context(updated_context)
    })


@api_bp.route('/bookings', methods=['POST'])
def create_booking():
    data = request.get_json() or {}
    registration_no = (data.get('registration_no') or '').strip()
    bed_id = data.get('bed_id')
    notes = data.get('notes', '').strip()

    if not registration_no or not bed_id:
        return jsonify({'message': 'Student registration number and bed selection are required.'}), 400

    student = query_one('SELECT id FROM students WHERE registration_no = %s', [registration_no])
    if not student:
        return jsonify({'message': 'Student not found. Please register first.'}), 404

    bed = query_one('SELECT id, status FROM beds WHERE id = %s', [bed_id])
    if not bed:
        return jsonify({'message': 'Selected bed not found.'}), 404
    if bed['status'] != 'available':
        return jsonify({'message': 'Selected bed is not available.'}), 409

    execute('INSERT INTO bookings (student_id, bed_id, status, notes) VALUES (%s, %s, %s, %s)', [student['id'], bed_id, 'pending', notes])
    execute('UPDATE beds SET status = %s WHERE id = %s', ['booked', bed_id])

    return jsonify({'message': 'Booking request submitted successfully.'}), 201


@api_bp.route('/inquiries', methods=['POST'])
def create_inquiry():
    data = request.get_json() or {}
    registration_no = (data.get('registration_no') or '').strip()
    subject = data.get('subject', '').strip()
    message = data.get('message', '').strip()

    if not subject or not message:
        return jsonify({'message': 'Subject and message are required.'}), 400

    student_id = None
    if registration_no:
        student = query_one('SELECT id FROM students WHERE registration_no = %s', [registration_no])
        student_id = student['id'] if student else None

    execute('INSERT INTO inquiries (student_id, subject, message) VALUES (%s, %s, %s)', [student_id, subject, message])
    return jsonify({'message': 'Inquiry submitted successfully.'}), 201


@api_bp.route('/admin/bookings', methods=['GET'])
def get_bookings():
    ensure_student_profiles_table()
    for room in query_all('SELECT id, room_number, capacity FROM rooms'):
        get_room_beds(room)

    bookings = query_all(
        '''SELECT b.id, b.student_id, b.bed_id, b.status, b.requested_at, b.notes,
                  s.registration_no AS student_registration, s.name AS student_name,
                  r.id AS room_id, r.room_number, r.room_type, r.price AS room_price,
                  CASE WHEN sp.id IS NULL THEN 0 ELSE 1 END AS has_student_profile,
                  bed.bed_label AS selected_bed_label,
                  CASE WHEN b.status IN ('allocated', 'completed') THEN bed.bed_label ELSE NULL END AS allocated_bed
           FROM bookings b
           LEFT JOIN students s ON s.id = b.student_id
           LEFT JOIN beds bed ON bed.id = b.bed_id
           LEFT JOIN rooms r ON r.id = bed.room_id
           LEFT JOIN student_profiles sp ON sp.student_id = s.id
           ORDER BY b.requested_at DESC'''
    )
    return jsonify(bookings)


@api_bp.route('/admin/bookings/<int:booking_id>/student-info', methods=['GET'])
def get_booking_student_info(booking_id):
    context = get_allocated_student_context(booking_id=booking_id)
    if not context:
        return jsonify({'message': 'Student information is available after bed allocation is completed.'}), 403

    return jsonify(serialize_student_context(context))


@api_bp.route('/admin/bookings/<int:booking_id>/allocate-bed', methods=['POST'])
def allocate_bed(booking_id):
    data = request.get_json() or {}
    bed_id = data.get('bed_id')
    if not bed_id:
        return jsonify({'message': 'Bed selection is required.'}), 400

    booking = query_one('SELECT bed_id FROM bookings WHERE id = %s', [booking_id])
    if not booking:
        return jsonify({'message': 'Booking not found.'}), 404

    bed = query_one('SELECT id, status FROM beds WHERE id = %s', [bed_id])
    if not bed:
        return jsonify({'message': 'Bed not found.'}), 404
    is_same_requested_bed = booking['bed_id'] and int(booking['bed_id']) == int(bed_id)
    if bed['status'] != 'available' and not is_same_requested_bed:
        return jsonify({'message': 'Selected bed is not available.'}), 409

    if booking['bed_id'] and not is_same_requested_bed:
        execute('UPDATE beds SET status = %s WHERE id = %s', ['available', booking['bed_id']])

    execute('UPDATE bookings SET bed_id = %s, status = %s WHERE id = %s', [bed_id, 'allocated', booking_id])
    execute('UPDATE beds SET status = %s WHERE id = %s', ['booked', bed_id])
    ensure_booking_fee(booking_id)

    return jsonify({'message': 'Bed allocated successfully.'})


@api_bp.route('/admin/bookings/<int:booking_id>/unassign', methods=['POST'])
def unassign_booking(booking_id):
    booking = query_one('SELECT bed_id FROM bookings WHERE id = %s', [booking_id])
    if not booking:
        return jsonify({'message': 'Booking not found.'}), 404

    if booking['bed_id']:
        execute('UPDATE beds SET status = %s WHERE id = %s', ['available', booking['bed_id']])
        execute('UPDATE bookings SET bed_id = NULL, status = %s WHERE id = %s', ['pending', booking_id])
        return jsonify({'message': 'Booking unassigned successfully.'})

    return jsonify({'message': 'Booking is not assigned.'}), 400


@api_bp.route('/admin/bookings/<int:booking_id>/update-status', methods=['POST'])
def update_booking_status(booking_id):
    data = request.get_json() or {}
    status = (data.get('status') or '').strip()
    if not status:
        return jsonify({'message': 'Status is required.'}), 400
    if status not in {'pending', 'allocated', 'completed', 'cancelled'}:
        return jsonify({'message': 'Invalid booking status.'}), 400

    booking = query_one('SELECT bed_id FROM bookings WHERE id = %s', [booking_id])
    if not booking:
        return jsonify({'message': 'Booking not found.'}), 404
    if status in {'allocated', 'completed'} and not booking['bed_id']:
        return jsonify({'message': 'Assign a bed before marking this booking allocated or completed.'}), 400

    if status == 'cancelled':
        if booking['bed_id']:
            execute('UPDATE beds SET status = %s WHERE id = %s', ['available', booking['bed_id']])
        execute('UPDATE bookings SET status = %s, bed_id = NULL WHERE id = %s', [status, booking_id])
        return jsonify({'message': f'Booking status updated to {status}.'})

    execute('UPDATE bookings SET status = %s WHERE id = %s', [status, booking_id])
    if booking['bed_id']:
        bed_status = 'occupied' if status == 'completed' else 'booked'
        execute('UPDATE beds SET status = %s WHERE id = %s', [bed_status, booking['bed_id']])
        if status in {'allocated', 'completed'}:
            ensure_booking_fee(booking_id)

    return jsonify({'message': f'Booking status updated to {status}.'})


@api_bp.route('/admin/bookings/<int:booking_id>', methods=['DELETE'])
def delete_booking(booking_id):
    booking = query_one('SELECT bed_id FROM bookings WHERE id = %s', [booking_id])
    if not booking:
        return jsonify({'message': 'Booking not found.'}), 404

    # Free the bed if allocated
    if booking['bed_id']:
        execute('UPDATE beds SET status = %s WHERE id = %s', ['available', booking['bed_id']])

    rowcount, _ = execute('DELETE FROM bookings WHERE id = %s', [booking_id])
    if rowcount == 0:
        return jsonify({'message': 'Booking not found.'}), 404

    return jsonify({'message': 'Booking deleted successfully.'})


@api_bp.route('/admin/inquiries', methods=['GET'])
def get_inquiries():
    inquiries = query_all(
        '''SELECT i.id, i.subject, i.message, i.response, i.status, i.created_at,
                  s.registration_no AS student_registration, s.name AS student_name
           FROM inquiries i
           LEFT JOIN students s ON s.id = i.student_id
           ORDER BY i.created_at DESC'''
    )
    return jsonify(inquiries)


@api_bp.route('/admin/inquiries/<int:inquiry_id>/respond', methods=['POST'])
def respond_inquiry(inquiry_id):
    data = request.get_json() or {}
    response = (data.get('response') or '').strip()
    if not response:
        return jsonify({'message': 'Response is required.'}), 400

    rowcount, _ = execute('UPDATE inquiries SET response = %s, status = %s WHERE id = %s', [response, 'answered', inquiry_id])
    if rowcount == 0:
        return jsonify({'message': 'Inquiry not found.'}), 404

    return jsonify({'message': 'Inquiry responded successfully.'})


@api_bp.route('/admin/payments', methods=['GET'])
def get_payments():
    ensure_payments_schema()
    allocated_bookings = query_all(
        "SELECT id FROM bookings WHERE status IN ('allocated', 'completed') AND bed_id IS NOT NULL"
    )
    for booking in allocated_bookings:
        ensure_booking_fee(booking['id'])

    payments = query_all(
        '''SELECT p.id, p.student_id, p.amount, COALESCE(p.paid_amount, 0) AS paid_amount,
                  GREATEST(p.amount - COALESCE(p.paid_amount, 0), 0) AS balance_amount,
                  p.payment_status, p.due_date, p.paid_at, p.created_at,
                  s.registration_no AS student_registration, s.name AS student_name,
                  b.id AS booking_id, b.status AS booking_status,
                  room.room_number, room.room_type, bed.bed_label
           FROM payments p
           JOIN students s ON s.id = p.student_id
           JOIN bookings b ON b.id = p.booking_id AND b.status IN ('allocated', 'completed') AND b.bed_id IS NOT NULL
           JOIN beds bed ON bed.id = b.bed_id
           JOIN rooms room ON room.id = bed.room_id
           ORDER BY p.created_at DESC'''
    )
    return jsonify(payments)


@api_bp.route('/admin/students', methods=['GET'])
def get_students():
    students = query_all(
        '''SELECT s.id, s.registration_no, s.name, s.email, s.phone, s.created_at,
                  b.id AS booking_id, b.status AS booking_status,
                  room.room_number, bed.bed_label
           FROM students s
           LEFT JOIN bookings b ON b.student_id = s.id
           LEFT JOIN beds bed ON bed.id = b.bed_id
           LEFT JOIN rooms room ON room.id = bed.room_id
           ORDER BY s.name ASC, b.requested_at DESC'''
    )
    return jsonify(students)


@api_bp.route('/admin/payments/<int:payment_id>/update', methods=['POST'])
def update_payment_status(payment_id):
    data = request.get_json() or {}
    ensure_payments_schema()
    payment = query_one(
        'SELECT id, amount, COALESCE(paid_amount, 0) AS paid_amount FROM payments WHERE id = %s',
        [payment_id]
    )
    if not payment:
        return jsonify({'message': 'Payment record not found.'}), 404

    try:
        received_amount = float(data.get('received_amount') or 0)
    except (TypeError, ValueError):
        return jsonify({'message': 'Received amount must be a valid number.'}), 400

    if received_amount <= 0:
        return jsonify({'message': 'Received amount must be greater than zero.'}), 400

    total_amount = float(payment.get('amount') or 0)
    current_paid = float(payment.get('paid_amount') or 0)
    balance = max(total_amount - current_paid, 0)
    if received_amount > balance:
        return jsonify({'message': f'Received amount cannot be greater than pending balance Rs {balance:.2f}.'}), 400

    new_paid = current_paid + received_amount
    new_balance = max(total_amount - new_paid, 0)
    payment_status = 'paid' if new_balance == 0 else 'partial'

    rowcount, _ = execute(
        'UPDATE payments SET paid_amount = %s, payment_status = %s, paid_at = NOW() WHERE id = %s',
        [new_paid, payment_status, payment_id]
    )
    if rowcount == 0:
        return jsonify({'message': 'Payment record not found.'}), 404

    return jsonify({
        'message': f'Payment recorded successfully. Pending balance Rs {new_balance:.2f}.',
        'paid_amount': new_paid,
        'balance_amount': new_balance,
        'payment_status': payment_status,
    })


@api_bp.route('/admin/rooms', methods=['GET'])
def get_rooms():
    rooms = query_all('SELECT id, room_number, room_type, capacity, price FROM rooms ORDER BY room_number')
    for room in rooms:
        room['beds'] = get_room_beds(room)
    return jsonify(rooms)


@api_bp.route('/admin/rooms', methods=['POST'])
def create_room():
    try:
        data = request.get_json() or {}
        room_number = (data.get('room_number') or '').strip()
        room_type = (data.get('room_type') or 'shared').strip()
        capacity = normalize_capacity(data.get('capacity'))
        price = data.get('price') or 0.00
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400

    if not room_number:
        return jsonify({'message': 'Room number is required.'}), 400

    existing = query_one('SELECT id FROM rooms WHERE room_number = %s', [room_number])
    if existing:
        return jsonify({'message': 'Room already exists.'}), 409

    _, room_id = execute('INSERT INTO rooms (room_number, room_type, capacity, price) VALUES (%s, %s, %s, %s)', [room_number, room_type, capacity, price])

    # Create beds for the room
    created_beds = 0
    for index in range(1, capacity + 1):
        bed_label = f'{room_number}-B{index}'
        try:
            execute('INSERT INTO beds (room_id, bed_label, status) VALUES (%s, %s, %s)', [room_id, bed_label, 'available'])
            created_beds += 1
        except Exception as e:
            # If bed creation fails, delete the room and return error
            execute('DELETE FROM rooms WHERE id = %s', [room_id])
            return jsonify({'message': f'Failed to create beds: {str(e)}'}), 500

    if created_beds != capacity:
        # If not all beds were created, rollback
        execute('DELETE FROM rooms WHERE id = %s', [room_id])
        return jsonify({'message': f'Failed to create all beds. Created {created_beds}/{capacity}.'}), 500

    return jsonify({'message': f'Room created successfully with {capacity} beds.'}), 201


@api_bp.route('/admin/beds', methods=['POST'])
def create_bed():
    data = request.get_json() or {}
    room_id = data.get('room_id')
    bed_label = (data.get('bed_label') or '').strip()

    if not room_id or not bed_label:
        return jsonify({'message': 'Room ID and bed label are required.'}), 400

    existing = query_one('SELECT id FROM beds WHERE bed_label = %s', [bed_label])
    if existing:
        return jsonify({'message': 'Bed label already exists.'}), 409

    room = query_one('SELECT id, room_number, capacity FROM rooms WHERE id = %s', [room_id])
    if not room:
        return jsonify({'message': 'Room not found.'}), 404

    capacity = normalize_capacity(room['capacity'])
    bed_index = get_bed_index(bed_label)
    if not bed_index or bed_index < 1 or bed_index > capacity:
        return jsonify({'message': f'Bed label must be between {room["room_number"]}-B1 and {room["room_number"]}-B{capacity}.'}), 400
    if bed_label != f'{room["room_number"]}-B{bed_index}':
        return jsonify({'message': f'Bed label must start with room number {room["room_number"]}.'}), 400

    execute('INSERT INTO beds (room_id, bed_label, status) VALUES (%s, %s, %s)', [room_id, bed_label, 'available'])
    return jsonify({'message': 'Bed created successfully.'}), 201


@api_bp.route('/admin/sms', methods=['GET'])
def get_sms_notifications():
    sms_list = query_all(
        '''SELECT s.id, s.subject, s.message, s.status, s.created_at,
                  st.registration_no AS student_registration, st.name AS student_name,
                  a.username AS admin_username
           FROM sms_notifications s
           LEFT JOIN students st ON st.id = s.student_id
           LEFT JOIN admins a ON a.id = s.admin_id
           ORDER BY s.created_at DESC'''
    )
    return jsonify(sms_list)


@api_bp.route('/admin/sms/send', methods=['POST'])
def send_sms():
    data = request.get_json() or {}
    subject = (data.get('subject') or '').strip()
    message = (data.get('message') or '').strip()
    student_id = data.get('student_id')
    booking_id = data.get('booking_id')
    admin_id = data.get('admin_id')

    if not subject or not message:
        return jsonify({'message': 'Subject and message are required.'}), 400

    execute(
        'INSERT INTO sms_notifications (student_id, admin_id, booking_id, subject, message, status) VALUES (%s, %s, %s, %s, %s, %s)',
        [student_id, admin_id, booking_id, subject, message, 'sent']
    )
    return jsonify({'message': 'SMS notification recorded successfully.'}), 201


@api_bp.route('/admin/rooms/<int:room_id>', methods=['PUT'])
def update_room(room_id):
    data = request.get_json() or {}
    room_number = (data.get('room_number') or '').strip()
    room_type = (data.get('room_type') or '').strip()
    try:
        capacity = normalize_capacity(data.get('capacity'))
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    price = data.get('price')

    if room_number:
        existing = query_one('SELECT id FROM rooms WHERE room_number = %s AND id != %s', [room_number, room_id])
        if existing:
            return jsonify({'message': 'Room number already exists.'}), 409

    updates = []
    values = []
    if room_number:
        updates.append('room_number = %s')
        values.append(room_number)
    if room_type:
        updates.append('room_type = %s')
        values.append(room_type)
    updates.append('capacity = %s')
    values.append(capacity)
    if price is not None:
        updates.append('price = %s')
        values.append(price)

    if not updates:
        return jsonify({'message': 'No fields to update.'}), 400

    values.append(room_id)
    rowcount, _ = execute(f"UPDATE rooms SET {', '.join(updates)} WHERE id = %s", values)
    if rowcount == 0:
        return jsonify({'message': 'Room not found.'}), 404

    updated_room = query_one('SELECT id, room_number, capacity FROM rooms WHERE id = %s', [room_id])
    if updated_room:
        get_room_beds(updated_room)

    return jsonify({'message': 'Room updated successfully.'})


@api_bp.route('/admin/rooms/<int:room_id>', methods=['DELETE'])
def delete_room(room_id):
    # Delete beds associated with the room
    execute('DELETE FROM beds WHERE room_id = %s', [room_id])
    # Delete the room
    rowcount, _ = execute('DELETE FROM rooms WHERE id = %s', [room_id])
    
    if rowcount == 0:
        return jsonify({'message': 'Room not found.'}), 404

    return jsonify({'message': 'Room deleted successfully.'})


@api_bp.route('/admin/beds/<int:bed_id>', methods=['PUT'])
def update_bed(bed_id):
    data = request.get_json() or {}
    bed_label = (data.get('bed_label') or '').strip()
    status = (data.get('status') or '').strip()

    updates = []
    values = []
    if bed_label:
        bed = query_one(
            '''SELECT bed.id, r.room_number, r.capacity
               FROM beds bed
               JOIN rooms r ON r.id = bed.room_id
               WHERE bed.id = %s''',
            [bed_id]
        )
        if not bed:
            return jsonify({'message': 'Bed not found.'}), 404

        capacity = normalize_capacity(bed['capacity'])
        bed_index = get_bed_index(bed_label)
        if not bed_index or bed_index < 1 or bed_index > capacity:
            return jsonify({'message': f'Bed label must be between {bed["room_number"]}-B1 and {bed["room_number"]}-B{capacity}.'}), 400
        if bed_label != f'{bed["room_number"]}-B{bed_index}':
            return jsonify({'message': f'Bed label must start with room number {bed["room_number"]}.'}), 400

        updates.append('bed_label = %s')
        values.append(bed_label)
    if status:
        if status not in BED_STATUSES:
            return jsonify({'message': 'Invalid bed status.'}), 400
        active_booking = query_one(
            "SELECT id, status FROM bookings WHERE bed_id = %s AND status IN ('pending', 'allocated', 'completed')",
            [bed_id]
        )
        if active_booking:
            return jsonify({
                'message': 'This bed is linked to a booking. Update it from the Bookings section.'
            }), 409
        updates.append('status = %s')
        values.append(status)

    if not updates:
        return jsonify({'message': 'No fields to update.'}), 400

    values.append(bed_id)
    rowcount, _ = execute(f"UPDATE beds SET {', '.join(updates)} WHERE id = %s", values)
    if rowcount == 0:
        return jsonify({'message': 'Bed not found.'}), 404

    return jsonify({'message': 'Bed updated successfully.'})


@api_bp.route('/admin/beds/<int:bed_id>', methods=['DELETE'])
def delete_bed(bed_id):
    rowcount, _ = execute('DELETE FROM beds WHERE id = %s', [bed_id])
    if rowcount == 0:
        return jsonify({'message': 'Bed not found.'}), 404

    return jsonify({'message': 'Bed deleted successfully.'})


@api_bp.route('/admin/summary', methods=['GET'])
def get_admin_summary():
    ensure_payments_schema()
    for room in query_all('SELECT id, room_number, capacity FROM rooms'):
        get_room_beds(room)

    total_bookings = query_one('SELECT COUNT(*) AS count FROM bookings')['count']
    pending_bookings = query_one("SELECT COUNT(*) AS count FROM bookings WHERE status = 'pending'")['count']
    allocated_bookings = query_one("SELECT COUNT(*) AS count FROM bookings WHERE status = 'allocated'")['count']
    completed_bookings = query_one("SELECT COUNT(*) AS count FROM bookings WHERE status = 'completed'")['count']
    open_inquiries = query_one("SELECT COUNT(*) AS count FROM inquiries WHERE status = 'open'")['count']
    due_payments = query_one("SELECT COUNT(*) AS count FROM payments WHERE GREATEST(amount - COALESCE(paid_amount, 0), 0) > 0")['count']
    total_rooms = query_one('SELECT COUNT(*) AS count FROM rooms')['count']
    total_beds = query_one('SELECT COUNT(*) AS count FROM beds')['count']
    available_beds = query_one("SELECT COUNT(*) AS count FROM beds WHERE status = 'available'")['count']
    allocated_beds = query_one("SELECT COUNT(*) AS count FROM beds WHERE status = 'booked'")['count']
    occupied_beds = query_one("SELECT COUNT(*) AS count FROM beds WHERE status = 'occupied'")['count']
    paid_revenue = query_one("SELECT COALESCE(SUM(COALESCE(paid_amount, 0)), 0) AS amount FROM payments")['amount']
    pending_revenue = query_one("SELECT COALESCE(SUM(GREATEST(amount - COALESCE(paid_amount, 0), 0)), 0) AS amount FROM payments")['amount']

    return jsonify({
        'total_bookings': total_bookings,
        'pending_bookings': pending_bookings,
        'allocated_bookings': allocated_bookings,
        'completed_bookings': completed_bookings,
        'open_inquiries': open_inquiries,
        'due_payments': due_payments,
        'total_rooms': total_rooms,
        'total_beds': total_beds,
        'available_beds': available_beds,
        'allocated_beds': allocated_beds,
        'occupied_beds': occupied_beds,
        'paid_revenue': float(paid_revenue or 0),
        'pending_revenue': float(pending_revenue or 0),
    })


# ===== GALLERY MANAGEMENT ENDPOINTS =====

# Max base64 size: ~7MB base64 string = ~5MB raw image
GALLERY_MAX_BASE64_SIZE = 7 * 1024 * 1024
# Max request body size for gallery: 8MB
GALLERY_MAX_CONTENT_LENGTH = 8 * 1024 * 1024

@api_bp.route('/admin/gallery', methods=['GET'])
def get_gallery():
    images = query_all('SELECT id, title, description, image_url, image_base64, display_order, is_visible, created_at FROM gallery ORDER BY display_order ASC')
    return jsonify(images)


@api_bp.route('/public/gallery', methods=['GET'])
def get_public_gallery():
    # Return image_base64 when image_url is absent so uploaded images display on the public page
    images = query_all(
        '''SELECT id, title, description,
           CASE WHEN image_url IS NOT NULL AND image_url != "" THEN image_url
                ELSE image_base64 END AS image_src
           FROM gallery WHERE is_visible = 1 ORDER BY display_order ASC'''
    )
    return jsonify(images)


@api_bp.route('/admin/gallery', methods=['POST'])
def create_gallery_image():
    try:
        # Guard: reject oversized requests before parsing JSON
        content_length = request.content_length
        if content_length and content_length > GALLERY_MAX_CONTENT_LENGTH:
            return jsonify({'message': 'Request too large. Maximum image size is 5MB.'}), 413

        data = request.get_json(silent=True)
        if data is None:
            return jsonify({'message': 'Invalid or missing JSON body.'}), 400

        # Validate title (required)
        title = validate_string(data.get('title') or '', 'Image title', max_length=255)
        if not title:
            return jsonify({'message': 'Image title is required.'}), 400
        # Description (optional)
        description = (data.get('description') or '').strip()[:1000]

        # Image source — accept base64 string or URL, never both
        image_url = validate_public_url(data.get('image_url') or '', 'Image URL')
        image_base64_raw = data.get('image_base64')
        # Handle None explicitly — do NOT call .strip() on a potentially huge string
        image_base64 = image_base64_raw.strip() if isinstance(image_base64_raw, str) and len(image_base64_raw) < GALLERY_MAX_BASE64_SIZE else (image_base64_raw or '')

        if not image_url and not image_base64:
            return jsonify({'message': 'Please provide either an image URL or upload an image file.'}), 400

        # Validate base64 size
        image_base64 = validate_base64_image(image_base64)

        # Display order
        try:
            display_order = int(data.get('display_order') or 0)
        except (ValueError, TypeError):
            display_order = 0

        # Insert into database
        # NOTE: The image_base64 column in MySQL MUST be LONGTEXT or MEDIUMTEXT.
        # If you get a database error here, run this SQL once:
        #   ALTER TABLE gallery MODIFY COLUMN image_base64 LONGTEXT;
        try:
            rowcount, lastrowid = execute(
                'INSERT INTO gallery (title, description, image_url, image_base64, display_order, is_visible) VALUES (%s, %s, %s, %s, %s, %s)',
                [
                    title,
                    description,
                    image_url if image_url else None,
                    image_base64 if image_base64 else None,
                    display_order,
                    1
                ]
            )
            if rowcount == 0:
                return jsonify({'message': 'Failed to insert image into database.'}), 500

            return jsonify({'message': 'Gallery image added successfully.', 'id': lastrowid}), 201

        except Exception as db_error:
            err_msg = str(db_error).lower()
            # Detect common MySQL column-too-small errors and give a clear message
            if 'data too long' in err_msg or '1406' in err_msg:
                return jsonify({
                    'message': 'Database column is too small for this image. '
                               'Run this SQL once to fix it: '
                               'ALTER TABLE gallery MODIFY COLUMN image_base64 LONGTEXT;'
                }), 500
            if 'max_allowed_packet' in err_msg or '1153' in err_msg:
                return jsonify({
                    'message': 'MySQL max_allowed_packet is too small. '
                               'Run: SET GLOBAL max_allowed_packet=67108864; in MySQL, '
                               'or add max_allowed_packet=64M under [mysqld] in my.cnf and restart.'
                }), 500
            return jsonify({'message': f'Database error: {str(db_error)}'}), 500

    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Server error: {str(e)}'}), 500


@api_bp.route('/admin/gallery/<int:gallery_id>', methods=['PUT'])
def update_gallery_image(gallery_id):
    try:
        # Guard: reject oversized requests before parsing JSON
        content_length = request.content_length
        if content_length and content_length > GALLERY_MAX_CONTENT_LENGTH:
            return jsonify({'message': 'Request too large. Maximum image size is 5MB.'}), 413

        data = request.get_json(silent=True)
        if data is None:
            return jsonify({'message': 'Invalid or missing JSON body.'}), 400

        title = (data.get('title') or '').strip()
        description = (data.get('description') or '').strip()
        image_url = validate_public_url(data.get('image_url') or '', 'Image URL')
        # Safe handling of large base64 — avoid .strip() on huge strings
        image_base64_raw = data.get('image_base64')
        image_base64 = image_base64_raw.strip() if isinstance(image_base64_raw, str) and len(image_base64_raw) < GALLERY_MAX_BASE64_SIZE else (image_base64_raw or '')
        display_order = data.get('display_order')
        is_visible = data.get('is_visible')

        image_base64 = validate_base64_image(image_base64)

        updates = []
        values = []
        if title:
            title = validate_string(title, 'Image title', max_length=255)
            updates.append('title = %s')
            values.append(title)
        if description is not None:
            updates.append('description = %s')
            values.append(description[:1000])
        if image_url:
            updates.append('image_url = %s')
            updates.append('image_base64 = %s')  # clear base64 when switching to URL
            values.append(image_url)
            values.append(None)
        if image_base64:
            updates.append('image_base64 = %s')
            updates.append('image_url = %s')  # clear URL when switching to upload
            values.append(image_base64)
            values.append(None)
        if display_order is not None:
            updates.append('display_order = %s')
            values.append(int(display_order))
        if is_visible is not None:
            updates.append('is_visible = %s')
            values.append(1 if is_visible else 0)

        if not updates:
            return jsonify({'message': 'No updates provided.'}), 400

        values.append(gallery_id)
        sql = f"UPDATE gallery SET {', '.join(updates)} WHERE id = %s"
        rowcount, _ = execute(sql, values)

        if rowcount == 0:
            return jsonify({'message': 'Gallery image not found.'}), 404

        return jsonify({'message': 'Gallery image updated successfully.'})
    except ValidationError as e:
        return jsonify({'message': str(e)}), 400
    except Exception as e:
        import traceback
        traceback.print_exc()
        err_msg = str(e).lower()
        if 'data too long' in err_msg or '1406' in err_msg:
            return jsonify({
                'message': 'Database column is too small. '
                           'Run: ALTER TABLE gallery MODIFY COLUMN image_base64 LONGTEXT;'
            }), 500
        if 'max_allowed_packet' in err_msg or '1153' in err_msg:
            return jsonify({
                'message': 'MySQL max_allowed_packet too small. '
                           'Add max_allowed_packet=64M under [mysqld] in my.cnf and restart MySQL.'
            }), 500
        return jsonify({'message': f'Error updating gallery image: {str(e)}'}), 500


@api_bp.route('/admin/gallery/<int:gallery_id>', methods=['DELETE'])
def delete_gallery_image(gallery_id):
    try:
        rowcount, _ = execute('DELETE FROM gallery WHERE id = %s', [gallery_id])
        if rowcount == 0:
            return jsonify({'message': 'Gallery image not found.'}), 404
        return jsonify({'message': 'Gallery image deleted successfully.'})
    except Exception as e:
        return jsonify({'message': f'Error deleting gallery image: {str(e)}'}), 500


# ===== FEEDBACK MANAGEMENT ENDPOINTS =====
@api_bp.route('/admin/feedbacks', methods=['GET'])
def get_all_feedbacks():
    feedbacks = query_all(
        '''SELECT id, student_id, student_name, student_email, rating, message, is_visible, created_at
           FROM feedbacks ORDER BY created_at DESC'''
    )
    return jsonify(feedbacks)


@api_bp.route('/public/feedbacks', methods=['GET'])
def get_public_feedbacks():
    feedbacks = query_all(
        'SELECT student_name, rating, message, created_at FROM feedbacks WHERE is_visible = 1 ORDER BY created_at DESC'
    )
    return jsonify(feedbacks)


@api_bp.route('/feedbacks', methods=['POST'])
def submit_feedback():
    try:
        data = request.get_json() or {}
        
        # Validate inputs
        student_id = data.get('student_id')
        student_name = (data.get('student_name') or '').strip()
        student_email = (data.get('student_email') or '').strip()
        rating = data.get('rating')
        message = (data.get('message') or '').strip()
        
        # Validate name
        if not student_name:
            return jsonify({'message': 'Student name is required.'}), 400
        if len(student_name) > 150:
            return jsonify({'message': 'Student name exceeds maximum length of 150 characters.'}), 400
        
        # Validate email
        if not student_email:
            return jsonify({'message': 'Email is required.'}), 400
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        if not __import__('re').match(email_pattern, student_email):
            return jsonify({'message': 'Invalid email format.'}), 400
        
        # Validate message
        if not message:
            return jsonify({'message': 'Feedback message is required.'}), 400
        if len(message) < 5:
            return jsonify({'message': 'Feedback message must be at least 5 characters long.'}), 400
        if len(message) > 5000:
            return jsonify({'message': 'Feedback message exceeds maximum length of 5000 characters.'}), 400
        
        # Validate rating
        if rating is None:
            return jsonify({'message': 'Rating is required.'}), 400
        try:
            rating = int(rating)
            if rating < 1 or rating > 5:
                return jsonify({'message': 'Rating must be between 1 and 5.'}), 400
        except (ValueError, TypeError):
            return jsonify({'message': 'Rating must be a valid number between 1 and 5.'}), 400

        # Submit feedback
        rowcount, lastrowid = execute(
            'INSERT INTO feedbacks (student_id, student_name, student_email, rating, message, is_visible) VALUES (%s, %s, %s, %s, %s, %s)',
            [student_id, student_name, student_email, rating, message, 0]
        )
        if rowcount == 0:
            return jsonify({'message': 'Failed to submit feedback. Please try again.'}), 500
        
        return jsonify({'message': 'Thank you for your feedback! Admin will review it shortly.', 'id': lastrowid}), 201
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({'message': f'Server error: {str(e)}'}), 500


@api_bp.route('/admin/feedbacks/<int:feedback_id>/toggle-visibility', methods=['POST'])
def toggle_feedback_visibility(feedback_id):
    feedback = query_one('SELECT is_visible FROM feedbacks WHERE id = %s', [feedback_id])
    if not feedback:
        return jsonify({'message': 'Feedback not found.'}), 404
    
    new_visibility = 1 if not feedback['is_visible'] else 0
    execute('UPDATE feedbacks SET is_visible = %s WHERE id = %s', [new_visibility, feedback_id])
    
    return jsonify({
        'message': f'Feedback {"shown" if new_visibility else "hidden"} successfully.',
        'is_visible': new_visibility
    })


@api_bp.route('/admin/feedbacks/<int:feedback_id>', methods=['DELETE'])
def delete_feedback(feedback_id):
    rowcount, _ = execute('DELETE FROM feedbacks WHERE id = %s', [feedback_id])
    if rowcount == 0:
        return jsonify({'message': 'Feedback not found.'}), 404
    return jsonify({'message': 'Feedback deleted successfully.'})
