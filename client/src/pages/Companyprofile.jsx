// client/src/pages/CompanyProfile.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, API_URL } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Companyprofile.css';

const CompanyProfile = () => {
    const { user, loading, handleLogout, loadUserFromToken, setUser } = useAuth();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [stats, setStats] = useState({
        approvedAds: 0,
        pendingAds: 0,
        activeCampaigns: 0,
        activeAgents: 0,
        totalAds: 0
    });
    const [formData, setFormData] = useState({
        companyName: '',
        email: '',
        phone: '',
        industry: '',
        companySize: '',
        website: '',
        address: '',
        description: '',
        contactPerson: ''
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [alert, setAlert] = useState({ show: false, type: '', message: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    // Fetch stats from server - like AgentDashboard
    const fetchStats = useCallback(async () => {
        if (!user?._id) return;
        
        try {
            const token = localStorage.getItem('token');
            const response = await fetch(`${API_URL}/api/company/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.stats) {
                setStats({
                    approvedAds: data.stats.ads?.approved || data.stats.approvedAds || 0,
                    pendingAds: data.stats.ads?.pending || data.stats.pendingAds || 0,
                    activeCampaigns: data.stats.campaigns?.active || data.stats.activeCampaigns || 0, 
                    activeAgents: data.stats.agents?.total || data.stats.activeAgents || 0,
                    totalAds: data.stats.ads?.total || data.stats.totalAds || 0
                });
            }
        } catch (error) {
            console.error('Error fetching company stats:', error);
        } finally {
            setStatsLoading(false);
        }
    }, [user?._id]);

    // Load stats on mount
    useEffect(() => {
        if (user?._id && !loading) {
            setStatsLoading(true);
            fetchStats();
        }
    }, [user?._id, loading, fetchStats]);

    // Poll stats every 30 seconds
    useEffect(() => {
        if (!user?._id || loading || isDeleting) return;

        const statsInterval = setInterval(() => {
            fetchStats();
        }, 30000);

        return () => clearInterval(statsInterval);
    }, [user?._id, loading, isDeleting, fetchStats]);

    useEffect(() => {
        if (user && user.userType === 'company') {
            setFormData({
                companyName: user.companyName || '',
                email: user.email || '',
                phone: user.phone || '',
                industry: user.industry || '',
                companySize: user.companySize || '',
                website: user.website || '',
                address: user.address || '',
                description: user.description || '',
                contactPerson: user.contactPerson || ''
            });
        }
    }, [user]);

    useEffect(() => {
        if (!loading && user && user.userType !== 'company') {
            navigate('/');
        }
    }, [user, loading, navigate]);

    useEffect(() => {
        if (alert.show) {
            const timer = setTimeout(() => {
                setAlert({ show: false, type: '', message: '' });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [alert.show]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', '✅ הפרופיל עודכן בהצלחה!');
                setIsEditing(false);
                await loadUserFromToken();
            } else {
                showAlert('error', '❌ שגיאה בעדכון הפרופיל: ' + (data.error || 'אנא נסה שוב'));
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            showAlert('error', '❌ שגיאת שרת. אנא נסה שוב מאוחר יותר.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleCancel = () => {
        setFormData({
            companyName: user.companyName || '',
            email: user.email || '',
            phone: user.phone || '',
            industry: user.industry || '',
            companySize: user.companySize || '',
            website: user.website || '',
            address: user.address || '',
            description: user.description || '',
            contactPerson: user.contactPerson || ''
        });
        setIsEditing(false);
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleSubmitPassword = async (e) => {
        e.preventDefault();
        if (passwordData.newPassword !== passwordData.confirmPassword) {
            showAlert('error', 'הסיסמאות אינן תואמות');
            return;
        }
        if (passwordData.newPassword.length < 6) {
            showAlert('error', 'הסיסמה חייבת להכיל לפחות 6 תווים');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/auth/change-password`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    currentPassword: passwordData.currentPassword,
                    newPassword: passwordData.newPassword
                })
            });

            let data;
            try {
                data = await response.json();
            } catch (parseError) {
                // If response is not JSON, treat as error
                data = { error: 'שגיאה בשינוי הסיסמה' };
            }

            // Handle wrong password or validation errors silently (no console errors)
            if (response.status === 400 || response.status === 401) {
                // Handle wrong password - do not log out user
                showAlert('error', data.error || '❌ הסיסמה הנוכחית שגויה');
                setPasswordData(prev => ({ ...prev, currentPassword: '' }));
                return;
            }

            if (response.status === 404) {
                showAlert('error', 'השרת לא זמין, אנא נסה שוב מאוחר יותר');
                return;
            }

            if (response.status === 500) {
                showAlert('error', 'שגיאה בשרת, אנא נסה שוב');
                return;
            }

            if (!response.ok) {
                showAlert('error', data.error || data.message || 'שגיאה בשינוי הסיסמה');
                return;
            }

            if (data.success) {
                showAlert('success', '✅ הסיסמה שונתה בהצלחה!');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                showAlert('error', data.error || data.message || 'שגיאה בשינוי הסיסמה');
            }
        } catch (error) {
            // Only log unexpected network errors, not validation errors
            // Handle network errors gracefully with popup
            showAlert('error', 'שגיאת רשת. אנא נסה שוב.');
        }
    };

    const deleteAccount = () => {
        setShowDeleteModal(true);
        setConfirmationText('');
    };

    const confirmDeleteAccount = async () => {
        if (confirmationText !== 'מחק לצמיתות') {
            showAlert('error', 'הטקסט שהוקלד אינו תואם. אנא הקלד "מחק לצמיתות"');
            return;
        }

        setIsDeleting(true);
        try {
            const response = await fetch(`${API_URL}/api/users/${user._id}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                showAlert('success', '✅ החשבון נמחק בהצלחה. מועבר לדף הכניסה...');
                setShowDeleteModal(false);

                // Clear local storage and redirect after a short delay
                setTimeout(() => {
                    localStorage.removeItem('token');
                    navigate('/login');
                }, 2000);
            } else {
                showAlert('error', data.message || 'שגיאה במחיקת החשבון');
            }
        } catch (error) {
            console.error('Error deleting account:', error);
            showAlert('error', 'שגיאת רשת. אנא נסה שוב.');
        } finally {
            setIsDeleting(false);
        }
    };

    const showAlert = (type, message) => {
        setAlert({ show: true, type, message });
    };

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>טוען...</p>
            </div>
        );
    }

    if (!user || user.userType !== 'company') {
        return null;
    }

    return (
        <div className="company-profile-body">
            {/* Navbar */}
            <nav className="company-profile-navbar">
                <div className="company-profile-navbar-brand">
                    <span>⚡</span>
                    <span>Ads Maker - פרופיל חברה</span>
                </div>
                <div className="company-profile-navbar-user">
                    <button 
                        onClick={() => navigate('/company-dashboard')} 
                        className="company-profile-btn-back"
                    >
                        ← חזרה לדשבורד
                    </button>
                    <span className="company-profile-user-badge">🏢 חברה</span>
                    <span>{user?.companyName || user?.fullName}</span>
                    <button className="company-profile-btn-logout" onClick={handleLogout}>
                        יציאה
                    </button>
                </div>
            </nav>

            {/* Alerts */}
            {alert.show && (
                <div className={`profile-alert ${alert.type}`}>
                    {alert.message}
                </div>
            )}

            {/* Container */}
            <div className="company-profile-container">
                {/* Header Card */}
                <div className="company-profile-header-card">
                    <div className="company-profile-avatar">
                        🏢
                    </div>
                    <div className="company-profile-header-info">
                        <h1>{user?.companyName || 'שם החברה'}</h1>
                        <p>{user?.industry || 'ענף עסקי'}</p>
                    </div>
                    {!isEditing && (
                        <button
                            onClick={() => setIsEditing(true)}
                            className="company-profile-btn-edit"
                        >
                            ✏️ ערוך פרופיל
                        </button>
                    )}
                </div>

                {/* Stats Cards */}
                <div className="company-profile-stats-grid">
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">✅</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value">
                                {statsLoading ? <span className="loading-dots">...</span> : stats.approvedAds}
                            </div>
                            <div className="company-profile-stat-label">מודעות מאושרות</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">⏳</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value">
                                {statsLoading ? <span className="loading-dots">...</span> : stats.pendingAds}
                            </div>
                            <div className="company-profile-stat-label">ממתינות לאישור</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">🚀</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value">
                                {statsLoading ? <span className="loading-dots">...</span> : stats.activeCampaigns}
                            </div>
                            <div className="company-profile-stat-label">קמפיינים פעילים</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">👥</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value">
                                {statsLoading ? <span className="loading-dots">...</span> : stats.activeAgents}
                            </div>
                            <div className="company-profile-stat-label">סוכנים פעילים</div>
                        </div>
                    </div>
                </div>

                {/* Profile Content */}
                <div className="company-profile-content-card">
                    <h2>פרטי החברה</h2>
                    
                    <div className="company-profile-form">
                        <div className="company-profile-form-row">
                            <div className="company-profile-form-group">
                                <label>שם החברה *</label>
                                <input
                                    type="text"
                                    name="companyName"
                                    value={formData.companyName}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                />
                            </div>
                            <div className="company-profile-form-group">
                                <label>אימייל *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                />
                            </div>
                        </div>

                        <div className="company-profile-form-row">
                            <div className="company-profile-form-group">
                                <label>טלפון</label>
                                <input
                                    type="tel"
                                    name="phone"
                                    value={formData.phone}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                    placeholder="050-1234567"
                                />
                            </div>
                            <div className="company-profile-form-group">
                                <label>ענף עסקי</label>
                                <input
                                    type="text"
                                    name="industry"
                                    value={formData.industry}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                    placeholder="טכנולוגיה, מזון, אופנה..."
                                />
                            </div>
                        </div>

                        <div className="company-profile-form-row">
                            <div className="company-profile-form-group">
                                <label>גודל החברה</label>
                                <select
                                    name="companySize"
                                    value={formData.companySize}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                >
                                    <option value="">בחר גודל חברה</option>
                                    <option value="1-10">1-10 עובדים</option>
                                    <option value="11-50">11-50 עובדים</option>
                                    <option value="51-200">51-200 עובדים</option>
                                    <option value="201-500">201-500 עובדים</option>
                                    <option value="500+">500+ עובדים</option>
                                </select>
                            </div>
                            <div className="company-profile-form-group">
                                <label>אתר אינטרנט</label>
                                <input
                                    type="url"
                                    name="website"
                                    value={formData.website}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                    placeholder="https://www.example.com"
                                />
                            </div>
                        </div>

                        <div className="company-profile-form-row">
                            <div className="company-profile-form-group">
                                <label>כתובת</label>
                                <input
                                    type="text"
                                    name="address"
                                    value={formData.address}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                    placeholder="רחוב, עיר"
                                />
                            </div>
                            <div className="company-profile-form-group">
                                <label>איש קשר</label>
                                <input
                                    type="text"
                                    name="contactPerson"
                                    value={formData.contactPerson}
                                    onChange={handleChange}
                                    disabled={!isEditing}
                                    className="company-profile-input"
                                    placeholder="שם מלא"
                                />
                            </div>
                        </div>

                        <div className="company-profile-form-group">
                            <label>תיאור החברה</label>
                            <textarea
                                name="description"
                                value={formData.description}
                                onChange={handleChange}
                                disabled={!isEditing}
                                className="company-profile-textarea"
                                rows="5"
                                placeholder="ספר לנו על החברה שלך..."
                            />
                        </div>

                        {isEditing && (
                            <div className="company-profile-form-actions">
                                <button 
                                    onClick={handleSave} 
                                    disabled={isSaving}
                                    className="company-profile-btn-save"
                                >
                                    {isSaving ? 'שומר...' : '💾 שמור שינויים'}
                                </button>
                                <button 
                                    onClick={handleCancel} 
                                    disabled={isSaving}
                                    className="company-profile-btn-cancel"
                                >
                                    ✖️ ביטול
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Password Form */}
                <div className="company-profile-content-card">
                    <h2 className="card-title">
                        <i className="fas fa-lock"></i>
                        שינוי סיסמה
                    </h2>

                    <form onSubmit={handleSubmitPassword}>
                        <div className="input-group">
                            <label>סיסמה נוכחית</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showCurrentPassword ? "text" : "password"}
                                    name="currentPassword"
                                    value={passwordData.currentPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="הזן סיסמה נוכחית"
                                    style={{ paddingLeft: '45px' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                                    style={{
                                        position: 'absolute',
                                        left: '12px',
                                        top: '50%',
                                        transform: 'translateY(-50%)',
                                        background: 'none',
                                        border: 'none',
                                        cursor: 'pointer',
                                        fontSize: '18px',
                                        padding: '0',
                                        display: 'flex',
                                        alignItems: 'center',
                                        color: '#666',
                                        zIndex: 10,
                                    }}
                                    tabIndex="-1"
                                >
                                    {showCurrentPassword ? '👁️' : '🔒'}
                                </button>
                            </div>
                        </div>

                        <div className="input-row">
                            <div className="input-group">
                                <label>סיסמה חדשה</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showNewPassword ? "text" : "password"}
                                        name="newPassword"
                                        value={passwordData.newPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="לפחות 6 תווים"
                                        style={{ paddingLeft: '45px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNewPassword(!showNewPassword)}
                                        style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '18px',
                                            padding: '0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: '#666',
                                            zIndex: 10,
                                        }}
                                        tabIndex="-1"
                                    >
                                        {showNewPassword ? '👁️' : '🔒'}
                                    </button>
                                </div>
                            </div>

                            <div className="input-group">
                                <label>אימות סיסמה</label>
                                <div style={{ position: 'relative' }}>
                                    <input
                                        type={showConfirmPassword ? "text" : "password"}
                                        name="confirmPassword"
                                        value={passwordData.confirmPassword}
                                        onChange={handlePasswordChange}
                                        placeholder="הזן שוב"
                                        style={{ paddingLeft: '45px' }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                        style={{
                                            position: 'absolute',
                                            left: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            fontSize: '18px',
                                            padding: '0',
                                            display: 'flex',
                                            alignItems: 'center',
                                            color: '#666',
                                            zIndex: 10,
                                        }}
                                        tabIndex="-1"
                                    >
                                        {showConfirmPassword ? '👁️' : '🔒'}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn-primary">
                            <i className="fas fa-key"></i>
                            שנה סיסמה
                        </button>
                    </form>
                </div>

                {/* Danger Zone */}
                <div className="company-profile-content-card danger-card">
                    <h2 className="card-title danger">
                        <i className="fas fa-exclamation-triangle"></i>
                        אזור מסוכן
                    </h2>
                    <p className="danger-text">
                        מחיקת החשבון תמחק לצמיתות את כל המודעות, הקמפיינים, הדירוגים והנתונים שלך. פעולה זו בלתי הפיכה.
                    </p>
                    <button className="btn-danger" onClick={deleteAccount}>
                        <i className="fas fa-trash"></i>
                        מחק חשבון לצמיתות
                    </button>
                </div>

                {/* Delete Confirmation Modal */}
                {showDeleteModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowDeleteModal(false)}
                        style={{
                            position: 'fixed',
                            top: 0,
                            left: 0,
                            width: '100%',
                            height: '100%',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            zIndex: 1000
                        }}
                    >
                        <div
                            className="modal-content"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                padding: '20px',
                                maxWidth: '400px',
                                width: '90%',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                textAlign: 'center'
                            }}
                        >
                            <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
                            <h3 style={{ marginBottom: '15px', color: '#d32f2f' }}>מחיקת חשבון לצמיתות</h3>
                            <p style={{ marginBottom: '20px', color: '#666' }}>
                                פעולה זו תמחק לצמיתות את החשבון שלך ואת כל הנתונים הקשורים אליו.
                                כדי לאשר, הקלד "מחק לצמיתות" בשדה למטה.
                            </p>
                            <div style={{ marginBottom: '20px' }}>
                                <input
                                    type="text"
                                    value={confirmationText}
                                    onChange={(e) => setConfirmationText(e.target.value)}
                                    placeholder="מחק לצמיתות"
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        border: '2px solid #ccc',
                                        borderRadius: '4px',
                                        fontSize: '16px',
                                        textAlign: 'center'
                                    }}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowDeleteModal(false)}
                                    style={{
                                        padding: '12px 24px',
                                        border: '2px solid #666',
                                        borderRadius: '6px',
                                        backgroundColor: 'white',
                                        color: '#666',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        minWidth: '100px'
                                    }}
                                    onMouseOver={(e) => {
                                        e.target.style.backgroundColor = '#f5f5f5';
                                        e.target.style.borderColor = '#333';
                                    }}
                                    onMouseOut={(e) => {
                                        e.target.style.backgroundColor = 'white';
                                        e.target.style.borderColor = '#666';
                                    }}
                                >
                                    ביטול
                                </button>
                                <button
                                    className="btn-danger"
                                    onClick={confirmDeleteAccount}
                                    disabled={isDeleting}
                                    style={{
                                        padding: '12px 24px',
                                        border: '2px solid #d32f2f',
                                        borderRadius: '6px',
                                        backgroundColor: '#d32f2f',
                                        color: 'white',
                                        fontSize: '16px',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        transition: 'all 0.3s',
                                        minWidth: '100px'
                                    }}
                                    onMouseOver={(e) => {
                                        e.target.style.backgroundColor = '#b71c1c';
                                        e.target.style.borderColor = '#b71c1c';
                                    }}
                                    onMouseOut={(e) => {
                                        e.target.style.backgroundColor = '#d32f2f';
                                        e.target.style.borderColor = '#d32f2f';
                                    }}
                                >
                                    {isDeleting ? (
                                        <>
                                            <i className="fas fa-spinner fa-spin" style={{ marginRight: '8px' }}></i>
                                            מוחק...
                                        </>
                                    ) : (
                                        <>
                                            <i className="fas fa-trash" style={{ marginRight: '8px' }}></i>
                                            כן, מחק לצמיתות
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyProfile;