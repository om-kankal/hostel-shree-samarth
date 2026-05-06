import { useState } from 'react';
import { Mail, Phone, MapPin } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import './Contact.css';

const CONTACT_EMAIL = 'info@shreesamarthpg.com';
const CONTACT_PHONE = '7040004604';

export default function Contact() {
    const [registrationNo, setRegistrationNo] = useState('');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const { addToast } = useToast();

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch('/api/inquiries', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ registration_no: registrationNo, subject, message }),
            });
            const data = await response.json();
            if (!response.ok) {
                addToast(data.message || 'Unable to send inquiry.', 'error');
                return;
            }
            addToast(data.message, 'success');
            setRegistrationNo('');
            setSubject('');
            setMessage('');
        } catch {
            addToast('Unable to send inquiry. Server unreachable.', 'error');
        }
    };

    return (
        <div className="section container animate-fade-in contact-page">
            <h1 className="heading-1 text-center">Contact Us</h1>
            <p className="text-center text-muted facilities-subtitle">We would love to hear from you.</p>

            <div className="contact-grid">
                <div className="card contact-info">
                    <h2 className="heading-3">Get in Touch</h2>

                    <div className="info-item">
                        <MapPin className="contact-icon" />
                        <div>
                            <strong>Address</strong>
                            <p className="text-muted" style={{ textTransform: 'capitalize' }}>in front of wellness medical parandwadi road, parandwadi</p>
                        </div>
                    </div>

                    <div className="info-item">
                        <Phone className="contact-icon" />
                        <div>
                            <strong>Phone</strong>
                            <p>
                                <a className="contact-link" href={`tel:${CONTACT_PHONE}`}>
                                    {CONTACT_PHONE}
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="info-item">
                        <Mail className="contact-icon" />
                        <div>
                            <strong>Email</strong>
                            <p>
                                <a
                                    className="contact-link"
                                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {CONTACT_EMAIL}
                                </a>
                            </p>
                        </div>
                    </div>

                    <div className="text-center" style={{ marginTop: '2rem' }}>
                        <a href="https://maps.app.goo.gl/c75xjmJyfdzy8Q7E7" target="_blank" rel="noopener noreferrer" className="btn btn-primary location-btn">
                            View Location on Map
                        </a>
                    </div>
                </div>

                <form className="card contact-form" onSubmit={handleSubmit}>
                    <h2 className="heading-3">Send an Inquiry</h2>
                    <div className="form-group">
                        <label htmlFor="registrationNo">Registration Number</label>
                        <input
                            type="text"
                            id="registrationNo"
                            value={registrationNo}
                            onChange={(e) => setRegistrationNo(e.target.value)}
                            placeholder="Optional: your registration number"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="subject">Subject</label>
                        <input
                            type="text"
                            id="subject"
                            value={subject}
                            onChange={(e) => setSubject(e.target.value)}
                            required
                            placeholder="Inquiry subject"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="message">Message</label>
                        <textarea
                            id="message"
                            rows="4"
                            value={message}
                            onChange={(e) => setMessage(e.target.value)}
                            required
                            placeholder="How can we help?"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary send-msg-btn">Send Message</button>
                </form>
            </div>
        </div>
    );
}
