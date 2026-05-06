import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Save } from 'lucide-react';
import { useToast } from '../components/ToastContext';
import { clearStudentSession, studentHeaders } from '../utils/api';
import './StudentDashboard.css';

const emptyForm = {
    registration_no: '',
    first_name: '',
    middle_name: '',
    last_name: '',
    gender: 'male',
    date_of_birth: '',
    email: '',
    phone: '',
    course_major: '',
    current_year_semester: '',
    government_id_type: '',
    government_id_file_name: '',
    government_id_file_data: '',
    guardian_name: '',
    guardian_relationship: '',
    guardian_phone: '',
    permanent_address: '',
    admission_date: '',
    food_preference: '',
    food_allergies: '',
};

const splitName = (name = '') => {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    return {
        first_name: parts[0] || '',
        middle_name: parts.length > 2 ? parts.slice(1, -1).join(' ') : '',
        last_name: parts.length > 1 ? parts[parts.length - 1] : '',
    };
};

export default function StudentDashboard() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [lockedMessage, setLockedMessage] = useState('');
    const [profileData, setProfileData] = useState(null);
    const [form, setForm] = useState(emptyForm);

    const registrationNo = sessionStorage.getItem('studentRegistration');

    const hydrateForm = (data) => {
        const profile = data.profile || {};
        const fallbackName = splitName(data.student?.name || '');
        setForm({
            ...emptyForm,
            ...profile,
            registration_no: data.student?.registration_no || '',
            first_name: profile.first_name || fallbackName.first_name,
            middle_name: profile.middle_name || fallbackName.middle_name,
            last_name: profile.last_name || fallbackName.last_name,
            email: data.student?.email || '',
            phone: data.student?.phone || '',
            date_of_birth: profile.date_of_birth || '',
            admission_date: profile.admission_date || '',
            gender: 'male',
        });
    };

    const fetchProfile = async () => {
        if (!sessionStorage.getItem('studentAuth') || !sessionStorage.getItem('studentToken') || !registrationNo) {
            navigate('/login');
            return;
        }

        setLoading(true);
        try {
            const res = await fetch('/api/student/profile', {
                headers: studentHeaders(),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                setLockedMessage(data.message || 'Student section opens after bed allocation.');
                return;
            }

            setProfileData(data);
            hydrateForm(data);
            setLockedMessage('');
        } catch {
            addToast('Unable to load student information.', 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, []);

    const handleChange = (event) => {
        const { name, value } = event.target;
        setForm((prev) => ({ ...prev, [name]: value }));
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > 2 * 1024 * 1024) {
            addToast('Government ID upload must be 2MB or smaller.', 'error');
            return;
        }

        const reader = new FileReader();
        reader.onload = () => {
            setForm((prev) => ({
                ...prev,
                government_id_file_name: file.name,
                government_id_file_data: reader.result,
            }));
        };
        reader.readAsDataURL(file);
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
            const res = await fetch('/api/student/profile', {
                method: 'POST',
                headers: {
                    ...studentHeaders({ 'Content-Type': 'application/json' }),
                },
                body: JSON.stringify(form),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                addToast(data.message || 'Unable to save student information.', 'error');
                return;
            }

            addToast(data.message || 'Student information saved.', 'success');
            if (data.student?.registration_no) {
                sessionStorage.setItem('studentRegistration', data.student.registration_no);
            }
            if (data.token) {
                sessionStorage.setItem('studentToken', data.token);
            }
            setProfileData(data);
            hydrateForm(data);
        } catch {
            addToast('Unable to save student information.', 'error');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return <div className="section container student-dashboard"><div className="card">Loading student section...</div></div>;
    }

    if (lockedMessage) {
        return (
            <div className="section container student-dashboard">
                <div className="card student-locked">
                    <h1 className="heading-2">Student Section Pending</h1>
                    <p>{lockedMessage}</p>
                    <p className="text-muted">Register first, submit a booking request, and wait for admin bed allocation.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="section container student-dashboard">
            <div className="student-dashboard-header">
                <div>
                    <h1 className="heading-2">Student Section</h1>
                    <p className="text-muted">Maintain your resident information after bed allocation.</p>
                </div>
                <button className="btn btn-secondary" onClick={() => {
                    clearStudentSession();
                    navigate('/login');
                }}>
                    Logout
                </button>
            </div>

            <section className="card allocation-summary">
                <div>
                    <strong>Registration</strong>
                    <span>{profileData.student.registration_no}</span>
                </div>
                <div>
                    <strong>Room Number</strong>
                    <span>{profileData.hostel.room_number}</span>
                </div>
                <div>
                    <strong>Bed Number</strong>
                    <span>{profileData.hostel.bed_label}</span>
                </div>
                <div>
                    <strong>Booking Status</strong>
                    <span>{profileData.booking.status}</span>
                </div>
            </section>

            <section className="card fees-section">
                <div className="fees-header">
                    <h2>Fees</h2>
                    <span>Read only</span>
                </div>
                <div className="fees-summary">
                    <div>
                        <strong>Rs {Number(profileData.fees?.total_paid || 0).toFixed(2)}</strong>
                        <span>Paid</span>
                    </div>
                    <div>
                        <strong>Rs {Number(profileData.fees?.total_pending || 0).toFixed(2)}</strong>
                        <span>Pending</span>
                    </div>
                </div>
                <div className="fees-table-wrap">
                    <table className="fees-table">
                        <thead>
                            <tr>
                                <th>Amount</th>
                                <th>Paid</th>
                                <th>Pending</th>
                                <th>Status</th>
                                <th>Due Date</th>
                                <th>Paid At</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(profileData.fees?.payments || []).length === 0 ? (
                                <tr><td colSpan="6">No fee records available.</td></tr>
                            ) : profileData.fees.payments.map((payment) => (
                                <tr key={payment.id}>
                                    <td>Rs {Number(payment.amount || 0).toFixed(2)}</td>
                                    <td>Rs {Number(payment.paid_amount || 0).toFixed(2)}</td>
                                    <td>Rs {Number(payment.balance_amount || 0).toFixed(2)}</td>
                                    <td>{payment.payment_status}</td>
                                    <td>{payment.due_date || '-'}</td>
                                    <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <form className="student-profile-form" onSubmit={handleSubmit}>
                <section className="card form-section">
                    <h2>Basic Personal Information</h2>
                    <div className="student-form-grid">
                        <label>First Name<input name="first_name" value={form.first_name} onChange={handleChange} required /></label>
                        <label>Middle Name<input name="middle_name" value={form.middle_name || ''} onChange={handleChange} /></label>
                        <label>Last Name<input name="last_name" value={form.last_name} onChange={handleChange} required /></label>
                        <label>Gender<input name="gender" value="male" readOnly /></label>
                        <label>Date of Birth<input type="date" name="date_of_birth" value={form.date_of_birth || ''} onChange={handleChange} required /></label>
                        <label>Contact Number<input name="phone" value={form.phone || ''} onChange={handleChange} required /></label>
                        <label>Email Address<input type="email" name="email" value={form.email || ''} onChange={handleChange} required /></label>
                    </div>
                </section>

                <section className="card form-section">
                    <h2>Academic & Identity Verification</h2>
                    <div className="student-form-grid">
                        <label>University/College ID Number<input name="registration_no" value={form.registration_no || ''} onChange={handleChange} required /></label>
                        <label>Course/Major<input name="course_major" value={form.course_major || ''} onChange={handleChange} required /></label>
                        <label>Current Year/Semester<input name="current_year_semester" value={form.current_year_semester || ''} onChange={handleChange} required /></label>
                        <label>Government ID Type
                            <select name="government_id_type" value={form.government_id_type || ''} onChange={handleChange} required>
                                <option value="">Select ID type</option>
                                <option value="aadhar">Aadhar</option>
                                <option value="passport">Passport</option>
                                <option value="drivers-license">Driver's License</option>
                            </select>
                        </label>
                        <label>Government ID Proof<input type="file" accept="image/*,.pdf" onChange={handleFileChange} /></label>
                        <label>Uploaded File<input value={form.government_id_file_name || 'No file uploaded'} readOnly /></label>
                    </div>
                </section>

                <section className="card form-section">
                    <h2>Emergency Contact Details</h2>
                    <div className="student-form-grid">
                        <label>Guardian/Parent Name<input name="guardian_name" value={form.guardian_name || ''} onChange={handleChange} required /></label>
                        <label>Relationship<input name="guardian_relationship" value={form.guardian_relationship || ''} onChange={handleChange} required /></label>
                        <label>Guardian Phone Number<input name="guardian_phone" value={form.guardian_phone || ''} onChange={handleChange} required /></label>
                        <label className="span-2">Permanent Address<textarea name="permanent_address" rows="3" value={form.permanent_address || ''} onChange={handleChange} required /></label>
                    </div>
                </section>

                <section className="card form-section">
                    <h2>Hostel-Specific Details</h2>
                    <div className="student-form-grid">
                        <label>Room Number<input value={profileData.hostel.room_number} readOnly /></label>
                        <label>Bed Number<input value={profileData.hostel.bed_label} readOnly /></label>
                        <label>Check-in / Admission Date<input type="date" name="admission_date" value={form.admission_date || ''} onChange={handleChange} required /></label>
                        <label>Food Preference
                            <select name="food_preference" value={form.food_preference || ''} onChange={handleChange} required>
                                <option value="">Select preference</option>
                                <option value="veg">Veg</option>
                                <option value="non-veg">Non-Veg</option>
                                <option value="allergies">Specific Allergies</option>
                                <option value="other">Other</option>
                            </select>
                        </label>
                        <label className="span-2">Food Allergies / Notes<textarea name="food_allergies" rows="3" value={form.food_allergies || ''} onChange={handleChange} /></label>
                    </div>
                </section>

                <button className="btn btn-primary student-save-btn" type="submit" disabled={saving}>
                    <Save size={18} /> {saving ? 'Saving...' : 'Save Student Information'}
                </button>
            </form>
        </div>
    );
}
