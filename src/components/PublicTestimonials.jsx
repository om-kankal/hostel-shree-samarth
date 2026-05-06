import { useState, useEffect } from 'react';
import './PublicTestimonials.css';

export default function PublicTestimonials() {
    const [feedbacks, setFeedbacks] = useState([]);
    const [loading, setLoading] = useState(false);
    const API_BASE = import.meta.env.VITE_API_BASE || 'http://127.0.0.1:5000';

    useEffect(() => {
        fetchFeedbacks();
    }, []);

    const fetchFeedbacks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`${API_BASE}/api/public/feedbacks`);
            if (!res.ok) throw new Error('Failed to fetch feedbacks');
            const data = await res.json();
            setFeedbacks(data);
        } catch (error) {
            console.error('Feedback error:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <section className="testimonials-section">
                <div className="testimonials-container">
                    <h2>Student Testimonials</h2>
                    <p className="loading-text">Loading testimonials...</p>
                </div>
            </section>
        );
    }

    if (feedbacks.length === 0) {
        return null; // Don't show section if no feedbacks
    }

    return (
        <section className="testimonials-section">
            <div className="testimonials-container">
                <div className="testimonials-header">
                    <h2>What Our Students Say</h2>
                    <p>Read testimonials from our satisfied residents</p>
                </div>

                <div className="testimonials-grid">
                    {feedbacks.map((feedback, index) => (
                        <div key={index} className="testimonial-card">
                            <div className="testimonial-rating">
                                {'⭐'.repeat(feedback.rating || 5)}
                            </div>

                            <p className="testimonial-message">
                                "{feedback.message}"
                            </p>

                            <div className="testimonial-author">
                                <h4>{feedback.student_name}</h4>
                                {feedback.created_at && (
                                    <p className="testimonial-date">
                                        {new Date(feedback.created_at).toLocaleDateString('en-IN', {
                                            year: 'numeric',
                                            month: 'short',
                                            day: 'numeric'
                                        })}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="share-feedback-cta">
                    <p>Have an experience to share?</p>
                    <a href="#feedback-form" className="cta-link">
                        Leave your feedback →
                    </a>
                </div>
            </div>
        </section>
    );
}
