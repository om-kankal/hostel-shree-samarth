import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import './Login.css';

export default function Login() {
    const [activeTab, setActiveTab] = useState('student'); // 'student' or 'admin'
    const [form, setForm] = useState({ userId: '', password: '' });
    const { addToast } = useToast();
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        const url = activeTab === 'student' ? '/api/login/student' : '/api/login/admin';
        const payload = activeTab === 'student'
            ? { registration_no: form.userId, password: form.password }
            : { username: form.userId, password: form.password };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (!response.ok) {
                addToast(data.message || 'Login failed.', 'error');
                return;
            }
            addToast(data.message, 'success');
            if (activeTab === 'admin') {
                sessionStorage.setItem('adminAuth', 'true');
                sessionStorage.setItem('adminToken', data.token);
                navigate('/admin');
            } else {
                sessionStorage.setItem('studentAuth', 'true');
                sessionStorage.setItem('studentToken', data.token);
                sessionStorage.setItem('studentRegistration', data.student.registration_no);
                sessionStorage.setItem('studentName', data.student.name);
                navigate('/student');
            }
        } catch {
            addToast('Unable to login. Server unreachable.', 'error');
        }
    };

    return (
        <div className="section container animate-fade-in login-page">
            <div className="card login-card">
                <div className="login-header">
                    <img src="/logo.png" alt="SSPG BOYS" className="login-logo" />
                    <h1 className="heading-2">Welcome Back</h1>
                </div>

                <div className="login-tabs">
                    <button
                        className={`tab-btn ${activeTab === 'student' ? 'active' : ''}`}
                        onClick={() => setActiveTab('student')}
                    >
                        Student Login
                    </button>
                    <button
                        className={`tab-btn ${activeTab === 'admin' ? 'active' : ''}`}
                        onClick={() => setActiveTab('admin')}
                    >
                        Admin Login
                    </button>
                </div>

                <form className="login-form" onSubmit={handleLogin}>
                    <div className="form-group">
                        <label htmlFor="userId">
                            {activeTab === 'student' ? 'Student Registration No.' : 'Admin Username'}
                        </label>
                        <input
                            type="text"
                            id="userId"
                            name="userId"
                            value={form.userId}
                            onChange={handleChange}
                            required
                            placeholder={`Enter your ${activeTab === 'student' ? 'registration number' : 'username'}`}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Password</label>
                        <input
                            type="password"
                            id="password"
                            name="password"
                            value={form.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter your password"
                        />
                    </div>
                    <div className="login-actions">
                        <a href="/register" className="forgot-password">Register first</a>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block p-3 mt-4">
                        Login as {activeTab === 'student' ? 'Student' : 'Admin'}
                    </button>
                </form>
            </div>
        </div>
    );
}
