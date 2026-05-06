import { useState, useEffect } from 'react';
import { Trash2, Eye, EyeOff } from 'lucide-react';
import { useToast } from './ToastContext';
import { adminHeaders } from '../utils/api';
import './FeedbackManagement.css';

export default function FeedbackManagement() {
    const { addToast } = useToast();
    const [feedbacks, setFeedbacks] = useState([]);
    const [filter, setFilter] = useState('all'); // all, visible, hidden
    const [loading, setLoading] = useState(false);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/admin/feedbacks`, { headers: adminHeaders() });
            if (!res.ok) throw new Error('Failed to fetch feedbacks');
            const data = await res.json();
            setFeedbacks(data);
        } catch (error) {
            addToast(`Error loading feedbacks: ${error.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleVisibility = async (id, currentVis) => {
        try {
            const res = await fetch(`${API_BASE}/api/admin/feedbacks/${id}/toggle-visibility`, {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' })
            });
            if (!res.ok) throw new Error('Failed to update');
            addToast(currentVis ? 'Feedback hidden' : 'Feedback shown on public site', 'success');
            fetchFeedbacks();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        }
    };

    const handleDelete = async (id) => {
        if (!confirm('Are you sure you want to delete this feedback?')) return;

        try {
            const res = await fetch(`${API_BASE}/api/admin/feedbacks/${id}`, { method: 'DELETE', headers: adminHeaders() });
            if (!res.ok) throw new Error('Failed to delete');
            addToast('Feedback deleted', 'success');
            fetchFeedbacks();
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        }
    };

    const filteredFeedbacks = feedbacks.filter(f => {
        if (filter === 'visible') return f.is_visible;
        if (filter === 'hidden') return !f.is_visible;
        return true;
    });

    const stats = {
        total: feedbacks.length,
        visible: feedbacks.filter(f => f.is_visible).length,
        pending: feedbacks.filter(f => !f.is_visible).length
    };

    return (
        <div className="feedback-management">
            <div className="feedback-section-header">
                <h2>⭐ Feedback Management</h2>
                <p>Manage student feedbacks and display them on your website</p>
            </div>

            {/* Statistics */}
            <div className="feedback-stats">
                <div className="stat-card">
                    <span className="stat-number">{stats.total}</span>
                    <span className="stat-label">Total Feedbacks</span>
                </div>
                <div className="stat-card visible">
                    <span className="stat-number">{stats.visible}</span>
                    <span className="stat-label">Public</span>
                </div>
                <div className="stat-card pending">
                    <span className="stat-number">{stats.pending}</span>
                    <span className="stat-label">Pending Review</span>
                </div>
            </div>

            {/* Filters */}
            <div className="feedback-filters">
                <button
                    className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => setFilter('all')}
                >
                    All ({stats.total})
                </button>
                <button
                    className={`filter-btn ${filter === 'visible' ? 'active' : ''}`}
                    onClick={() => setFilter('visible')}
                >
                    Public ({stats.visible})
                </button>
                <button
                    className={`filter-btn ${filter === 'hidden' ? 'active' : ''}`}
                    onClick={() => setFilter('hidden')}
                >
                    Pending ({stats.pending})
                </button>
            </div>

            {/* Feedbacks List */}
            <div className="feedbacks-container">
                {loading ? (
                    <p className="loading">Loading feedbacks...</p>
                ) : filteredFeedbacks.length === 0 ? (
                    <p className="empty-state">
                        {filter === 'all'
                            ? 'No feedbacks yet. Students can submit feedbacks through the website.'
                            : `No ${filter} feedbacks found.`}
                    </p>
                ) : (
                    <div className="feedbacks-list">
                        {filteredFeedbacks.map((feedback) => (
                            <div key={feedback.id} className={`feedback-card ${feedback.is_visible ? 'visible' : 'hidden'}`}>
                                <div className="feedback-header">
                                    <div className="feedback-info">
                                        <h4>{feedback.student_name}</h4>
                                        <p className="email">{feedback.student_email}</p>
                                        {feedback.rating && (
                                            <div className="rating">
                                                {'⭐'.repeat(feedback.rating)}
                                                <span className="rating-text">{feedback.rating}/5</span>
                                            </div>
                                        )}
                                    </div>
                                    <div className="feedback-date">
                                        {new Date(feedback.created_at).toLocaleDateString()}
                                    </div>
                                </div>

                                <div className="feedback-message">
                                    {feedback.message}
                                </div>

                                <div className="feedback-actions">
                                    <span className={`status-badge ${feedback.is_visible ? 'visible' : 'pending'}`}>
                                        {feedback.is_visible ? '✓ Public' : '⏳ Pending Review'}
                                    </span>
                                    <button
                                        onClick={() => handleToggleVisibility(feedback.id, feedback.is_visible)}
                                        title={feedback.is_visible ? 'Hide from public' : 'Show on public website'}
                                        className="btn-action"
                                    >
                                        {feedback.is_visible ? (
                                            <>
                                                <Eye size={18} />
                                                Hide
                                            </>
                                        ) : (
                                            <>
                                                <EyeOff size={18} />
                                                Show
                                            </>
                                        )}
                                    </button>
                                    <button
                                        onClick={() => handleDelete(feedback.id)}
                                        className="btn-action delete"
                                        title="Delete feedback"
                                    >
                                        <Trash2 size={18} />
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
