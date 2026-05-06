import { useState } from 'react';
import { useToast } from './ToastContext';
import './StudentFeedback.css';

export default function StudentFeedback() {
    const { addToast } = useToast();
    const [formData, setFormData] = useState({
        student_name: '',
        student_email: '',
        rating: 5,
        message: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: name === 'rating' ? parseInt(value) : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!formData.student_name.trim() || !formData.student_email.trim() || !formData.message.trim()) {
            addToast('Please fill in all required fields', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const res = await fetch(`${API_BASE}/api/feedbacks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            if (!res.ok) {
                const data = await res.json();
                throw new Error(data.message || 'Failed to submit feedback');
            }

            addToast('Thank you for your feedback! We appreciate your comments.', 'success');
            setFormData({
                student_name: '',
                student_email: '',
                rating: 5,
                message: ''
            });
        } catch (error) {
            addToast(`Error: ${error.message}`, 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="feedback-form-section">
            <div className="feedback-container">
                <div className="feedback-form-wrapper">
                    <h2>Share Your Experience</h2>
                    <p>Help us improve by sharing your feedback about our PG accommodation</p>

                    <form onSubmit={handleSubmit} className="feedback-form">
                        <div className="form-group">
                            <label htmlFor="student_name">Your Name *</label>
                            <input
                                id="student_name"
                                type="text"
                                name="student_name"
                                value={formData.student_name}
                                onChange={handleInputChange}
                                placeholder="Enter your name"
                                maxLength="150"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="student_email">Email Address *</label>
                            <input
                                id="student_email"
                                type="email"
                                name="student_email"
                                value={formData.student_email}
                                onChange={handleInputChange}
                                placeholder="Enter your email"
                                maxLength="150"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label htmlFor="rating">Rating</label>
                            <div className="rating-input">
                                {[1, 2, 3, 4, 5].map((num) => (
                                    <label key={num} className="rating-label">
                                        <input
                                            type="radio"
                                            name="rating"
                                            value={num}
                                            checked={formData.rating === num}
                                            onChange={handleInputChange}
                                        />
                                        <span className="star">{'⭐'.repeat(num)}</span>
                                    </label>
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label htmlFor="message">Your Feedback *</label>
                            <textarea
                                id="message"
                                name="message"
                                value={formData.message}
                                onChange={handleInputChange}
                                placeholder="Share your feedback about our PG accommodation, facilities, services, etc."
                                rows="5"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={submitting}
                            className="btn-submit"
                        >
                            {submitting ? 'Submitting...' : 'Submit Feedback'}
                        </button>
                    </form>
                </div>
            </div>
        </section>
    );
}
