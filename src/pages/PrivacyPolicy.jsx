export default function PrivacyPolicy() {
    return (
        <div className="section container animate-fade-in" style={{ maxWidth: '800px' }}>
            <h1 className="heading-1">Privacy Policy</h1>
            <p className="text-muted" style={{ marginBottom: '2rem' }}>Last Updated: March 2026</p>

            <div className="card">
                <h2 className="heading-3">1. Information We Collect</h2>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                    We collect information that you provide directly to us, such as your name,
                    email address, phone number, and any other details you share when filling out
                    forms, booking a bed, or communicating with us.
                </p>

                <h2 className="heading-3">2. How We Use Your Information</h2>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                    The information we collect is used to manage your bookings, respond to inquiries,
                    improve our services, and ensure security within our premises.
                </p>

                <h2 className="heading-3">3. Data Security</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    We implement appropriate technical and organizational security measures to protect
                    your personal data from unauthorized access, use, or disclosure.
                </p>
            </div>
        </div>
    );
}
