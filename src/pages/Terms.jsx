export default function Terms() {
    return (
        <div className="section container animate-fade-in" style={{ maxWidth: '800px' }}>
            <h1 className="heading-1">Terms of Service</h1>
            <p className="text-muted" style={{ marginBottom: '2rem' }}>Last Updated: March 2026</p>

            <div className="card">
                <h2 className="heading-3">1. Acceptance of Terms</h2>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                    By accessing and using this website or booking a bed at Shree Samarth PG,
                    you accept and agree to be bound by the terms and provision of this agreement.
                </p>

                <h2 className="heading-3">2. Booking and Payments</h2>
                <p style={{ marginBottom: '1.5rem', color: 'var(--text-muted)' }}>
                    All bookings are subject to availability. A security deposit may be required
                    at the time of confirmation. Rent is payable in advance by the 5th of every month.
                </p>

                <h2 className="heading-3">3. PG Rules</h2>
                <p style={{ color: 'var(--text-muted)' }}>
                    Residents are expected to maintain decorum, adhere to curfew timings, and
                    respect common property. Any damage to PG property will be charged to the
                    responsible individual(s).
                </p>
            </div>
        </div>
    );
}
