import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from './ToastContext';
import { AlertCircle, CheckCircle, Clock, Edit2, Info, Trash2, X } from 'lucide-react';
import { adminHeaders } from '../utils/api';
import './BookingVisualManagement.css';

const STATUSES = ['pending', 'allocated', 'completed', 'cancelled'];

const formatStatus = (status) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
};

const formatDateTime = (value) => {
    if (!value) return 'Not recorded';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not recorded';
    return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
};

const getStudentName = (booking) => booking.student_name || booking.student_registration || 'Unknown student';

const getBedLabel = (booking) => booking.selected_bed_label || booking.allocated_bed || 'No bed selected';

export default function BookingVisualManagement() {
    const { addToast } = useToast();
    const [bookings, setBookings] = useState([]);
    const [rooms, setRooms] = useState([]);
    const [editingBooking, setEditingBooking] = useState(null);
    const [selectedBedId, setSelectedBedId] = useState('');
    const [newStatus, setNewStatus] = useState('pending');
    const [studentInfo, setStudentInfo] = useState(null);
    const [studentInfoStep, setStudentInfoStep] = useState(0);
    const [loading, setLoading] = useState(true);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const [bookingsRes, roomsRes] = await Promise.all([
                fetch('/api/admin/bookings', { headers: adminHeaders() }),
                fetch('/api/admin/rooms', { headers: adminHeaders() }),
            ]);

            if (!bookingsRes.ok || !roomsRes.ok) {
                throw new Error('Failed to fetch booking data.');
            }

            const bookingsData = await bookingsRes.json();
            const roomsData = await roomsRes.json();

            setBookings(Array.isArray(bookingsData) ? bookingsData : []);
            setRooms(Array.isArray(roomsData) ? roomsData : []);
        } catch (error) {
            addToast(error.message || 'Unable to load booking data.', 'error');
        } finally {
            setLoading(false);
        }
    }, [addToast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const availableBeds = useMemo(() => rooms.flatMap((room) => (room.beds || [])
        .filter((bed) => bed.status === 'available')
        .map((bed) => ({
            ...bed,
            room_number: room.room_number,
            room_type: room.room_type,
        }))
    ), [rooms]);

    const assignableBeds = useMemo(() => {
        if (!editingBooking?.bed_id) return availableBeds;

        const requestedBed = rooms
            .flatMap((room) => (room.beds || []).map((bed) => ({
                ...bed,
                room_number: room.room_number,
                room_type: room.room_type,
            })))
            .find((bed) => Number(bed.id) === Number(editingBooking.bed_id));

        if (!requestedBed || availableBeds.some((bed) => Number(bed.id) === Number(requestedBed.id))) {
            return availableBeds;
        }

        return [requestedBed, ...availableBeds];
    }, [availableBeds, editingBooking, rooms]);

    const pendingWithoutBed = useMemo(
        () => bookings.filter((booking) => !booking.bed_id && booking.status !== 'cancelled'),
        [bookings]
    );

    const bookingsByRoom = useMemo(() => rooms.map((room) => ({
        ...room,
        bookings: bookings.filter((booking) => Number(booking.room_id) === Number(room.id)),
    })), [bookings, rooms]);

    const activeBookingForBed = (bedId) => bookings.find((booking) => (
        Number(booking.bed_id) === Number(bedId) && booking.status !== 'cancelled'
    ));

    const stats = useMemo(() => STATUSES.reduce((result, status) => ({
        ...result,
        [status]: bookings.filter((booking) => booking.status === status).length,
    }), {}), [bookings]);

    const getStatusColor = (status) => {
        switch (status) {
            case 'allocated':
                return 'booking-allocated';
            case 'completed':
                return 'booking-completed';
            case 'cancelled':
                return 'booking-cancelled';
            case 'pending':
            default:
                return 'booking-pending';
        }
    };

    const getStatusIcon = (status) => {
        switch (status) {
            case 'allocated':
            case 'completed':
                return <CheckCircle size={20} />;
            case 'cancelled':
                return <AlertCircle size={20} />;
            case 'pending':
            default:
                return <Clock size={20} />;
        }
    };

    const openEditor = (booking) => {
        setEditingBooking(booking);
        setNewStatus(booking.status || 'pending');
        setSelectedBedId(booking.bed_id ? String(booking.bed_id) : String(availableBeds[0]?.id || ''));
    };

    const closeEditor = () => {
        setEditingBooking(null);
        setSelectedBedId('');
        setNewStatus('pending');
    };

    const updateBookingStatus = async (bookingId, status) => {
        try {
            const res = await fetch(`/api/admin/bookings/${bookingId}/update-status`, {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ status }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Failed to update booking status.');

            addToast(data.message || `Booking updated to ${status}.`, 'success');
            closeEditor();
            fetchData();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const assignBedToBooking = async () => {
        if (!editingBooking) return;
        if (!selectedBedId) {
            addToast('Please select a bed before assigning.', 'error');
            return;
        }

        if (!window.confirm('Confirm bed assignment for this booking?')) return;

        try {
            const res = await fetch(`/api/admin/bookings/${editingBooking.id}/allocate-bed`, {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ bed_id: selectedBedId }),
            });

            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Failed to assign bed.');

            addToast(data.message || 'Bed assigned successfully.', 'success');
            closeEditor();
            fetchData();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const unassignBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to unassign this booking?')) return;

        try {
            const res = await fetch(`/api/admin/bookings/${bookingId}/unassign`, {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Failed to unassign booking.');

            addToast(data.message || 'Booking unassigned successfully.', 'success');
            fetchData();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const deleteBooking = async (bookingId) => {
        if (!window.confirm('Are you sure you want to delete this booking?')) return;

        try {
            const res = await fetch(`/api/admin/bookings/${bookingId}`, {
                method: 'DELETE',
                headers: adminHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Failed to delete booking.');

            addToast(data.message || 'Booking deleted successfully.', 'success');
            fetchData();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const openStudentInfo = async (booking) => {
        try {
            const res = await fetch(`/api/admin/bookings/${booking.id}/student-info`, { headers: adminHeaders() });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.message || 'Student information is not available yet.');

            setStudentInfo(data);
            setStudentInfoStep(0);
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const closeStudentInfo = () => {
        setStudentInfo(null);
        setStudentInfoStep(0);
    };

    const renderBookingCard = (booking) => (
        <article key={booking.id} className={`booking-card ${getStatusColor(booking.status)}`}>
            <div className="booking-card-header">
                <div className="booking-status-icon" aria-hidden="true">
                    {getStatusIcon(booking.status)}
                </div>
                <span className="booking-status-pill">{formatStatus(booking.status)}</span>
            </div>

            <div className="booking-content">
                <h4 className="student-name">{getStudentName(booking)}</h4>
                <dl className="booking-details">
                    <div>
                        <dt>Registration</dt>
                        <dd>{booking.student_registration || 'Not available'}</dd>
                    </div>
                    <div>
                        <dt>Room</dt>
                        <dd>{booking.room_number ? `Room ${booking.room_number}` : 'Not assigned'}</dd>
                    </div>
                    <div>
                        <dt>Bed</dt>
                        <dd>{getBedLabel(booking)}</dd>
                    </div>
                    <div>
                        <dt>Fee</dt>
                        <dd>{booking.room_price ? `Rs ${Number(booking.room_price).toFixed(2)}` : 'Not available'}</dd>
                    </div>
                    <div>
                        <dt>Requested</dt>
                        <dd>{formatDateTime(booking.requested_at)}</dd>
                    </div>
                </dl>
                {booking.notes && <p className="booking-notes">{booking.notes}</p>}
            </div>

            <div className="booking-actions">
                <button className="btn-small btn-info-booking" onClick={() => openStudentInfo(booking)}>
                    <Info size={14} />
                    Info
                </button>
                <button className="btn-small btn-edit-booking" onClick={() => openEditor(booking)}>
                    <Edit2 size={14} />
                    Manage
                </button>
                {booking.bed_id && (
                    <button className="btn-small btn-unassign-booking" onClick={() => unassignBooking(booking.id)}>
                        Unassign
                    </button>
                )}
                <button className="btn-small btn-delete-booking" onClick={() => deleteBooking(booking.id)} aria-label={`Delete booking for ${getStudentName(booking)}`}>
                    <Trash2 size={14} />
                </button>
            </div>
        </article>
    );

    const renderBedSlot = (bed) => {
        const booking = activeBookingForBed(bed.id);
        if (booking) {
            return renderBookingCard(booking);
        }

        return (
            <article key={`bed-${bed.id}`} className="booking-card booking-empty-bed">
                <div className="booking-card-header">
                    <div className="booking-status-icon" aria-hidden="true">
                        <AlertCircle size={20} />
                    </div>
                    <span className="booking-status-pill">{formatStatus(bed.status)}</span>
                </div>
                <div className="booking-content">
                    <h4 className="student-name">{bed.bed_label}</h4>
                    <dl className="booking-details">
                        <div>
                            <dt>Student</dt>
                            <dd>No booking</dd>
                        </div>
                        <div>
                            <dt>Bed</dt>
                            <dd>{bed.bed_label}</dd>
                        </div>
                        <div>
                            <dt>Status</dt>
                            <dd>{bed.status === 'available' ? 'Available for booking' : formatStatus(bed.status)}</dd>
                        </div>
                    </dl>
                </div>
            </article>
        );
    };

    return (
        <div className="booking-visual-management">
            <div className="booking-header">
                <div>
                    <h2>Booking Requests</h2>
                    <p>Review every booking with student, room, bed, status, notes, and request time in one place.</p>
                </div>
                <button className="btn btn-secondary" onClick={fetchData} disabled={loading}>
                    {loading ? 'Refreshing...' : 'Refresh'}
                </button>
            </div>

            <div className="booking-stats">
                {STATUSES.map((status) => (
                    <div key={status} className={`stat-card ${getStatusColor(status)}`}>
                        <strong>{stats[status] || 0}</strong>
                        <span>{formatStatus(status)}</span>
                    </div>
                ))}
            </div>

            {loading ? (
                <div className="booking-empty-state">Loading booking requests...</div>
            ) : rooms.length === 0 ? (
                <div className="booking-empty-state">No rooms found. Add rooms first.</div>
            ) : (
                <>
                    {pendingWithoutBed.length > 0 && (
                        <section className="unassigned-section">
                            <div className="booking-room-header">
                                <h3>Needs Bed Assignment</h3>
                                <span className="room-type">{pendingWithoutBed.length} request{pendingWithoutBed.length === 1 ? '' : 's'}</span>
                            </div>
                            <div className="bookings-grid">
                                {pendingWithoutBed.map(renderBookingCard)}
                            </div>
                        </section>
                    )}

                    <div className="booking-rooms-grid">
                        {bookingsByRoom.map((room) => (
                            <section key={room.id} className="booking-room-section">
                                <div className="booking-room-header">
                                    <div>
                                        <h3>Room {room.room_number}</h3>
                                        <p>{room.beds?.length || 0} beds configured, {room.bookings.length} booking{room.bookings.length === 1 ? '' : 's'} linked</p>
                                    </div>
                                    <span className="room-type">{room.room_type}</span>
                                </div>

                                {!room.beds || room.beds.length === 0 ? (
                                    <div className="no-bookings">
                                        <AlertCircle size={32} />
                                        <p>No beds configured for this room</p>
                                    </div>
                                ) : (
                                    <div className="bookings-grid">
                                        {room.beds.map(renderBedSlot)}
                                    </div>
                                )}
                            </section>
                        ))}
                    </div>
                </>
            )}

            {editingBooking && (
                <div className="booking-edit-modal" role="dialog" aria-modal="true" aria-labelledby="bookingModalTitle">
                    <div className="booking-edit-form">
                        <h3 id="bookingModalTitle">Manage Booking</h3>
                        <div className="booking-modal-summary">
                            <p><strong>Student:</strong> {getStudentName(editingBooking)}</p>
                            <p><strong>Registration:</strong> {editingBooking.student_registration || 'Not available'}</p>
                            <p><strong>Room:</strong> {editingBooking.room_number ? `Room ${editingBooking.room_number}` : 'Not assigned'}</p>
                            <p><strong>Bed:</strong> {getBedLabel(editingBooking)}</p>
                        </div>

                        <label htmlFor="bookingStatus">Booking Status</label>
                        <select
                            id="bookingStatus"
                            value={newStatus}
                            onChange={(event) => setNewStatus(event.target.value)}
                        >
                            {STATUSES.map((status) => (
                                <option key={status} value={status}>{formatStatus(status)}</option>
                            ))}
                        </select>

                        <div className="bed-select">
                            <label htmlFor="bedSelect">Assign Requested Bed or Another Available Bed</label>
                            <select
                                id="bedSelect"
                                value={selectedBedId}
                                onChange={(event) => setSelectedBedId(event.target.value)}
                            >
                                <option value="">Choose a bed</option>
                                {assignableBeds.map((bed) => (
                                    <option key={bed.id} value={bed.id}>
                                        Room {bed.room_number} - {bed.bed_label} ({bed.room_type}, {bed.status})
                                    </option>
                                ))}
                            </select>
                            {assignableBeds.length === 0 && (
                                <small>No available beds are currently open for assignment.</small>
                            )}
                        </div>

                        <div className="modal-actions">
                            <button className="btn btn-primary" onClick={() => updateBookingStatus(editingBooking.id, newStatus)}>
                                Update Status
                            </button>
                            <button className="btn btn-primary" onClick={assignBedToBooking} disabled={!selectedBedId}>
                                Assign Bed
                            </button>
                            <button className="btn btn-secondary" onClick={closeEditor}>
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {studentInfo && (
                <StudentInfoWizard
                    data={studentInfo}
                    step={studentInfoStep}
                    setStep={setStudentInfoStep}
                    onClose={closeStudentInfo}
                />
            )}
        </div>
    );
}

function StudentInfoWizard({ data, step, setStep, onClose }) {
    const profile = data.profile || {};
    const student = data.student || {};
    const hostel = data.hostel || {};
    const booking = data.booking || {};
    const steps = [
        {
            title: 'Basic Personal Information',
            rows: [
                ['Full Name', [profile.first_name, profile.middle_name, profile.last_name].filter(Boolean).join(' ') || student.name],
                ['Gender', profile.gender || 'male'],
                ['Date of Birth', profile.date_of_birth],
                ['Contact Number', student.phone],
                ['Email Address', student.email],
            ],
        },
        {
            title: 'Academic & Identity Verification',
            rows: [
                ['University/College ID Number', student.registration_no],
                ['Course/Major', profile.course_major],
                ['Current Year/Semester', profile.current_year_semester],
                ['Government ID Type', profile.government_id_type],
                ['Government ID Proof', profile.government_id_file_name || 'Not uploaded'],
            ],
        },
        {
            title: 'Emergency Contact Details',
            rows: [
                ['Guardian/Parent Name', profile.guardian_name],
                ['Relationship', profile.guardian_relationship],
                ['Guardian Phone Number', profile.guardian_phone],
                ['Permanent Address', profile.permanent_address],
            ],
        },
        {
            title: 'Hostel-Specific Details',
            rows: [
                ['Room Number', hostel.room_number],
                ['Bed Number', hostel.bed_label],
                ['Booking Status', booking.status],
                ['Check-in / Admission Date', profile.admission_date],
                ['Food Preference', profile.food_preference],
                ['Food Allergies / Notes', profile.food_allergies],
            ],
        },
    ];
    const currentStep = steps[step];

    return (
        <div className="booking-edit-modal" role="dialog" aria-modal="true" aria-labelledby="studentInfoTitle">
            <div className="student-info-wizard">
                <div className="student-info-header">
                    <div>
                        <h3 id="studentInfoTitle">Student Information</h3>
                        <p>{student.name || student.registration_no}</p>
                    </div>
                    <button className="wizard-close" onClick={onClose} aria-label="Close student information">
                        <X size={20} />
                    </button>
                </div>

                <div className="wizard-steps">
                    {steps.map((item, index) => (
                        <button
                            key={item.title}
                            className={index === step ? 'active' : ''}
                            onClick={() => setStep(index)}
                        >
                            {index + 1}
                        </button>
                    ))}
                </div>

                <section className="wizard-panel">
                    <h4>{currentStep.title}</h4>
                    <dl className="wizard-info-grid">
                        {currentStep.rows.map(([label, value]) => (
                            <div key={label}>
                                <dt>{label}</dt>
                                <dd>{value || 'Not provided'}</dd>
                            </div>
                        ))}
                    </dl>
                </section>

                {profile.government_id_file_data && step === 1 && (
                    <a
                        className="btn btn-secondary"
                        href={profile.government_id_file_data}
                        target="_blank"
                        rel="noopener noreferrer"
                    >
                        View Uploaded ID
                    </a>
                )}

                <div className="modal-actions">
                    <button className="btn btn-secondary" onClick={() => setStep(Math.max(step - 1, 0))} disabled={step === 0}>
                        Previous
                    </button>
                    <button className="btn btn-primary" onClick={() => step === steps.length - 1 ? onClose() : setStep(step + 1)}>
                        {step === steps.length - 1 ? 'Done' : 'Next'}
                    </button>
                </div>
            </div>
        </div>
    );
}
