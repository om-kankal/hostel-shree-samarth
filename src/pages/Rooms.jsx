import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import './Rooms.css';

export default function Rooms() {
    const rooms = [
        {
            type: 'Standard 5-Sharing',
            price: 'Rs 78,000/year',
            features: ['Non-AC', 'Shared Bathroom', 'Basic Furnishing', 'Wi-Fi Access'],
            isPopular: false
        },
        {
            type: 'Premium 5-Sharing',
            price: 'Rs 102,000/year',
            features: ['Air Conditioned', 'Attached Bathroom', 'Premium Furnishing', 'High-Speed Wi-Fi', 'Daily Cleaning'],
            isPopular: true
        }
    ];

    return (
        <div className="section container animate-fade-in">
            <h1 className="heading-1 text-center">Rooms & Pricing</h1>
            <p className="text-center text-muted facilities-subtitle">
                Choose a room that fits your needs and budget. A single room can have up to 5 beds.
            </p>

            <div className="pricing-grid">
                {rooms.map((room, idx) => (
                    <div key={idx} className={`card pricing-card ${room.isPopular ? 'popular' : ''}`}>
                        {room.isPopular && <div className="popular-badge">Most Popular</div>}
                        <h3 className="heading-2">{room.type}</h3>
                        <div className="price">{room.price}</div>

                        <ul className="feature-list">
                            {room.features.map((feature, fidx) => (
                                <li key={fidx}>
                                    <Check size={20} className="check-icon" /> {feature}
                                </li>
                            ))}
                        </ul>

                        <Link to="/booking" className={`btn ${room.isPopular ? 'btn-primary' : 'btn-secondary'} btn-block mt-auto`}>
                            Book Now
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
