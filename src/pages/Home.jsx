import { ArrowDown } from 'lucide-react';
import PublicTestimonials from '../components/PublicTestimonials';
import './Home.css';

export default function Home() {
    const handleScroll = () => {
        window.scrollTo({
            top: window.innerHeight,
            behavior: 'smooth'
        });
    };

    return (
        <>
            <section className="hero-fullscreen animate-fade-in">
                <div className="hero-bg-overlay"></div>
                {/* Using a working Unsplash image so it's visible. You can change this back to '/hero-bg.jpg' once you save your image there */}
                <div className="hero-bg-image" style={{ backgroundImage: "url('https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&q=80')" }}></div>

                <div className="hero-center-content">
                    <h1 className="hero-giant-title">Shree Samarth PG</h1>
                </div>

                <div className="hero-bottom-grid">
                    <div className="hero-bottom-left">
                        <h2 className="hashtag-title">#InspiredLiving</h2>
                        <p className="hero-subtext">
                            Creating modern spaces where<br />
                            comfort, community, and lifestyle<br />
                            come together seamlessly.
                        </p>
                    </div>

                    <div className="hero-bottom-center">
                        <button className="scroll-down-btn" onClick={handleScroll}>
                            <ArrowDown size={24} />
                        </button>
                    </div>

                    <div className="hero-bottom-right">
                        <div className="glass-card">
                            <div className="glass-content">
                                <h3>Premium Amenities</h3>
                                <p>Experience fully furnished rooms with daily housekeeping, high-speed Wi-Fi, and nutritious meals prepared daily.</p>
                                <a href="/facilities" className="explore-link">EXPLORE MORE ↗</a>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="features-section section container" style={{ minHeight: '100vh' }}>
                <h2 className="heading-2 text-center" style={{ marginTop: '4rem' }}>Why Choose Us?</h2>
                <div className="features-grid" style={{ paddingTop: '2rem' }}>
                    <div className="card feature-card">
                        <h3>Comfort</h3>
                        <p>Spacious rooms with premium mattresses, attached bathrooms, and air conditioning to ensure you rest well.</p>
                    </div>
                    <div className="card feature-card">
                        <h3>Community</h3>
                        <p>Connect with like-minded individuals in our vibrant common areas. Participate in weekend events and build lifelong friendships.</p>
                    </div>
                    <div className="card feature-card">
                        <h3>Convenience</h3>
                        <p>High-speed WiFi, nutritious meals, laundry services, and 24/7 security. Everything you need under one roof.</p>
                    </div>
                </div>

                <div className="text-center" style={{ marginTop: '4rem' }}>
                    <a href="https://maps.app.goo.gl/c75xjmJyfdzy8Q7E7" target="_blank" rel="noopener noreferrer" className="btn btn-primary location-btn">
                        View Location on Map
                    </a>
                </div>
            </section>

            <PublicTestimonials />

            <section className="section container" style={{ minHeight: '60vh', padding: '4rem 2rem' }}>
                <h2 className="heading-2 text-center">Share Your Experience</h2>
                <p className="text-center" style={{ fontSize: '1rem', color: 'var(--text-tertiary)', marginBottom: '2rem' }}>
                    Have you stayed with us? We'd love to hear about your experience!
                </p>
                <div className="text-center">
                    <a href="/feedback" className="btn btn-primary" style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}>
                        Submit Your Feedback →
                    </a>
                </div>
            </section>
        </>
    );
}
