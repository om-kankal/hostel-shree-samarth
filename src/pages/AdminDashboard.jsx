import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useToast } from '../components/ToastContext';
import AdminLayout from '../components/AdminLayout';
import RoomManagement from '../components/RoomManagement';
import BookingVisualManagement from '../components/BookingVisualManagement';
import GalleryManagement from '../components/GalleryManagement';
import FeedbackManagement from '../components/FeedbackManagement';
import AdminRegistration from '../components/AdminRegistration';
import { adminHeaders } from '../utils/api';
import './AdminDashboard.css';

export default function AdminDashboard() {
    const navigate = useNavigate();
    const { addToast } = useToast();
    const [searchParams] = useSearchParams();
    const activeTab = searchParams.get('tab') || 'dashboard';
    const [summary, setSummary] = useState(null);
    const [inquiries, setInquiries] = useState([]);
    const [payments, setPayments] = useState([]);
    const [selectedStudent, setSelectedStudent] = useState(null);
    const [paymentModal, setPaymentModal] = useState(null);
    const [receivedAmount, setReceivedAmount] = useState('');
    const [smsLogs, setSmsLogs] = useState([]);
    const [newSmsMessage, setNewSmsMessage] = useState('Reminder: your booking request is being processed.');
    const [chartData, setChartData] = useState({});
    const [dashboardLoading, setDashboardLoading] = useState(false);

    const ensureAdmin = () => {
        const auth = sessionStorage.getItem('adminAuth');
        const token = sessionStorage.getItem('adminToken');
        if (!auth || !token) {
            addToast('Please login as admin to access the dashboard.', 'error');
            navigate('/login');
        }
    };

    const prepareChartData = (bookings, payments, inquiries, rooms) => {
        // Booking status distribution
        const bookingStatuses = {};
        bookings.forEach(b => {
            bookingStatuses[b.status] = (bookingStatuses[b.status] || 0) + 1;
        });
        const bookingChart = Object.entries(bookingStatuses).map(([status, count]) => ({ status, count }));

        // Payment status distribution
        const paymentStatuses = {};
        payments.forEach(p => {
            paymentStatuses[p.payment_status] = (paymentStatuses[p.payment_status] || 0) + 1;
        });
        const paymentChart = Object.entries(paymentStatuses).map(([status, count]) => ({ status, count }));

        // Inquiry status distribution
        const inquiryStatuses = {};
        inquiries.forEach(i => {
            inquiryStatuses[i.status] = (inquiryStatuses[i.status] || 0) + 1;
        });
        const inquiryChart = Object.entries(inquiryStatuses).map(([status, count]) => ({ status, count }));

        // Room occupancy
        const totalBeds = rooms.reduce((sum, room) => sum + (room.beds?.length || Number(room.capacity) || 0), 0);
        const allocatedBeds = rooms.reduce((sum, room) => sum + (room.beds || []).filter(bed => bed.status === 'booked').length, 0);
        const occupiedBeds = rooms.reduce((sum, room) => sum + room.beds.filter(bed => bed.status === 'occupied').length, 0);
        const occupancyChart = [
            { name: 'Occupied', value: occupiedBeds },
            { name: 'Allocated', value: allocatedBeds },
            { name: 'Available', value: Math.max(totalBeds - occupiedBeds - allocatedBeds, 0) }
        ];

        // Revenue data (assuming payments have amounts)
        const totalRevenue = payments.reduce((sum, p) => sum + Number(p.paid_amount || 0), 0);
        const pendingRevenue = payments.reduce((sum, p) => sum + Number(p.balance_amount || 0), 0);

        setChartData({
            bookingChart,
            paymentChart,
            inquiryChart,
            occupancyChart,
            totalRevenue,
            pendingRevenue
        });
    };

    const fetchData = async () => {
        setDashboardLoading(true);
        try {
            const [summaryRes, bookingsRes, inquiriesRes, paymentsRes, roomsRes, smsRes] = await Promise.all([
                fetch('/api/admin/summary', { headers: adminHeaders() }),
                fetch('/api/admin/bookings', { headers: adminHeaders() }),
                fetch('/api/admin/inquiries', { headers: adminHeaders() }),
                fetch('/api/admin/payments', { headers: adminHeaders() }),
                fetch('/api/admin/rooms', { headers: adminHeaders() }),
                fetch('/api/admin/sms', { headers: adminHeaders() }),
            ]);

            if (!summaryRes.ok || !bookingsRes.ok || !inquiriesRes.ok || !paymentsRes.ok || !roomsRes.ok || !smsRes.ok) {
                throw new Error('Failed to fetch dashboard data.');
            }

            const summaryData = await summaryRes.json();
            const bookingsData = await bookingsRes.json();
            const inquiriesData = await inquiriesRes.json();
            const paymentsData = await paymentsRes.json();
            const roomsData = await roomsRes.json();
            const smsData = await smsRes.json();

            setSummary(summaryData);
            setInquiries(inquiriesData);
            setPayments(paymentsData);
            setSelectedStudent(null);
            setSmsLogs(smsData);

            // Prepare chart data
            prepareChartData(bookingsData, paymentsData, inquiriesData, roomsData);
        } catch (error) {
            addToast(error.message || 'Unable to load dashboard data.', 'error');
        } finally {
            setDashboardLoading(false);
        }
    };

    useEffect(() => {
        ensureAdmin();
        fetchData();
    }, [activeTab]);

    const respondToInquiry = async (inquiryId) => {
        const response = window.prompt('Enter your response to this inquiry:');
        if (!response) {
            return;
        }
        const res = await fetch(`/api/admin/inquiries/${inquiryId}/respond`, {
            method: 'POST',
            headers: adminHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ response }),
        });
        const data = await res.json();
        if (!res.ok) {
            addToast(data.message || 'Response failed.', 'error');
            return;
        }
        addToast(data.message, 'success');
        fetchData();
    };

    const openPaymentModal = (payment) => {
        setPaymentModal(payment);
        setReceivedAmount(String(Number(payment.balance_amount || 0).toFixed(2)));
    };

    const closePaymentModal = () => {
        setPaymentModal(null);
        setReceivedAmount('');
    };

    const recordPayment = async () => {
        if (!paymentModal) return;
        const res = await fetch(`/api/admin/payments/${paymentModal.id}/update`, {
            method: 'POST',
            headers: adminHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ received_amount: receivedAmount }),
        });
        const data = await res.json();
        if (!res.ok) {
            addToast(data.message || 'Payment update failed.', 'error');
            return;
        }
        addToast(data.message, 'success');
        closePaymentModal();
        fetchData();
    };

    const sendSms = async () => {
        try {
            const res = await fetch('/api/admin/sms/send', {
                method: 'POST',
                headers: adminHeaders({ 'Content-Type': 'application/json' }),
                body: JSON.stringify({
                    subject: 'Admin Notification',
                    message: newSmsMessage,
                    admin_id: 1,
                }),
            });
            const data = await res.json();
            if (!res.ok) {
                addToast(data.message || 'Notification failed.', 'error');
                return;
            }
            addToast(data.message, 'success');
            fetchData();
        } catch {
            addToast('Unable to send notification.', 'error');
        }
    };

    const studentGroups = Object.values(payments.reduce((groups, payment) => {
        const key = payment.student_id || `${payment.student_registration}-${payment.student_name}`;
        if (!groups[key]) {
            groups[key] = {
                student_id: payment.student_id,
                student_name: payment.student_name,
                student_registration: payment.student_registration,
                totalPaid: 0,
                latest_booking_id: payment.booking_id,
                latest_booking_status: payment.booking_status,
                latest_room_number: payment.room_number,
                latest_bed_label: payment.bed_label,
                totalPending: 0,
                payments: []
            };
        }
        groups[key].totalPaid += Number(payment.paid_amount) || 0;
        groups[key].totalPending += Number(payment.balance_amount) || 0;
        groups[key].payments.push(payment);
        return groups;
    }, {}));

    return (
        <AdminLayout activeSection={activeTab}>
            {activeTab === 'rooms' ? (
                <RoomManagement />
            ) : activeTab === 'bookings' ? (
                <BookingVisualManagement />
            ) : activeTab === 'inquiries' ? (
                <section className="dashboard-section">
                    <h2>Inquiries</h2>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Subject</th>
                                    <th>Message</th>
                                    <th>Response</th>
                                    <th>Status</th>
                                    <th>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {inquiries.map((inquiry) => (
                                    <tr key={inquiry.id}>
                                        <td>{inquiry.student_name || inquiry.student_registration || 'Guest'}</td>
                                        <td>{inquiry.subject}</td>
                                        <td>{inquiry.message}</td>
                                        <td>{inquiry.response || 'No response yet'}</td>
                                        <td>{inquiry.status}</td>
                                        <td className="actions-cell">
                                            <button onClick={() => respondToInquiry(inquiry.id)}>Respond</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : activeTab === 'payments' ? (
                <section className="dashboard-section payments-section">
                    <div className="payments-title-row">
                        <h2>Payments</h2>
                        <button className="btn btn-secondary" onClick={fetchData} disabled={dashboardLoading}>
                            {dashboardLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>
                    <div className="payments-grid">
                        <aside className="payments-sidebar">
                            <div className="payments-sidebar-header">
                                <h3>Students</h3>
                                <button className="btn btn-secondary" onClick={() => setSelectedStudent(null)}>
                                    View All
                                </button>
                            </div>
                            <div className="payments-sidebar-list">
                                {studentGroups.map((student) => (
                                    <button
                                        key={`${student.student_id || student.student_registration}`}
                                        className={`student-row ${selectedStudent && selectedStudent.student_id === student.student_id ? 'active' : ''}`}
                                        onClick={() => setSelectedStudent(student)}
                                    >
                                        <div>
                                            <strong>{student.student_name || student.student_registration}</strong>
                                            <small>{student.student_registration || 'No registration'}</small>
                                            <small>Paid Rs {student.totalPaid.toFixed(2)} | Pending Rs {student.totalPending.toFixed(2)}</small>
                                        </div>
                                        <span>{student.payments.length} payments</span>
                                    </button>
                                ))}
                            </div>
                        </aside>
                        <div className="payments-history">
                            <h3>{selectedStudent ? `${selectedStudent.student_name || selectedStudent.student_registration} Payment History` : 'All Payment Records'}</h3>
                            {selectedStudent && (
                                <div className="student-payment-summary">
                                    <div>
                                        <strong>{selectedStudent.payments.length}</strong>
                                        <span>Total Records</span>
                                    </div>
                                    <div>
                                        <strong>Rs {selectedStudent.totalPaid.toFixed(2)}</strong>
                                        <span>Paid</span>
                                    </div>
                                    <div>
                                        <strong>Rs {selectedStudent.totalPending.toFixed(2)}</strong>
                                        <span>Pending</span>
                                    </div>
                                    <div>
                                        <strong>{selectedStudent.latest_room_number ? `Room ${selectedStudent.latest_room_number}` : 'No room'}</strong>
                                        <span>{selectedStudent.latest_bed_label || selectedStudent.latest_booking_status || 'No active booking'}</span>
                                    </div>
                                </div>
                            )}
                            <div className="table-scroll">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Student</th>
                                            <th>Room / Bed</th>
                                            <th>Booking</th>
                                            <th>Total Fee</th>
                                            <th>Paid</th>
                                            <th>Pending</th>
                                            <th>Status</th>
                                            <th>Due Date</th>
                                            <th>Paid At</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(selectedStudent ? selectedStudent.payments : payments).length === 0 ? (
                                            <tr>
                                                <td colSpan="10">No payment records found for this student.</td>
                                            </tr>
                                        ) : (selectedStudent ? selectedStudent.payments : payments).map((payment) => (
                                            <tr key={payment.id}>
                                                <td>{payment.student_name || payment.student_registration}</td>
                                                <td>{payment.room_number ? `Room ${payment.room_number} / ${payment.bed_label || '-'}` : 'Not linked'}</td>
                                                <td>{payment.booking_id ? `#${payment.booking_id} (${payment.booking_status || 'unknown'})` : 'No booking'}</td>
                                                <td>Rs {Number(payment.amount || 0).toFixed(2)}</td>
                                                <td>Rs {Number(payment.paid_amount || 0).toFixed(2)}</td>
                                                <td>Rs {Number(payment.balance_amount || 0).toFixed(2)}</td>
                                                <td>{payment.payment_status}</td>
                                                <td>{payment.due_date || '-'}</td>
                                                <td>{payment.paid_at ? new Date(payment.paid_at).toLocaleString() : '-'}</td>
                                                <td className="actions-cell">
                                                    <button
                                                        onClick={() => openPaymentModal(payment)}
                                                        disabled={Number(payment.balance_amount || 0) <= 0}
                                                    >
                                                        Record Payment
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                    {paymentModal && (
                        <div className="payment-modal" role="dialog" aria-modal="true" aria-labelledby="paymentModalTitle">
                            <div className="payment-modal-card">
                                <h3 id="paymentModalTitle">Record Payment</h3>
                                <div className="payment-modal-summary">
                                    <p><strong>Student:</strong> {paymentModal.student_name || paymentModal.student_registration}</p>
                                    <p><strong>Room / Bed:</strong> {paymentModal.room_number ? `Room ${paymentModal.room_number} / ${paymentModal.bed_label || '-'}` : 'Not linked'}</p>
                                    <p><strong>Total Fee:</strong> Rs {Number(paymentModal.amount || 0).toFixed(2)}</p>
                                    <p><strong>Already Paid:</strong> Rs {Number(paymentModal.paid_amount || 0).toFixed(2)}</p>
                                    <p><strong>Pending:</strong> Rs {Number(paymentModal.balance_amount || 0).toFixed(2)}</p>
                                </div>
                                <label htmlFor="receivedAmount">Amount Received</label>
                                <input
                                    id="receivedAmount"
                                    type="number"
                                    min="0.01"
                                    max={Number(paymentModal.balance_amount || 0)}
                                    step="0.01"
                                    value={receivedAmount}
                                    onChange={(event) => setReceivedAmount(event.target.value)}
                                />
                                <div className="modal-actions">
                                    <button className="btn btn-primary" onClick={recordPayment}>Save Payment</button>
                                    <button className="btn btn-secondary" onClick={closePaymentModal}>Cancel</button>
                                </div>
                            </div>
                        </div>
                    )}
                </section>
            ) : activeTab === 'sms' ? (
                <section className="dashboard-section notifications-panel">
                    <h2>SMS Notification Logs</h2>
                    <div className="notification-form">
                        <textarea
                            className="sms-input"
                            rows={3}
                            value={newSmsMessage}
                            onChange={(e) => setNewSmsMessage(e.target.value)}
                        />
                        <button className="btn btn-primary" onClick={sendSms}>Send Notification</button>
                    </div>
                    <div className="table-scroll">
                        <table>
                            <thead>
                                <tr>
                                    <th>Date</th>
                                    <th>Subject</th>
                                    <th>Message</th>
                                    <th>Recipient</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {smsLogs.map((sms) => (
                                    <tr key={sms.id}>
                                        <td>{new Date(sms.created_at).toLocaleString()}</td>
                                        <td>{sms.subject}</td>
                                        <td>{sms.message}</td>
                                        <td>{sms.student_registration || sms.admin_username || 'System'}</td>
                                        <td>{sms.status}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </section>
            ) : activeTab === 'gallery' ? (
                <GalleryManagement />
            ) : activeTab === 'feedbacks' ? (
                <FeedbackManagement />
            ) : activeTab === 'admins' ? (
                <AdminRegistration />
            ) : (
                <div className="section admin-dashboard">
                    <div className="dashboard-header">
                        <div>
                            <h1>Dashboard Overview</h1>
                            <p>{dashboardLoading ? 'Refreshing live data...' : 'Latest booking, room, payment, and inquiry metrics'}</p>
                        </div>
                        <button className="btn btn-secondary" onClick={fetchData} disabled={dashboardLoading}>
                            {dashboardLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                    </div>

                    {summary && (
                        <div className="dashboard-summary">
                            <div className="summary-card">
                                <strong>{summary.total_bookings}</strong>
                                <p>Total Bookings</p>
                            </div>
                            <div className={`summary-card ${summary.pending_bookings > 5 ? 'warning' : ''}`}>
                                <strong className={summary.pending_bookings > 5 ? 'warning' : ''}>{summary.pending_bookings}</strong>
                                <p>Pending Bookings</p>
                            </div>
                            <div className="summary-card">
                                <strong>{summary.allocated_bookings || 0}</strong>
                                <p>Allocated Bookings</p>
                            </div>
                            <div className="summary-card success">
                                <strong className="success">{summary.completed_bookings || 0}</strong>
                                <p>Completed Bookings</p>
                            </div>
                            <div className={`summary-card ${summary.open_inquiries > 3 ? 'warning' : ''}`}>
                                <strong className={summary.open_inquiries > 3 ? 'warning' : ''}>{summary.open_inquiries}</strong>
                                <p>Open Inquiries</p>
                            </div>
                            <div className={`summary-card ${summary.due_payments > 0 ? 'danger' : ''}`}>
                                <strong className={summary.due_payments > 0 ? 'danger' : ''}>{summary.due_payments}</strong>
                                <p>Due Payments</p>
                            </div>
                            <div className="summary-card">
                                <strong>{summary.total_rooms}</strong>
                                <p>Total Rooms</p>
                            </div>
                            <div className={`summary-card ${summary.available_beds < 5 ? 'warning' : 'success'}`}>
                                <strong className={summary.available_beds < 5 ? 'warning' : 'success'}>{summary.available_beds}</strong>
                                <p>Available Beds</p>
                            </div>
                            <div className="summary-card">
                                <strong>{summary.allocated_beds || 0}</strong>
                                <p>Allocated Beds</p>
                            </div>
                            <div className="summary-card">
                                <strong>{summary.occupied_beds || 0}</strong>
                                <p>Occupied Beds</p>
                            </div>
                            <div className="summary-card success">
                                <strong className="success">₹{chartData.totalRevenue ? chartData.totalRevenue.toFixed(2) : '0.00'}</strong>
                                <p>Total Revenue</p>
                            </div>
                            <div className={`summary-card ${chartData.pendingRevenue > 10000 ? 'warning' : ''}`}>
                                <strong className={chartData.pendingRevenue > 10000 ? 'warning' : ''}>₹{chartData.pendingRevenue ? chartData.pendingRevenue.toFixed(2) : '0.00'}</strong>
                                <p>Pending Revenue</p>
                            </div>
                        </div>
                    )}

                    {chartData.bookingChart && (
                        <section className="dashboard-section">
                            <h2>Analytics Dashboard</h2>
                            <div className="alerts">
                                {(summary.total_beds > 0 && ((summary.allocated_beds || 0) + (summary.occupied_beds || 0)) / summary.total_beds > 0.8) && (
                                    <div className="alert alert-warning">High bed usage: {Math.round((((summary.allocated_beds || 0) + (summary.occupied_beds || 0)) / summary.total_beds) * 100)}% beds allocated or occupied.</div>
                                )}
                                {summary.pending_bookings > 5 && (
                                    <div className="alert alert-info">Many pending bookings: {summary.pending_bookings} awaiting allocation.</div>
                                )}
                                {summary.due_payments > 0 && (
                                    <div className="alert alert-danger">{summary.due_payments} payments are due.</div>
                                )}
                            </div>
                            <div className="charts-container">
                                <div className="chart-item">
                                    <h3>Booking Status Distribution</h3>
                                    <div className="bar-chart">
                                        {chartData.bookingChart.map((item, index) => (
                                            <div key={item.status} className="bar-item">
                                                <span>{item.status}: {item.count}</span>
                                                <div className="bar" style={{ width: `${(item.count / Math.max(...chartData.bookingChart.map(i => i.count), 1)) * 100}%`, backgroundColor: ['#0088FE', '#00C49F', '#FFBB28', '#FF8042'][index % 4] }}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="chart-item">
                                    <h3>Room Occupancy</h3>
                                    <div className="pie-chart">
                                        <div className="pie-legend">
                                            {chartData.occupancyChart.map((item, index) => (
                                                <div key={item.name}>
                                                    <span style={{ backgroundColor: ['#FF8042', '#0088FE', '#00C49F'][index] }}></span>
                                                    {item.name}: {item.value}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="chart-item">
                                    <h3>Payment Status Distribution</h3>
                                    <div className="bar-chart">
                                        {chartData.paymentChart.map((item) => (
                                            <div key={item.status} className="bar-item">
                                                <span>{item.status}: {item.count}</span>
                                                <div className="bar" style={{ width: `${(item.count / Math.max(...chartData.paymentChart.map(i => i.count), 1)) * 100}%`, backgroundColor: '#8884d8' }}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="chart-item">
                                    <h3>Inquiry Status Distribution</h3>
                                    <div className="bar-chart">
                                        {chartData.inquiryChart.map((item) => (
                                            <div key={item.status} className="bar-item">
                                                <span>{item.status}: {item.count}</span>
                                                <div className="bar" style={{ width: `${(item.count / Math.max(...chartData.inquiryChart.map(i => i.count), 1)) * 100}%`, backgroundColor: '#82ca9d' }}></div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </section>
                    )}
                </div>
            )}
        </AdminLayout>
    );
}
