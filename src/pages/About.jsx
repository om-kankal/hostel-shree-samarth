export default function About() {
    return (
        <div className="section container animate-fade-in">
            <h1 className="heading-1">About Shree Samarth PG</h1>
            <div className="card" style={{ marginTop: '2rem' }}>
                <h2 className="heading-3">Our Story</h2>
                <p style={{ marginBottom: '1rem', color: 'var(--text-muted)' }}>
                    Founded with a vision to provide a home away from home, Shree Samarth PG
                    combines modern living spaces with a warm, welcoming community. We understand
                    that moving to a new city can be challenging, which is why we’ve curated
                    an environment that supports your personal and professional growth.
                </p>
                <p style={{ color: 'var(--text-muted)' }}>
                    Our core philosophy is built on three pillars: <strong>Comfort, Community, and Convenience</strong>.
                    With state-of-the-art facilities, strict security measures, and a dedicated management team,
                    we ensure your stay is hassle-free.
                </p>
            </div>
        </div>
    );
}
