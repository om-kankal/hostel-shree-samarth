import { useState } from 'react';
import { Save } from 'lucide-react';
import { useToast } from './ToastContext';
import { adminHeaders } from '../utils/api';

export default function AdminRegistration() {
    const { addToast } = useToast();
    const [form, setForm] = useState({
        username: '',
        email: '',
        password: '',
        confirmPassword: '',
    });
    const [submitting, setSubmitting] = useState(false);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            addToast('Passwords do not match.', 'error');
            return;
        }

        setSubmitting(true);
        try {
            const response = await fetch('/api/register/admin', {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    username: form.username,
                    email: form.email,
                    password: form.password,
                }),
            });
            const data = await response.json();
            if (!response.ok) {
                addToast(data.message || 'Admin registration failed.', 'error');
                return;
            }

            addToast(data.message || 'Admin registered successfully.', 'success');
            setForm({ username: '', email: '', password: '', confirmPassword: '' });
        } catch {
            addToast('Unable to connect to server.', 'error');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <section className="dashboard-section">
            <h2>Create Admin Account</h2>
            <form className="admin-form-panel" onSubmit={handleSubmit}>
                <div className="form-group">
                    <label htmlFor="adminUsername">Admin Username</label>
                    <input id="adminUsername" name="username" type="text" value={form.username} onChange={handleChange} required placeholder="Enter admin username" />
                </div>
                <div className="form-group">
                    <label htmlFor="adminEmail">Email</label>
                    <input id="adminEmail" name="email" type="email" value={form.email} onChange={handleChange} required placeholder="Enter admin email" />
                </div>
                <div className="form-group">
                    <label htmlFor="adminPassword">Password</label>
                    <input id="adminPassword" name="password" type="password" value={form.password} onChange={handleChange} required placeholder="Enter password" />
                </div>
                <div className="form-group">
                    <label htmlFor="adminConfirmPassword">Confirm Password</label>
                    <input id="adminConfirmPassword" name="confirmPassword" type="password" value={form.confirmPassword} onChange={handleChange} required placeholder="Confirm password" />
                </div>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                    <Save size={18} /> {submitting ? 'Creating...' : 'Create Admin'}
                </button>
            </form>
        </section>
    );
}
