import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import ThemeToggle from './ThemeToggle';
import './Navbar.css';

export default function Navbar() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    const closeMenu = () => setIsMobileMenuOpen(false);

    return (
        <header className="navbar-container">
            <div className="container navbar-inner">
                <Link to="/" className="navbar-brand" onClick={closeMenu}>
                    <div className="css-logo">
                        <span className="logo-sspg">SSPG</span>
                        <span className="logo-boys">— BOYS —</span>
                    </div>
                </Link>

                {/* Desktop Nav */}
                <nav className={`navbar-nav ${isMobileMenuOpen ? 'mobile-open' : ''}`}>
                    <ul className="nav-list">
                        <li><Link to="/" onClick={closeMenu}>Home</Link></li>
                        <li><Link to="/about" onClick={closeMenu}>About</Link></li>
                        <li><Link to="/facilities" onClick={closeMenu}>Facilities</Link></li>
                        <li><Link to="/gallery" onClick={closeMenu}>Gallery</Link></li>
                        <li><Link to="/feedback" onClick={closeMenu}>Feedback</Link></li>
                        <li><Link to="/contact" onClick={closeMenu}>Contact</Link></li>
                    </ul>
                    <div className="navbar-actions">
                        <ThemeToggle />
                        <Link to="/register" className="btn btn-secondary" onClick={closeMenu}>Register</Link>
                        <Link to="/login" className="btn btn-secondary" onClick={closeMenu}>Login</Link>
                        <Link to="/booking" className="btn btn-primary" onClick={closeMenu}>Book Now</Link>
                    </div>
                </nav>

                {/* Mobile Toggle Btn */}
                <button
                    className="mobile-toggle-btn"
                    onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                    aria-label="Toggle navigation menu"
                >
                    {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
                </button>
            </div>
        </header>
    );
}
