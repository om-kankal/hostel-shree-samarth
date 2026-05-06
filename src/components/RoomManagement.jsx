import { useEffect, useState } from 'react';
import { useToast } from './ToastContext';
import { Plus, Edit2, Trash2, Save, X } from 'lucide-react';
import { adminHeaders } from '../utils/api';
import './RoomManagement.css';

const MAX_BEDS_PER_ROOM = 5;

export default function RoomManagement() {
    const { addToast } = useToast();
    const [rooms, setRooms] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [editingRoom, setEditingRoom] = useState(null);
    const [formData, setFormData] = useState({
        room_number: '',
        room_type: 'shared',
        capacity: MAX_BEDS_PER_ROOM,
        price: 0
    });

    const fetchRooms = async () => {
        try {
            const res = await fetch('/api/admin/rooms', { headers: adminHeaders() });
            if (!res.ok) throw new Error('Failed to fetch rooms.');
            const data = await res.json();
            setRooms(data);
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    useEffect(() => {
        fetchRooms();
    }, []);

    const isValidCapacity = (capacity) => Number.isInteger(capacity) && capacity >= 1 && capacity <= MAX_BEDS_PER_ROOM;

    const handleAddRoom = async () => {
        if (!formData.room_number.trim()) {
            addToast('Room number is required.', 'error');
            return;
        }

        if (!isValidCapacity(formData.capacity)) {
            addToast(`Room capacity must be between 1 and ${MAX_BEDS_PER_ROOM} beds.`, 'error');
            return;
        }

        try {
            const res = await fetch('/api/admin/rooms', {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            addToast('Room added successfully.', 'success');
            setFormData({ room_number: '', room_type: 'shared', capacity: MAX_BEDS_PER_ROOM, price: 0 });
            setShowAddForm(false);
            // Small delay to ensure beds are created before fetching
            setTimeout(() => fetchRooms(), 500);
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const handleUpdateRoom = async () => {
        if (!formData.room_number.trim()) {
            addToast('Room number is required.', 'error');
            return;
        }

        if (!isValidCapacity(formData.capacity)) {
            addToast(`Room capacity must be between 1 and ${MAX_BEDS_PER_ROOM} beds.`, 'error');
            return;
        }

        try {
            const res = await fetch(`/api/admin/rooms/${editingRoom.id}`, {
                method: 'PUT',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify(formData),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            addToast('Room updated successfully.', 'success');
            setEditingRoom(null);
            setFormData({ room_number: '', room_type: 'shared', capacity: MAX_BEDS_PER_ROOM, price: 0 });
            fetchRooms();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const handleDeleteRoom = async (roomId) => {
        if (window.confirm('Are you sure you want to delete this room? All beds will be deleted.')) {
            try {
                const res = await fetch(`/api/admin/rooms/${roomId}`, { method: 'DELETE', headers: adminHeaders() });
                const data = await res.json();
                if (!res.ok) throw new Error(data.message);

                addToast('Room deleted successfully.', 'success');
                fetchRooms();
            } catch (error) {
                addToast(error.message, 'error');
            }
        }
    };

    const handleBedStatusChange = async (roomId, bedId, bedLabel, currentStatus, placeholder, needsCreation) => {
        if (placeholder && needsCreation) {
            // Create beds for this room
            const confirmed = window.confirm('Beds need to be created for this room. Create them now?');
            if (!confirmed) return;

            try {
                const room = rooms.find(r => r.id === roomId);
                if (!room) {
                    addToast('Room not found.', 'error');
                    return;
                }

                // Create beds for the room
                for (let i = 1; i <= room.capacity; i++) {
                    const bedLabel = `${room.room_number}-B${i}`;
                    const res = await fetch('/api/admin/beds', {
                        method: 'POST',
                        headers: adminHeaders({ 'Content-Type': 'application/json' }),
                        body: JSON.stringify({
                            room_id: roomId,
                            bed_label: bedLabel,
                        }),
                    });
                    if (!res.ok) {
                        const data = await res.json();
                        throw new Error(data.message || `Failed to create bed ${bedLabel}`);
                    }
                }

                addToast(`Created ${room.capacity} beds for room ${room.room_number}.`, 'success');
                fetchRooms();
            } catch (error) {
                addToast(error.message, 'error');
            }
            return;
        }

        if (placeholder) {
            addToast('This bed placeholder cannot be updated until it is created on the server.', 'info');
            return;
        }

        if (currentStatus === 'booked') {
            addToast('This bed is linked to a booking. Manage it from the Bookings section.', 'info');
            return;
        }

        const nextStatus = currentStatus === 'available' ? 'occupied' : 'available';
        const confirmation = window.confirm(
            `Are you sure you want to ${nextStatus === 'occupied' ? 'assign' : 'unassign'} ${bedLabel}?`
        );
        if (!confirmation) return;

        try {
            const res = await fetch(`/api/admin/beds/${bedId}`, {
                method: 'PUT',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({ status: nextStatus }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.message);

            addToast(`Bed ${bedLabel} updated to ${nextStatus}.`, 'success');
            fetchRooms();
        } catch (error) {
            addToast(error.message, 'error');
        }
    };

    const createRoomBeds = (room) => {
        // If room has beds in database, return them
        if (room.beds && room.beds.length > 0) {
            return room.beds;
        }

        // If room has no beds but should have them based on capacity, show message
        if (room.capacity > 0) {
            return [{
                id: `needs-creation-${room.id}`,
                bed_label: `Beds need to be created`,
                status: 'available',
                placeholder: true,
                needsCreation: true,
            }];
        }

        // Fallback for rooms with no capacity
        return [];
    };

    const getBedColor = (status) => {
        if (status === 'available') return 'bed-available';
        if (status === 'booked') return 'bed-booked';
        if (status === 'occupied') return 'bed-occupied';
        return 'bed-selected';
    };

    const getBedStatusLabel = (status) => {
        if (status === 'booked') return 'allocated';
        return status;
    };

    return (
        <div className="room-management">
            <div className="room-management-header">
                <h2>Room Inventory Management</h2>
                <button className="btn btn-primary" onClick={() => setShowAddForm(true)}>
                    <Plus size={20} /> Add New Room
                </button>
            </div>

            {showAddForm && (
                <div className="room-form-modal">
                    <div className="room-form">
                        <h3>Add New Room</h3>
                        <label htmlFor="roomNumber">Room Number</label>
                        <input
                            id="roomNumber"
                            type="text"
                            placeholder="Room Number (e.g., 101)"
                            value={formData.room_number}
                            onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                        />
                        <label htmlFor="roomType">Room Type</label>
                        <select
                            id="roomType"
                            value={formData.room_type}
                            onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                        >
                            <option value="shared">Shared</option>
                            <option value="private">Private</option>
                            <option value="dormitory">Dormitory</option>
                        </select>
                        <label htmlFor="roomCapacity">Number of Beds</label>
                        <input
                            id="roomCapacity"
                            type="number"
                            placeholder="Maximum 5 beds"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
                            min="1"
                            max={MAX_BEDS_PER_ROOM}
                        />
                        <label htmlFor="roomPrice">Price per Year</label>
                        <input
                            id="roomPrice"
                            type="number"
                            placeholder="Price per Year"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            step="0.01"
                            min="0"
                        />
                        <div className="form-actions">
                            <button className="btn btn-primary" onClick={handleAddRoom}>
                                <Save size={18} /> Create Room
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowAddForm(false)}>
                                <X size={18} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {editingRoom && (
                <div className="room-form-modal">
                    <div className="room-form">
                        <h3>Edit Room {editingRoom.room_number}</h3>
                        <label htmlFor="editRoomNumber">Room Number</label>
                        <input
                            id="editRoomNumber"
                            type="text"
                            placeholder="Room Number"
                            value={formData.room_number}
                            onChange={(e) => setFormData({ ...formData, room_number: e.target.value })}
                        />
                        <label htmlFor="editRoomType">Room Type</label>
                        <select
                            id="editRoomType"
                            value={formData.room_type}
                            onChange={(e) => setFormData({ ...formData, room_type: e.target.value })}
                        >
                            <option value="shared">Shared</option>
                            <option value="private">Private</option>
                            <option value="dormitory">Dormitory</option>
                        </select>
                        <label htmlFor="editRoomCapacity">Number of Beds</label>
                        <input
                            id="editRoomCapacity"
                            type="number"
                            placeholder="Maximum 5 beds"
                            value={formData.capacity}
                            onChange={(e) => setFormData({ ...formData, capacity: parseInt(e.target.value, 10) || 1 })}
                            min="1"
                            max={MAX_BEDS_PER_ROOM}
                        />
                        <label htmlFor="editRoomPrice">Price per Year</label>
                        <input
                            id="editRoomPrice"
                            type="number"
                            placeholder="Price per Year"
                            value={formData.price}
                            onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                            step="0.01"
                            min="0"
                        />
                        <div className="form-actions">
                            <button className="btn btn-primary" onClick={handleUpdateRoom}>
                                <Save size={18} /> Update Room
                            </button>
                            <button className="btn btn-secondary" onClick={() => {
                                setEditingRoom(null);
                                setFormData({ room_number: '', room_type: 'shared', capacity: MAX_BEDS_PER_ROOM, price: 0 });
                            }}>
                                <X size={18} /> Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="rooms-grid">
                {rooms.map((room) => (
                    <div key={room.id} className="room-card">
                        <div className="room-header">
                            <h3>Room {room.room_number}</h3>
                            <div className="room-actions">
                                <button
                                    className="btn btn-small btn-edit"
                                    onClick={() => {
                                        setEditingRoom(room);
                                        setFormData({
                                            room_number: room.room_number,
                                            room_type: room.room_type,
                                            capacity: room.capacity,
                                            price: room.price
                                        });
                                    }}
                                >
                                    <Edit2 size={16} />
                                </button>
                                <button
                                    className="btn btn-small btn-delete"
                                    onClick={() => handleDeleteRoom(room.id)}
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                        <div className="room-info">
                            <span className="room-type">{room.room_type}</span>
                            <span className="room-price">Rs {Number(room.price).toFixed(2)}/year</span>
                        </div>
                        <div className="room-capacity-info">
                            <span>{room.beds?.length || 0} of {room.capacity} beds ready</span>
                            <span>Max {MAX_BEDS_PER_ROOM} beds</span>
                        </div>
                        <div className="beds-grid">
                            {createRoomBeds(room).map((bed) => (
                                <div
                                    key={bed.id}
                                    className={`bed ${getBedColor(bed.status)}`}
                                    title={`${bed.bed_label} - ${bed.status}`}
                                    onClick={() => handleBedStatusChange(room.id, bed.id, bed.bed_label, bed.status, bed.placeholder, bed.needsCreation)}
                                >
                                    <span>{bed.bed_label}</span>
                                    <small>{getBedStatusLabel(bed.status)}</small>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>

            <div className="legend">
                <div className="legend-item">
                    <div className="legend-color bed-available"></div>
                    <span>Available</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color bed-booked"></div>
                    <span>Allocated</span>
                </div>
                <div className="legend-item">
                    <div className="legend-color bed-occupied"></div>
                    <span>Occupied</span>
                </div>
            </div>
        </div>
    );
}
