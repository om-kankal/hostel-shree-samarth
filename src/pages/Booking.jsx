import { useEffect, useState } from 'react';
import { useToast } from '../components/ToastContext';
import './Booking.css';

export default function Booking() {
    const [rooms, setRooms] = useState([]);
    const [selectedBeds, setSelectedBeds] = useState([]);
    const [registrationNo, setRegistrationNo] = useState('');
    const [notes, setNotes] = useState('');
    const [loading, setLoading] = useState(false);
    const { addToast } = useToast();
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    const fetchRooms = async () => {
        try {
            const response = await fetch(`${API_BASE}/api/booking/rooms`);
            if (!response.ok) {
                throw new Error('Unable to load room data.');
            }
            const data = await response.json();
            setRooms(data);
            setSelectedBeds([]);
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    const handleBedClick = (bed) => {
        if (bed.status !== 'available') {
            addToast('This bed is not available for booking.', 'error');
            return;
        }

        if (selectedBeds.includes(bed.id)) {
            setSelectedBeds([]);
        } else {
            setSelectedBeds([bed.id]);
        }
    };

    const getBedColor = (bedId, status) => {
        if (status !== 'available') return 'var(--error)'; // Red for any unavailable status
        if (selectedBeds.includes(bedId)) return 'var(--selected)'; // Blue for selected
        return 'var(--success)'; // Green for available
    };

    const getBedPosition = (index, totalBeds) => {
        const fiveBedLayout = [
            { x: 24, y: 24 },
            { x: 116, y: 24 },
            { x: 24, y: 112 },
            { x: 116, y: 112 },
            { x: 70, y: 156 },
        ];

        const compactLayout = [
            { x: 24, y: 24 },
            { x: 116, y: 24 },
            { x: 24, y: 112 },
            { x: 116, y: 112 },
        ];

        return totalBeds === 5 ? fiveBedLayout[index] : compactLayout[index] || fiveBedLayout[index];
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!registrationNo) {
            addToast('Please enter your registration number before booking.', 'warning');
            return;
        }
        if (selectedBeds.length === 0) {
            addToast('Please select a bed to book.', 'warning');
            return;
        }

        const bedId = selectedBeds[0];
        setLoading(true);
        try {
            const response = await fetch(`${API_BASE}/api/bookings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registration_no: registrationNo, bed_id: bedId, notes }),
            });
            const data = await response.json();
            if (!response.ok) {
                addToast(data.message || 'Booking submission failed.', 'error');
                return;
            }
            addToast(data.message, 'success');
            setNotes('');
            setRegistrationNo('');
            fetchRooms();
        } catch {
            addToast('Unable to submit booking. Server unreachable.', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="section container animate-fade-in booking-page">
            <h1 className="heading-1 text-center">Book Your Bed</h1>
            <p className="text-center text-muted facilities-subtitle">
                Select an available bed and submit your booking request.
            </p>

            <form className="card booking-form" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="registrationNo">Student Registration Number</label>
                    <input
                        id="registrationNo"
                        value={registrationNo}
                        onChange={(e) => setRegistrationNo(e.target.value)}
                        required
                        placeholder="Enter your registration number"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="notes">Booking Notes</label>
                    <textarea
                        id="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Optional details for the admin"
                        rows={3}
                    />
                </div>
                <button type="submit" className="btn btn-primary btn-lg" disabled={loading || selectedBeds.length === 0}>
                    {loading ? 'Submitting...' : `Confirm Booking (${selectedBeds.length} bed)`}
                </button>
            </form>

            <div className="legend-container card">
                <div className="legend-item">
                    <span className="legend-color available"></span> Available
                </div>
                <div className="legend-item">
                    <span className="legend-color selected"></span> Selected
                </div>
                <div className="legend-item">
                    <span className="legend-color unavailable"></span> Unavailable
                </div>
            </div>

            <div className="rooms-grid">
                {rooms.map((room) => (
                    <div key={room.id} className="card room-card">
                        <h3 className="heading-3 text-center">{room.room_number} · {room.room_type}</h3>
                        <p className="text-center text-muted">Price: Rs {Number(room.price).toFixed(2)} / year • Beds: {room.beds.length} / {room.capacity} • Max 5</p>
                        <svg viewBox="0 0 220 250" className="room-svg" role="img" aria-label={`${room.room_number} bed layout`}>
                            <rect x="10" y="10" width="200" height="218" rx="8" fill="none" stroke="var(--border-color)" strokeWidth="4" />
                            <rect x="90" y="228" width="40" height="10" fill="var(--bg-color)" />

                            {room.beds.map((bed, index) => {
                                const { x, y } = getBedPosition(index, room.beds.length);
                                return (
                                    <g
                                        key={bed.id}
                                        onClick={() => handleBedClick(bed)}
                                        className={bed.status !== 'available' ? 'bed-unavailable' : 'bed-interactive'}
                                    >
                                        <rect x={x} y={y} width="60" height="70" rx="4" fill={getBedColor(bed.id, bed.status)} className="bed-rect" />
                                        <rect x={x + 10} y={y + 10} width="40" height="20" rx="2" fill="rgba(255,255,255,0.3)" />
                                        <text x={x + 30} y={y + 42} fill="white" fontSize="12" textAnchor="middle" fontWeight="bold">{bed.bed_label}</text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                ))}
            </div>
        </div>
    );
}
