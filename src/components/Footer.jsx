import { Link } from 'react-router-dom';
import './Footer.css';

const CONTACT_EMAIL = 'info@shreesamarthpg.com';
const CONTACT_PHONE = '7040004604';

export default function Footer() {
    return (
        <footer className="footer-container section-light">
            <div className="container footer-inner">
                <div className="footer-brand">
                    <h2 className="heading-3">Shree Samarth PG</h2>
                    <p className="tagline">Comfort. Community. Convenience.</p>
                </div>
                <div className="footer-links">
                    <div className="link-group">
                        <h4>Quick Links</h4>
                        <ul>
                            <li><Link to="/about">About Us</Link></li>
                            <li><Link to="/facilities">Facilities</Link></li>
                            <li><Link to="/gallery">Gallery</Link></li>
                        </ul>
                    </div>
                    <div className="link-group">
                        <h4>Legal</h4>
                        <ul>
                            <li><Link to="/privacy">Privacy Policy</Link></li>
                            <li><Link to="/terms">Terms of Service</Link></li>
                        </ul>
                    </div>
                    <div className="link-group">
                        <h4>Contact</h4>
                        <ul>
                            <li>
                                <a
                                    href={`https://mail.google.com/mail/?view=cm&fs=1&to=${CONTACT_EMAIL}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    {CONTACT_EMAIL}
                                </a>
                            </li>
                            <li><a href={`tel:${CONTACT_PHONE}`}>{CONTACT_PHONE}</a></li>
                            <li>
                                <a href="https://maps.app.goo.gl/c75xjmJyfdzy8Q7E7" target="_blank" rel="noopener noreferrer" className="btn btn-primary" style={{ marginTop: '0.5rem', display: 'inline-flex' }}>
                                    View Location
                                </a>
                            </li>
                        </ul>
                    </div>
                </div>
            </div>
            <div className="footer-bottom container">
                <p>&copy; {new Date().getFullYear()} Shree Samarth PG. All rights reserved.</p>
            </div>
        </footer>
    );
}
