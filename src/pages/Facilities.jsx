import { Wifi, ShieldCheck, Coffee, Utensils, Droplets, WashingMachine } from 'lucide-react';
import './Facilities.css';

export default function Facilities() {
    const facilities = [
        { icon: <Wifi size={32} />, title: 'High-Speed Wi-Fi', desc: 'Seamless internet connectivity throughout the premises.' },
        { icon: <ShieldCheck size={32} />, title: '24/7 Security', desc: 'CCTV surveillance and biometric access for your safety.' },
        { icon: <Coffee size={32} />, title: 'Common Spaces', desc: 'Vibrant lounging areas to relax and interact.' },
        { icon: <Utensils size={32} />, title: 'Nutritious Meals', desc: 'Hygienic and healthy food served three times a day.' },
        { icon: <Droplets size={32} />, title: '24/7 Hot Water', desc: 'Continuous supply of hot water for bathing in every bathroom.' },
        { icon: <WashingMachine size={32} />, title: 'Laundry Services', desc: 'In-house washing and drying facilities available.' },
    ];

    return (
        <div className="section container animate-fade-in">
            <h1 className="heading-1 text-center">Premium Facilities</h1>
            <p className="text-center text-muted facilities-subtitle">
                Everything you need for a comfortable stay.
            </p>

            <div className="facilities-grid">
                {facilities.map((fac, idx) => (
                    <div key={idx} className="card facility-card">
                        <div className="facility-icon">{fac.icon}</div>
                        <h3 className="heading-3">{fac.title}</h3>
                        <p className="text-muted">{fac.desc}</p>
                    </div>
                ))}
            </div>
        </div>
    );
}
