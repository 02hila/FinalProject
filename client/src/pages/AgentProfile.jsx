import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const AgentProfile = () => {
    const navigate = useNavigate();
    const { user, loading, loadUserFromToken } = useAuth();
    const [isEditMode, setIsEditMode] = useState(false);
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        specialty: 'general',
        bio: '',
        skills: '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [alert, setAlert] = useState({ show: false, type: '', message: '' });

    const API_URL = 'https://adsmaker.onrender.com/api';
    const token = localStorage.getItem('token');

    useEffect(() => {
        // Initialize form data immediately from context if it exists
        if (user) {
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                specialty: user.specialty || 'general',
                bio: user.bio || '',
                skills: user.skills || ''
            });
        }
    }, [user]);

    // ✅ FIX: Cleanup timer to prevent memory leak
    useEffect(() => {
        if (alert.show) {
            const timer = setTimeout(() => {
                setAlert({ show: false, type: '', message: '' });
            }, 5000);

            // Cleanup function - runs when component unmounts or before next effect
            return () => clearTimeout(timer);
        }
    }, [alert.show]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    const handleSubmitProfile = async (e) => {
        e.preventDefault();
        try {
            const response = await fetch(`${API_URL}/auth/profile`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    fullName: formData.fullName,
                    phone: formData.phone,
                    specialty: formData.specialty,
                    bio: formData.bio,
                    skills: formData.skills
                })
            });

            const data = await response.json();
            if (data.success) {
                showAlert('success', '✅ הפרופיל עודכן בהצלחה!');
                setIsEditMode(false);
                // This will re-fetch the user data AND their stats, updating the global context.
                await loadUserFromToken();
            } else {
                showAlert('error', data.error || 'שגיאה בעדכון הפרופיל');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('error', 'שגיאת רשת. אנא נסה שוב.');
        }
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

            const data = await response.json();
            if (data.success) {
                showAlert('success', '✅ הסיסמה שונתה בהצלחה!');
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                showAlert('error', data.error || 'שגיאה בשינוי הסיסמה');
            }
        } catch (error) {
            console.error('Error:', error);
            showAlert('error', 'שגיאת רשת. אנא נסה שוב.');
        }
    };

    const deleteAccount = () => {
        if (!window.confirm('⚠️ האם אתה בטוח שברצונך למחוק את החשבון?\nפעולה זו בלתי הפיכה!')) return;
        const confirm2 = window.prompt('אנא הקלד "מחק" כדי לאשר:');
        if (confirm2 !== 'מחק') {
            alert('המחיקה בוטלה');
            return;
        }
        alert('🚧 פיצ\'ר בפיתוח');
    };

    const showAlert = (type, message) => {
        setAlert({ show: true, type, message });
    };

    const specialtyNames = {
        'social': '📱 רשתות חברתיות',
        'google': '🔍 פרסום בגוגל',
        'creative': '🎨 קריאייטיב ועיצוב',
        'analytics': '📊 אנליטיקס ונתונים',
        'general': '🌐 כללי'
    };

    // Show loader only if the context is loading and we don't have a user yet
    if (loading && !user) { 
        return (
            <div className="loading" style={{
                height: '100vh', 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'center'
            }}>
                טוען...
            </div>
        );
    }

    return (
        <div className="agent-profile-page">
            {/* Navbar */}
            <nav className="profile-navbar">
                <div className="navbar-brand">
                    <span>⚡</span>
                    <span>הפרופיל שלי</span>
                </div>
                <button className="back-btn" onClick={() => navigate('/agent-dashboard')}>
                    <i className="fas fa-arrow-right"></i>
                    חזרה לדשבורד
                </button>
            </nav>

            {/* Alerts */}
            {alert.show && (
                <div className={`profile-alert ${alert.type}`}>
                    {alert.message}
                </div>
            )}

            <div className="profile-container">
                {/* Profile Header */}
                <div className="profile-card">
                    <div className="profile-avatar">
                        {user?.fullName?.charAt(0) || '?'}
                    </div>
                    <h1 className="profile-title">{user?.fullName || user?.email}</h1>
                    <span className="profile-badge">
                        {specialtyNames[user?.specialty] || '🌐 כללי'}
                    </span>
                    
                    {user?.userType === 'agent' && ( // Stats should come from the live user object
                        <div className="rating-badge">
                            <span>⭐</span>
                            <span>{user?.stats?.averageRating > 0 ? user.stats.averageRating.toFixed(1) : 'חדש'}</span>
                            <span>({user?.stats?.totalRatings || 0} דירוגים)</span>
                        </div>
                    )}

                    <div className="stats-grid">
                        <div className="stat-box">
                            <div className="stat-number">{user?.stats?.totalAds || 0}</div>
                            <div className="stat-text">מודעות</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-number">{user?.stats?.approvedAds || 0}</div>
                            <div className="stat-text">מאושרות</div>
                        </div>
                        <div className="stat-box">
                            <div className="stat-number">{user?.stats?.pendingAds || 0}</div>
                            <div className="stat-text">ממתינות</div>
                        </div>
                    </div>
                </div>

                {/* Profile Form */}
                <div className="profile-card">
                    <h2 className="card-title">
                        <i className="fas fa-user"></i>
                        פרטים אישיים
                    </h2>
                    
                    <form onSubmit={handleSubmitProfile}>
                        <div className="input-group">
                            <label>שם מלא</label>
                            <input
                                type="text"
                                name="fullName"
                                value={formData.fullName}
                                onChange={handleInputChange}
                                disabled={!isEditMode}
                            />
                        </div>

                        <div className="input-group">
                            <label>אימייל</label>
                            <input
                                type="email"
                                name="email"
                                value={formData.email}
                                disabled
                            />
                        </div>

                        <div className="input-group">
                            <label>טלפון</label>
                            <input
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleInputChange}
                                disabled={!isEditMode}
                                placeholder="050-1234567"
                            />
                        </div>

                        <div className="input-group">
                            <label>התמחות</label>
                            <select
                                name="specialty"
                                value={formData.specialty}
                                onChange={handleInputChange}
                                disabled={!isEditMode}
                            >
                                <option value="general">כללי</option>
                                <option value="social">רשתות חברתיות</option>
                                <option value="google">פרסום בגוגל</option>
                                <option value="creative">קריאייטיב ועיצוב</option>
                                <option value="analytics">אנליטיקס ונתונים</option>
                            </select>
                        </div>

                        <div className="input-group">
                            <label>אודות</label>
                            <textarea
                                name="bio"
                                value={formData.bio}
                                onChange={handleInputChange}
                                disabled={!isEditMode}
                                placeholder="ספר קצת על עצמך..."
                            />
                        </div>

                        <div className="input-group">
                            <label>כישורים (הפרד בפסיקים)</label>
                            <input
                                type="text"
                                name="skills"
                                value={formData.skills}
                                onChange={handleInputChange}
                                disabled={!isEditMode}
                                placeholder="פייסבוק, אינסטגרם, גוגל אדס..."
                            />
                        </div>

                        <div className="button-group">
                            {!isEditMode ? (
                                <button type="button" className="btn-primary" onClick={() => setIsEditMode(true)}>
                                    <i className="fas fa-edit"></i>
                                    ערוך פרופיל
                                </button>
                            ) : (
                                <>
                                    <button type="button" className="btn-secondary" onClick={() => setIsEditMode(false)}>
                                        <i className="fas fa-times"></i>
                                        ביטול
                                    </button>
                                    <button type="submit" className="btn-primary">
                                        <i className="fas fa-save"></i>
                                        שמור שינויים
                                    </button>
                                </>
                            )}
                        </div>
                    </form>
                </div>

                {/* Password Form */}
                <div className="profile-card">
                    <h2 className="card-title">
                        <i className="fas fa-lock"></i>
                        שינוי סיסמה
                    </h2>
                    
                    <form onSubmit={handleSubmitPassword}>
                        <div className="input-group">
                            <label>סיסמה נוכחית</label>
                            <input
                                type="password"
                                name="currentPassword"
                                value={passwordData.currentPassword}
                                onChange={handlePasswordChange}
                                placeholder="הזן סיסמה נוכחית"
                            />
                        </div>

                        <div className="input-row">
                            <div className="input-group">
                                <label>סיסמה חדשה</label>
                                <input
                                    type="password"
                                    name="newPassword"
                                    value={passwordData.newPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="לפחות 6 תווים"
                                />
                            </div>

                            <div className="input-group">
                                <label>אימות סיסמה</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={passwordData.confirmPassword}
                                    onChange={handlePasswordChange}
                                    placeholder="הזן שוב"
                                />
                            </div>
                        </div>

                        <button type="submit" className="btn-primary">
                            <i className="fas fa-key"></i>
                            שנה סיסמה
                        </button>
                    </form>
                </div>

                {/* Danger Zone */}
                <div className="profile-card danger-card">
                    <h2 className="card-title danger">
                        <i className="fas fa-exclamation-triangle"></i>
                        אזור מסוכן
                    </h2>
                    <p className="danger-text">
                        מחיקת החשבון תמחק לצמיתות את כל המודעות והקמפיינים שלך. פעולה זו בלתי הפיכה.
                    </p>
                    <button className="btn-danger" onClick={deleteAccount}>
                        <i className="fas fa-trash"></i>
                        מחק חשבון לצמיתות
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgentProfile;