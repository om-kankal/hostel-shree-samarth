import { Link } from 'react-router-dom';

export default function NotFound() {
    return (
        <div className="section container text-center animate-fade-in" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
            <h1 className="heading-1" style={{ fontSize: '6rem', color: 'var(--accent)' }}>404</h1>
            <h2 className="heading-2">Page Not Found</h2>
            <p className="text-muted" style={{ marginBottom: '2rem', maxWidth: '500px' }}>
                The page you are looking for might have been removed, had its name changed, or is temporarily unavailable.
            </p>
            <Link to="/" className="btn btn-primary btn-lg">Return to Home</Link>
        </div>
    );
}
