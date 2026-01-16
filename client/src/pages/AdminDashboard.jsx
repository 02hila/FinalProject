// client/src/pages/AdminDashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader';
import './AdminDashboard.css';

const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
const AdminDashboard = () => {
    const { user, loading, handleLogout } = useAuth();
    const navigate = useNavigate();

    // State
    const [activeTab, setActiveTab] = useState('overview');
    const [systemStats, setSystemStats] = useState(null);
    const [users, setUsers] = useState([]);
    const [ads, setAds] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [userFilter, setUserFilter] = useState({ userType: '', search: '' });
    const [adFilter, setAdFilter] = useState({ status: '' });
    const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

    // Redirect if not admin
    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/login', { replace: true });
            } else if (user.userType !== 'admin') {
                navigate('/dashboard', { replace: true });
            }
        }
    }, [loading, user, navigate]);

    // Fetch system stats
    const fetchSystemStats = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/admin/system-stats`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setSystemStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching system stats:', error);
        } finally {
            setLoadingData(false);
        }
    }, []);

    // Fetch users
    const fetchUsers = useCallback(async (page = 1) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page,
                limit: 20,
                ...(userFilter.userType && { userType: userFilter.userType }),
                ...(userFilter.search && { search: userFilter.search })
            });

            const response = await fetch(`${API_URL}/api/admin/users?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setUsers(data.users);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        }
    }, [userFilter]);

    // Fetch ads
    const fetchAds = useCallback(async (page = 1) => {
        try {
            const token = localStorage.getItem('token');
            const params = new URLSearchParams({
                page,
                limit: 20,
                ...(adFilter.status && { status: adFilter.status })
            });

            const response = await fetch(`${API_URL}/api/admin/all-ads?${params}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                setAds(data.ads);
                setPagination(data.pagination);
            }
        } catch (error) {
            console.error('Error fetching ads:', error);
        }
    }, [adFilter]);

    // Initial load and polling
    useEffect(() => {
        if (user?.userType === 'admin') {
            setLoadingData(true);
            Promise.all([fetchSystemStats(), fetchUsers()]);

            // Poll stats every 30 seconds
            const statsInterval = setInterval(() => {
                fetchSystemStats();
            }, 30000);

            return () => clearInterval(statsInterval);
        }
    }, [user, fetchSystemStats, fetchUsers]);

    // Toggle user active status
    const toggleUserStatus = async (userId) => {
        if (!window.confirm('האם אתה בטוח?')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/admin/toggle-user/${userId}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert(data.message);
                fetchUsers();
            } else {
                alert('שגיאה: ' + data.message);
            }
        } catch (error) {
            console.error('Error toggling user:', error);
            alert('שגיאה בעדכון משתמש');
        }
    };

    // Delete user
    const deleteUser = async (userId) => {
        if (!window.confirm('האם אתה בטוח שברצונך למחוק משתמש זה? פעולה זו בלתי הפיכה!')) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/admin/delete-user/${userId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert('המשתמש נמחק בהצלחה');
                fetchUsers();
                fetchSystemStats();
            } else {
                alert('שגיאה: ' + data.message);
            }
        } catch (error) {
            console.error('Error deleting user:', error);
            alert('שגיאה במחיקת משתמש');
        }
    };

    // Delete ad
    const deleteAd = async (adId, adTitle) => {
        if (!window.confirm(`האם אתה בטוח שברצונך למחוק את הפרסומת "${adTitle || 'ללא כותרת'}"?\n\nפעולה זו בלתי הפיכה!`)) return;

        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/admin/delete-ad/${adId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            if (data.success) {
                alert('הפרסומת נמחקה בהצלחה');
                fetchAds();
                fetchSystemStats();
            } else {
                alert('שגיאה: ' + data.message);
            }
        } catch (error) {
            console.error('Error deleting ad:', error);
            alert('שגיאה במחיקת פרסומת');
        }
    };

    // Loading state
    if (loading || loadingData) {
        return (
            <div className="admin-loading">
                <div className="admin-loading-spinner">⏳</div>
                <div>טוען נתונים...</div>
            </div>
        );
    }

    if (!user || user.userType !== 'admin') {
        return null;
    }

    return (
        <div className="admin-dashboard">
            <SharedHeader 
    userType="admin"
    userName="מנהל מערכת" // ככה זה תמיד יציג "שלום, מנהל מערכת"
    onLogout={handleLogout}
/>

            <div className="admin-container">
    {/* Welcome Card */}
<div className="admin-welcome-card">
    <h1>🛡️ פאנל ניהול מערכת</h1>
    <p>ברוך הבא לממשק הניהול</p>
</div>

                {/* Tabs */}
                <div className="admin-tabs">
                    <button 
                        className={`admin-tab ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        📊 סקירה כללית
                    </button>
                    <button 
                        className={`admin-tab ${activeTab === 'users' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('users'); fetchUsers(); }}
                    >
                        👥 משתמשים
                    </button>
                    <button 
                        className={`admin-tab ${activeTab === 'ads' ? 'active' : ''}`}
                        onClick={() => { setActiveTab('ads'); fetchAds(); }}
                    >
                        📢 פרסומות
                    </button>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="admin-content">
                        <h2 className="admin-section-title">📈 סטטיסטיקות מערכת</h2>
                        
                        {loadingData || !systemStats ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
                                <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
                                <div>טוען נתונים...</div>
                            </div>
                        ) : (
                            <>
                                {/* Users Stats */}
                                <div className="admin-stats-section">
                                    <h3>👥 משתמשים</h3>
                                    <div className="admin-stats-grid">
                                        <div className="admin-stat-card total">
                                            <div className="admin-stat-icon">👥</div>
                                            <div className="admin-stat-value">{systemStats.users?.total || 0}</div>
                                            <div className="admin-stat-label">סה"כ משתמשים</div>
                                        </div>
                                        <div className="admin-stat-card agents">
                                            <div className="admin-stat-icon">🧑‍💼</div>
                                            <div className="admin-stat-value">{systemStats.users?.agents || 0}</div>
                                            <div className="admin-stat-label">סוכנים</div>
                                        </div>
                                        <div className="admin-stat-card companies">
                                            <div className="admin-stat-icon">🏢</div>
                                            <div className="admin-stat-value">{systemStats.users?.companies || 0}</div>
                                            <div className="admin-stat-label">חברות</div>
                                        </div>
                                        <div className="admin-stat-card admins">
                                            <div className="admin-stat-icon">🛡️</div>
                                            <div className="admin-stat-value">{systemStats.users?.admins || 0}</div>
                                            <div className="admin-stat-label">מנהלים</div>
                                        </div>
                                    </div>
                                </div>

                                {/* Ads Stats */}
                                <div className="admin-stats-section">
                                    <h3>📢 פרסומות</h3>
                                    <div className="admin-stats-grid">
                                        <div className="admin-stat-card total">
                                            <div className="admin-stat-icon">📊</div>
                                            <div className="admin-stat-value">{systemStats.ads?.total || 0}</div>
                                            <div className="admin-stat-label">סה"כ פרסומות</div>
                                        </div>
                                        <div className="admin-stat-card approved">
                                            <div className="admin-stat-icon">✅</div>
                                            <div className="admin-stat-value">{systemStats.ads?.approved || 0}</div>
                                            <div className="admin-stat-label">אושרו</div>
                                        </div>
                                        <div className="admin-stat-card pending">
                                            <div className="admin-stat-icon">⏳</div>
                                            <div className="admin-stat-value">{systemStats.ads?.pending || 0}</div>
                                            <div className="admin-stat-label">ממתינות</div>
                                        </div>
                                        <div className="admin-stat-card rejected">
                                            <div className="admin-stat-icon">❌</div>
                                            <div className="admin-stat-value">{systemStats.ads?.rejected || 0}</div>
                                            <div className="admin-stat-label">נדחו</div>
                                        </div>
                                    </div>

                                    {/* Approval Rate */}
                                    {systemStats.ads?.approvalRate !== undefined && (
                                        <div className="admin-approval-rate">
                                            <div className="admin-approval-bar">
                                                <div 
                                                    className="admin-approval-fill"
                                                    style={{ width: `${systemStats.ads.approvalRate}%` }}
                                                ></div>
                                            </div>
                                            <span className="admin-approval-text">
                                                אחוז אישור: {systemStats.ads.approvalRate}%
                                            </span>
                                        </div>
                                    )}
                                </div>

                                {/* Campaigns */}
                                <div className="admin-stats-section">
                                    <h3>🎯 קמפיינים</h3>
                                    <div className="admin-stat-card campaigns-total">
                                        <div className="admin-stat-icon">🎯</div>
                                        <div className="admin-stat-value">{systemStats.campaigns || 0}</div>
                                        <div className="admin-stat-label">סה"כ קמפיינים</div>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="admin-content">
                        <h2 className="admin-section-title">👥 ניהול משתמשים</h2>
                        
                        {/* Filters */}
                        <div className="admin-filters">
                            <select 
                                value={userFilter.userType}
                                onChange={(e) => setUserFilter(prev => ({ ...prev, userType: e.target.value }))}
                                className="admin-filter-input"
                            >
                                <option value="">כל סוגי המשתמשים</option>
                                <option value="agent">סוכנים</option>
                                <option value="company">חברות</option>
                                <option value="admin">מנהלים</option>
                            </select>
                            <input 
                                type="text"
                                placeholder="חיפוש לפי שם או אימייל..."
                                value={userFilter.search}
                                onChange={(e) => setUserFilter(prev => ({ ...prev, search: e.target.value }))}
                                className="admin-filter-input"
                            />
                            <button 
                                onClick={() => fetchUsers()}
                                className="admin-btn admin-btn-primary"
                            >
                                🔍 חפש
                            </button>
                        </div>

                        {/* Users Table */}
                        <div className="admin-table-container">
                            <table className="admin-table">
                                <thead>
                                    <tr>
                                        <th>שם</th>
                                        <th>אימייל</th>
                                        <th>סוג</th>
                                        <th>סטטוס</th>
                                        <th>תאריך הרשמה</th>
                                        <th>פעולות</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map(u => (
                                        <tr key={u._id}>
                                            <td>{u.fullName || u.companyName}</td>
                                            <td>{u.email}</td>
                                            <td>
                                                <span className={`admin-badge ${u.userType}`}>
                                                    {u.userType === 'agent' ? '🧑‍💼 סוכן' : 
                                                     u.userType === 'company' ? '🏢 חברה' : '🛡️ מנהל'}
                                                </span>
                                            </td>
                                            <td>
                                                <span className={`admin-status ${u.isActive ? 'active' : 'inactive'}`}>
                                                    {u.isActive ? '✅ פעיל' : '❌ מושבת'}
                                                </span>
                                            </td>
                                            <td>{new Date(u.createdAt).toLocaleDateString('he-IL')}</td>
                                            <td className="admin-actions">
                                                <button 
                                                    onClick={() => toggleUserStatus(u._id)}
                                                    className={`admin-btn ${u.isActive ? 'admin-btn-warning' : 'admin-btn-success'}`}
                                                    disabled={u._id === user._id}
                                                >
                                                    {u.isActive ? '🚫' : '✅'}
                                                </button>
                                                <button 
                                                    onClick={() => deleteUser(u._id)}
                                                    className="admin-btn admin-btn-danger"
                                                    disabled={u._id === user._id}
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {pagination.pages > 1 && (
                            <div className="admin-pagination">
                                <button 
                                    disabled={pagination.page === 1}
                                    onClick={() => fetchUsers(pagination.page - 1)}
                                    className="admin-btn"
                                >
                                    הקודם
                                </button>
                                <span>עמוד {pagination.page} מתוך {pagination.pages}</span>
                                <button 
                                    disabled={pagination.page === pagination.pages}
                                    onClick={() => fetchUsers(pagination.page + 1)}
                                    className="admin-btn"
                                >
                                    הבא
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Ads Tab */}
                {activeTab === 'ads' && (
                    <div className="admin-content">
                        <h2 className="admin-section-title">📢 כל הפרסומות</h2>
                        
                        {/* Filters */}
                        <div className="admin-filters">
                            <select 
                                value={adFilter.status}
                                onChange={(e) => setAdFilter({ status: e.target.value })}
                                className="admin-filter-input"
                            >
                                <option value="">כל הסטטוסים</option>
                                <option value="pending">ממתינות</option>
                                <option value="approved">אושרו</option>
                                <option value="rejected">נדחו</option>
                            </select>
                            <button 
                                onClick={() => fetchAds()}
                                className="admin-btn admin-btn-primary"
                            >
                                🔍 חפש
                            </button>
                        </div>

                        {/* Ads List */}
                        <div className="admin-ads-list">
                            {ads.length === 0 ? (
                                <div className="admin-empty">אין פרסומות להצגה</div>
                            ) : (
                                ads.map(ad => (
                                    <div key={ad._id} className="admin-ad-card">
                                        <div className="admin-ad-header">
                                            <h3>{ad.title || 'מודעה'}</h3>
                                            <span className={`admin-status ${ad.status}`}>
                                                {ad.status === 'pending' ? '⏳ ממתין' :
                                                 ad.status === 'approved' ? '✅ אושר' : '❌ נדחה'}
                                            </span>
                                        </div>
                                        <div className="admin-ad-info">
                                            <p><strong>סוכן:</strong> {ad.agentId?.fullName || 'לא ידוע'}</p>
                                            <p><strong>חברה:</strong> {ad.companyId?.companyName || ad.companyId?.fullName || 'לא ידוע'}</p>
                                            <p><strong>קמפיין:</strong> {ad.campaignId?.title || 'כללי'}</p>
                                            <p><strong>תאריך:</strong> {new Date(ad.createdAt).toLocaleDateString('he-IL')}</p>
                                            <p><strong>מזהה:</strong> <code style={{ fontSize: '11px', background: '#f0f0f0', padding: '2px 6px', borderRadius: '4px' }}>{ad._id}</code></p>
                                        </div>
                                        {ad.imageData && (
                                            <img src={ad.imageData} alt="Ad" className="admin-ad-image" />
                                        )}
                                        <div className="admin-ad-actions">
                                            <button
                                                onClick={() => deleteAd(ad._id, ad.title)}
                                                className="admin-btn admin-btn-danger admin-btn-delete-ad"
                                            >
                                                🗑️ מחק פרסומת
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;