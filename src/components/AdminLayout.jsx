import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Bell,
    CalendarCheck,
    CreditCard,
    Image,
    LayoutDashboard,
    LogOut,
    Menu,
    MessageSquare,
    MessageSquareQuote,
    ShieldPlus,
    Users,
    X,
} from 'lucide-react';
import { clearAdminSession } from '../utils/api';
import './AdminLayout.css';

export default function AdminLayout({ children, activeSection }) {
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const navigate = useNavigate();

    const sections = [
        { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
        { id: 'rooms', label: 'Rooms', icon: <Users size={18} /> },
        { id: 'bookings', label: 'Bookings', icon: <CalendarCheck size={18} /> },
        { id: 'inquiries', label: 'Inquiries', icon: <MessageSquare size={18} /> },
        { id: 'payments', label: 'Payments', icon: <CreditCard size={18} /> },
        { id: 'gallery', label: 'Gallery', icon: <Image size={18} /> },
        { id: 'feedbacks', label: 'Feedbacks', icon: <MessageSquareQuote size={18} /> },
        { id: 'admins', label: 'Admins', icon: <ShieldPlus size={18} /> },
        { id: 'sms', label: 'SMS Logs', icon: <Bell size={18} /> },
    ];

    const handleNavigation = (sectionId) => {
        if (sectionId === 'dashboard') {
            navigate('/admin');
        } else {
            navigate(`/admin?tab=${sectionId}`);
        }
        if (window.innerWidth < 768) {
            setSidebarOpen(false);
        }
    };

    const handleLogout = () => {
        clearAdminSession();
        navigate('/login');
    };

    return (
        <div className="admin-layout">
            <aside className={`admin-sidebar ${sidebarOpen ? 'open' : 'closed'}`}>
                <div className="sidebar-header">
                    <h2>Admin Panel</h2>
                    <button className="sidebar-close" onClick={() => setSidebarOpen(false)}>
                        <X size={24} />
                    </button>
                </div>
                <nav className="sidebar-nav">
                    {sections.map(({ id, label, icon }) => (
                        <button
                            key={id}
                            className={`nav-item ${activeSection === id ? 'active' : ''}`}
                            onClick={() => handleNavigation(id)}
                        >
                            <span className="nav-icon">{icon}</span>
                            <span className="nav-label">{label}</span>
                        </button>
                    ))}
                </nav>
                <div className="sidebar-footer">
                    <button className="logout-btn" onClick={handleLogout}>
                        <LogOut size={20} />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            <div className="admin-main">
                <button className="sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)}>
                    <Menu size={24} />
                </button>
                <main className="admin-content">
                    {children}
                </main>
            </div>
        </div>
    );
}
