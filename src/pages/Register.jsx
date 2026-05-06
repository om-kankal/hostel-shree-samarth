import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import './Login.css';

export default function Register() {
    const [form, setForm] = useState({
        registration_no: '',
        name: '',
        email: '',
        phone: '',
        username: '',
        password: '',
        confirmPassword: '',
    });
    const { addToast } = useToast();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (form.password !== form.confirmPassword) {
            addToast('Passwords do not match.', 'error');
            return;
        }

        const body = {
            registration_no: form.registration_no,
            name: form.name,
            email: form.email,
            phone: form.phone,
            password: form.password,
        };

        try {
            const response = await fetch('/api/register/student', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await response.json();
            if (!response.ok) {
                addToast(data.message || 'Registration failed.', 'error');
                return;
            }
            addToast(data.message, 'success');
            navigate('/login');
        } catch {
            addToast('Unable to connect to server.', 'error');
        }
    };

    return (
        <div className="section container animate-fade-in login-page">
            <div className="card login-card">
                <div className="login-header">
                    <img src="/sspg-boys-logo.svg" alt="SSPG BOYS" className="login-logo" />
                    <h1 className="heading-2">Create Account</h1>
                </div>

                <div className="login-tabs">
                    <button className="tab-btn active" type="button">
                        Student Register
                    </button>
                </div>

                <form className="login-form" onSubmit={handleRegister}>
                    <div className="form-group">
                        <label htmlFor="registration_no">Student Registration No.</label>
                        <input type="text" id="registration_no" name="registration_no" value={form.registration_no} onChange={handleChange} required placeholder="Enter registration number" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="name">Full Name</label>
                        <input type="text" id="name" name="name" value={form.name} onChange={handleChange} required placeholder="Enter your name" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="phone">Phone</label>
                        <input type="tel" id="phone" name="phone" value={form.phone} onChange={handleChange} placeholder="Enter phone number" />
                    </div>

                    <div className="form-group">
                        <label htmlFor="email">Email</label>
                        <input type="email" id="email" name="email" value={form.email} onChange={handleChange} required placeholder="Enter your email" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input type="password" id="password" name="password" value={form.password} onChange={handleChange} required placeholder="Enter password" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirm Password</label>
                        <input type="password" id="confirmPassword" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} required placeholder="Confirm password" />
                    </div>
                    <button type="submit" className="btn btn-primary btn-block p-3 mt-4">
                        Register as Student
                    </button>
                </form>
            </div>
        </div>
    );
}
