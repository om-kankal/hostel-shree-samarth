import re
from functools import wraps
from flask import request, jsonify, g
import hashlib
import hmac
import secrets
import os
import time
import base64
import json

# Security utilities for authentication and validation

SECRET_KEY = os.getenv('SECRET_KEY') or os.getenv('APP_SECRET_KEY') or 'dev-only-change-this-secret'
TOKEN_MAX_AGE_SECONDS = int(os.getenv('TOKEN_MAX_AGE_SECONDS', '28800'))

class ValidationError(Exception):
    """Custom exception for validation errors"""
    pass


def hash_password(password):
    """Hash password using PBKDF2 with SHA256"""
    if not password or len(password) < 6:
        raise ValidationError('Password must be at least 6 characters.')
    
    salt = secrets.token_hex(16)  # 32 char hex = 16 bytes
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode(), salt.encode(), 100000)
    return f"{salt}${pw_hash.hex()}"


def verify_password(stored_hash, provided_password):
    """Verify provided password against stored hash"""
    try:
        salt, pw_hash = stored_hash.split('$')
        provided_hash = hashlib.pbkdf2_hmac('sha256', provided_password.encode(), salt.encode(), 100000)
        return hmac.compare_digest(pw_hash, provided_hash.hex())
    except:
        return False


def is_password_hash(stored_hash):
    return isinstance(stored_hash, str) and '$' in stored_hash and len(stored_hash.split('$', 1)[0]) >= 16


def verify_password_or_legacy(stored_hash, provided_password):
    """Verify modern hashes and legacy plaintext seed passwords."""
    if is_password_hash(stored_hash):
        return verify_password(stored_hash, provided_password)
    return hmac.compare_digest(str(stored_hash or ''), str(provided_password or ''))


def validate_email(email):
    """Validate email format"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    if not re.match(pattern, email):
        raise ValidationError('Invalid email format.')
    if len(email) > 150:
        raise ValidationError('Email is too long.')
    return email.strip().lower()


def validate_phone(phone):
    """Validate phone format"""
    if phone:
        phone = phone.strip()
        if not re.match(r'^[0-9\-\+\s\(\)]{10,}$', phone):
            raise ValidationError('Invalid phone number format.')
        if len(phone) > 20:
            raise ValidationError('Phone number is too long.')
    return phone


def validate_string(value, field_name, max_length=255, min_length=1):
    """Validate string input"""
    if not isinstance(value, str):
        raise ValidationError(f'{field_name} must be a string.')
    
    value = value.strip()
    
    if len(value) < min_length:
        raise ValidationError(f'{field_name} cannot be empty.')
    
    if len(value) > max_length:
        raise ValidationError(f'{field_name} exceeds maximum length of {max_length}.')
    
    # Check for potential XSS
    if '<script' in value.lower() or 'javascript:' in value.lower():
        raise ValidationError(f'{field_name} contains invalid content.')
    
    return value


def validate_password(password):
    """Validate password strength"""
    if not password or len(password) < 8:
        raise ValidationError('Password must be at least 8 characters.')
    if len(password) > 100:
        raise ValidationError('Password is too long.')
    if not re.search(r'[A-Za-z]', password) or not re.search(r'\d', password):
        raise ValidationError('Password must include at least one letter and one number.')
    return password


def validate_integer(value, field_name, min_val=None, max_val=None):
    """Validate integer input"""
    try:
        value = int(value)
    except (ValueError, TypeError):
        raise ValidationError(f'{field_name} must be a valid integer.')
    
    if min_val is not None and value < min_val:
        raise ValidationError(f'{field_name} must be at least {min_val}.')
    
    if max_val is not None and value > max_val:
        raise ValidationError(f'{field_name} cannot exceed {max_val}.')
    
    return value


def generate_session_token():
    """Generate a secure session token"""
    return secrets.token_urlsafe(32)


def _b64encode(data):
    raw = json.dumps(data, separators=(',', ':')).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip('=')


def _b64decode(data):
    padded = data + '=' * (-len(data) % 4)
    return json.loads(base64.urlsafe_b64decode(padded.encode()).decode())


def generate_auth_token(user_id, role, extra=None):
    payload = {
        'sub': int(user_id),
        'role': role,
        'iat': int(time.time()),
        'nonce': secrets.token_urlsafe(12),
        **(extra or {}),
    }
    encoded_payload = _b64encode(payload)
    signature = hmac.new(SECRET_KEY.encode(), encoded_payload.encode(), hashlib.sha256).digest()
    encoded_signature = base64.urlsafe_b64encode(signature).decode().rstrip('=')
    return f'{encoded_payload}.{encoded_signature}'


def verify_auth_token(token, required_role=None):
    try:
        encoded_payload, encoded_signature = token.split('.', 1)
        expected = hmac.new(SECRET_KEY.encode(), encoded_payload.encode(), hashlib.sha256).digest()
        actual = base64.urlsafe_b64decode((encoded_signature + '=' * (-len(encoded_signature) % 4)).encode())
        if not hmac.compare_digest(expected, actual):
            return None

        payload = _b64decode(encoded_payload)
        if int(time.time()) - int(payload.get('iat', 0)) > TOKEN_MAX_AGE_SECONDS:
            return None
        if required_role and payload.get('role') != required_role:
            return None
        return payload
    except Exception:
        return None


def get_bearer_payload(required_role=None):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None
    return verify_auth_token(auth_header[7:], required_role)


def check_admin_auth(f):
    """Decorator to check admin authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        payload = get_bearer_payload('admin')
        if not payload:
            return jsonify({'message': 'Admin authentication required.'}), 401
        g.auth_user = payload
        return f(*args, **kwargs)
    
    return decorated_function


def check_student_auth(f):
    """Decorator to check student authentication"""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        payload = get_bearer_payload('student')
        if not payload:
            return jsonify({'message': 'Student authentication required.'}), 401
        g.auth_user = payload
        return f(*args, **kwargs)
    
    return decorated_function
