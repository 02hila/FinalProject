/**
 * AgentProfile Component
 *
 * This component provides a comprehensive profile management interface for agents.
 * It allows agents to view and edit their personal information, manage social media profiles,
 * change passwords, and view performance statistics including ad counts and ratings.
 *
 * Key Features:
 * - Profile editing with form validation
 * - Social media platform integration with handle parsing
 * - Password change functionality
 * - Real-time statistics display (total ads, approved, pending, rejected, average rating)
 * - Auto-refreshing stats every 30 seconds
 * - Account deletion placeholder (feature in development)
 *
 * The component fetches agent statistics from the backend and displays them in a grid layout.
 * Social media handles are parsed and formatted for different platforms (Instagram, Facebook, etc.).
 * All UI text is in Hebrew to maintain site functionality for Hebrew-speaking users.
 *
 * @component
 * @returns {JSX.Element} The agent profile page
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, API_URL } from '../context/AuthContext';
import './AgentProfile.css';

const AgentProfile = () => {
    const navigate = useNavigate();
    const { user, loading, loadUserFromToken, setUser, handleLogout } = useAuth();
    const [isEditMode, setIsEditMode] = useState(false);
    const [statsLoading, setStatsLoading] = useState(true);
    const [agentStats, setAgentStats] = useState({
        totalAds: 0,
        approvedAds: 0,
        pendingAds: 0,
        rejectedAds: 0,
        averageRating: 0,
        totalRatings: 0
    });
    const [formData, setFormData] = useState({
        fullName: '',
        email: '',
        phone: '',
        specialty: 'general',
        bio: '',
        skills: '',
        socialMediaPlatform: '',
        socialMediaHandle: '',
    });
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
    });
    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [alert, setAlert] = useState({ show: false, type: '', message: '' });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [showPreliminaryDeleteModal, setShowPreliminaryDeleteModal] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [confirmationText, setConfirmationText] = useState('');
    const [formKey, setFormKey] = useState(0);

    const token = localStorage.getItem('token');

    // ✅ Fetch stats from server - like AgentDashboard
    const fetchStats = useCallback(async () => {
        if (!user?._id) return;
        
        try {
            const response = await fetch(`${API_URL}/api/agents/${user._id}/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            
            const data = await response.json();
            
            if (data.success && data.stats) {
                setAgentStats({
                    totalAds: data.stats.totalAds || 0,
                    approvedAds: data.stats.approved || 0,
                    pendingAds: data.stats.pending || 0,
                    rejectedAds: data.stats.rejected || 0,
                    averageRating: data.stats.averageRating || user?.stats?.averageRating || 0,
                    totalRatings: data.stats.totalRatings || user?.stats?.totalRatings || 0
                });
            }
        } catch (error) {
            console.error('Error fetching agent stats:', error);
            // Fallback to user stats from context
            if (user?.stats) {
                setAgentStats({
                    totalAds: user.stats.totalAds || 0,
                    approvedAds: user.stats.approvedAds || 0,
                    pendingAds: user.stats.pendingAds || 0,
                    rejectedAds: user.stats.rejectedAds || 0,
                    averageRating: user.stats.averageRating || 0,
                    totalRatings: user.stats.totalRatings || 0
                });
            }
        } finally {
            setStatsLoading(false);
        }
    }, [user?._id, user?.stats, token]);

    // ✅ Load stats on mount
    useEffect(() => {
        if (user?._id && !loading) {
            setStatsLoading(true);
            fetchStats();
        }
    }, [user?._id, loading, fetchStats]);

    // ✅ Poll stats every 30 seconds
    useEffect(() => {
        if (!user?._id || loading) return;
        
        const statsInterval = setInterval(() => {
            fetchStats();
        }, 30000);

        return () => clearInterval(statsInterval);
    }, [user?._id, loading, fetchStats]);

    // ✅ Parse social media handle on load
    const parseSocialMediaHandle = (handle) => {
        if (!handle) return { platform: '', username: '' };

        // Check if it contains platform indicators
        if (handle.includes('instagram') || handle.includes('insta')) {
            return { platform: 'instagram', username: handle.replace(/@|instagram\.com\/|insta/gi, '').trim() };
        }
        if (handle.includes('facebook') || handle.includes('fb')) {
            return { platform: 'facebook', username: handle.replace(/@|facebook\.com\/|fb\.com\//gi, '').trim() };
        }
        if (handle.includes('tiktok')) {
            return { platform: 'tiktok', username: handle.replace(/@|tiktok\.com\/@?/gi, '').trim() };
        }
        if (handle.includes('linkedin')) {
            return { platform: 'linkedin', username: handle.replace(/linkedin\.com\/in\//gi, '').trim() };
        }
        if (handle.includes('twitter') || handle.includes('x.com')) {
            return { platform: 'twitter', username: handle.replace(/@|twitter\.com\/|x\.com\//gi, '').trim() };
        }

        // If it starts with @, assume it's just a username
        if (handle.startsWith('@')) {
            return { platform: 'other', username: handle.substring(1) };
        }

        return { platform: 'other', username: handle };
    };

    useEffect(() => {
        if (user) {
            const { platform, username } = parseSocialMediaHandle(user.socialMediaHandle);
            
            setFormData({
                fullName: user.fullName || '',
                email: user.email || '',
                phone: user.phone || '',
                specialty: user.specialty || 'general',
                bio: user.bio || '',
                skills: user.skills || '',
                socialMediaPlatform: user.socialMediaPlatform || platform || '',
                socialMediaHandle: user.socialMediaHandle ? username : '',
            });
        }
    }, [user]);

    useEffect(() => {
        if (alert.show) {
            const timer = setTimeout(() => {
                setAlert({ show: false, type: '', message: '' });
            }, 5000);
            return () => clearTimeout(timer);
        }
    }, [alert.show]);

    const handleInputChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handlePasswordChange = (e) => {
        setPasswordData({ ...passwordData, [e.target.name]: e.target.value });
    };

    // ✅ Build full social media handle for saving
    const buildSocialMediaHandle = () => {
        if (!formData.socialMediaHandle) return '';

        const username = formData.socialMediaHandle.replace('@', '');

        switch (formData.socialMediaPlatform) {
            case 'instagram':
                return `@${username}`;
            case 'facebook':
                return `facebook.com/${username}`;
            case 'tiktok':
                return `@${username}`;
            case 'linkedin':
                return username.includes('linkedin.com') ? username : `linkedin.com/in/${username}`;
            case 'twitter':
                return `@${username}`;
            default:
                return formData.socialMediaHandle;
        }
    };

    const handleSubmitProfile = async (e) => {
        e.preventDefault();
        try {
            const socialHandle = buildSocialMediaHandle();
            
            const response = await fetch(`${API_URL}/api/auth/profile`, {
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
                    skills: formData.skills,
                    socialMediaPlatform: formData.socialMediaPlatform,
                    socialMediaHandle: socialHandle
                })
            });

            const data = await response.json();
            if (data.success) {
                showAlert('success', '✅ הפרופיל עודכן בהצלחה!');
                setIsEditMode(false);
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
            const response = await fetch(`${API_URL}/api/auth/change-password`, {
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
        setShowPreliminaryDeleteModal(true);
    };

    const proceedToConfirmation = () => {
        setShowPreliminaryDeleteModal(false);
        setShowDeleteModal(true);
    };

    const confirmDeleteAccount = async () => {
        if (confirmationText !== 'מחק לצמיתות') {
            showAlert('error', 'אנא הקלד את הטקסט הנכון לאישור המחיקה');
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

    const specialtyNames = {
        'social': '📱 רשתות חברתיות',
        'google': '🔍 פרסום בגוגל',
        'creative': '🎨 קריאייטיב ועיצוב',
        'analytics': '📊 אנליטיקס ונתונים',
        'general': '🌐 כללי'
    };

    const socialPlatforms = [
        { value: '', label: 'בחר רשת חברתית' },
        { value: 'instagram', label: '📸 אינסטגרם', icon: '📸' },
        { value: 'facebook', label: '📘 פייסבוק', icon: '📘' },
        { value: 'tiktok', label: '🎵 טיקטוק', icon: '🎵' },
        { value: 'linkedin', label: '💼 לינקדאין', icon: '💼' },
        { value: 'twitter', label: '🐦 טוויטר/X', icon: '🐦' },
        { value: 'other', label: '🔗 אחר', icon: '🔗' },
    ];

    const getPlaceholder = () => {
        switch (formData.socialMediaPlatform) {
            case 'instagram': return '@username';
            case 'facebook': return 'שם העמוד או הפרופיל';
            case 'tiktok': return '@username';
            case 'linkedin': return 'linkedin.com/in/username';
            case 'twitter': return '@username';
            default: return 'קישור או שם משתמש';
        }
    };

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
                    
                    {/* ✅ Display social media if exists */}
                    {(formData.socialMediaPlatform || formData.socialMediaHandle) && (
                        <div className="social-badge">
                            <span>
                                {socialPlatforms.find(p => p.value === formData.socialMediaPlatform)?.icon || '🔗'}
                            </span>
                            <span>{formData.socialMediaHandle || buildSocialMediaHandle()}</span>
                        </div>
                    )}
                    
                    {user?.userType === 'agent' && (
                        <div className="rating-badge">
                            <span>⭐</span>
                            <span>
                                {statsLoading ? '...' : (agentStats.averageRating > 0 ? agentStats.averageRating.toFixed(1) : 'חדש')}
                            </span>
                            <span>({statsLoading ? '...' : agentStats.totalRatings} דירוגים)</span>
                        </div>
                    )}

                    {/* ✅ Stats from server */}
                    <div className="stats-grid">
                        <div className="stat-box">
                            <div className="stat-number">
                                {statsLoading ? <span className="loading-dots">...</span> : agentStats.totalAds}
                            </div>
                            <div className="stat-text">סה"כ מודעות</div>
                        </div>
                        <div className="stat-box approved">
                            <div className="stat-number">
                                {statsLoading ? <span className="loading-dots">...</span> : agentStats.approvedAds}
                            </div>
                            <div className="stat-text">מאושרות</div>
                        </div>
                        <div className="stat-box pending">
                            <div className="stat-number">
                                {statsLoading ? <span className="loading-dots">...</span> : agentStats.pendingAds}
                            </div>
                            <div className="stat-text">ממתינות</div>
                        </div>
                        <div className="stat-box rejected">
                            <div className="stat-number">
                                {statsLoading ? <span className="loading-dots">...</span> : agentStats.rejectedAds}
                            </div>
                            <div className="stat-text">נדחו</div>
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

                        {/* ✅ Social Media Section */}
                        <div className="social-media-section">
                            <label className="section-label">רשת חברתית</label>
                            <div className="social-media-inputs">
                                <div className="input-group social-platform">
                                    <label>פלטפורמה</label>
                                    <select
                                        name="socialMediaPlatform"
                                        value={formData.socialMediaPlatform}
                                        onChange={handleInputChange}
                                        disabled={!isEditMode}
                                        className="platform-select"
                                    >
                                        {socialPlatforms.map(platform => (
                                            <option key={platform.value} value={platform.value}>
                                                {platform.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                
                                <div className="input-group social-handle">
                                    <label>שם משתמש</label>
                                    <input
                                        type="text"
                                        name="socialMediaHandle"
                                        value={formData.socialMediaHandle}
                                        onChange={handleInputChange}
                                        disabled={!isEditMode || !formData.socialMediaPlatform}
                                        placeholder={getPlaceholder()}
                                        className="handle-input"
                                    />
                                </div>
                            </div>
                            {formData.socialMediaPlatform && formData.socialMediaHandle && (
                                <div className="social-preview">
                                    <span className="preview-label">תצוגה מקדימה:</span>
                                    <span className="preview-value">
                                        {socialPlatforms.find(p => p.value === formData.socialMediaPlatform)?.icon}{' '}
                                        {buildSocialMediaHandle()}
                                    </span>
                                </div>
                            )}
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
                    
                    <form key={formKey} onSubmit={handleSubmitPassword}>
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
                <div className="profile-card danger-card">
                    <h2 className="card-title danger">
                        <i className="fas fa-exclamation-triangle"></i>
                        אזור מסוכן
                    </h2>
                    <p className="danger-text">
                        פעולה זו תמחק לצמיתות את החשבון שלך ואת כל הנתונים הקשורים אליו.
                    </p>
                    <button className="btn-danger" onClick={deleteAccount}>
                        <i className="fas fa-trash"></i>
                        מחק חשבון לצמיתות
                    </button>
                </div>

                {/* Preliminary Delete Modal */}
                {showPreliminaryDeleteModal && (
                    <div
                        className="modal-overlay"
                        onClick={() => setShowPreliminaryDeleteModal(false)}
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
                                האם אתה בטוח שברצונך להמשיך?
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowPreliminaryDeleteModal(false)}
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
                                    onClick={proceedToConfirmation}
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
                                    המשך
                                </button>
                            </div>
                        </div>
                    </div>
                )}

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
                            className="modal-content delete-modal"
                            onClick={(e) => e.stopPropagation()}
                            style={{
                                backgroundColor: 'white',
                                borderRadius: '8px',
                                padding: '20px',
                                maxWidth: '500px',
                                width: '90%',
                                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                                maxHeight: '80vh',
                                overflowY: 'auto'
                            }}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title danger">
                                    <i className="fas fa-exclamation-triangle"></i>
                                    אישור מחיקת חשבון
                                </h3>
                            </div>
                            <div className="modal-body">
                                <div className="delete-warning" style={{ textAlign: 'center', padding: '20px 0' }}>
                                    <div style={{ fontSize: '48px', marginBottom: '15px' }}>⚠️</div>
                                    <p className="warning-text" style={{ fontSize: '18px', fontWeight: 'bold', color: '#d32f2f', marginBottom: '15px' }}>
                                        פעולה זו בלתי הפיכה!
                                    </p>
                                    <p style={{ fontSize: '16px', marginBottom: '20px', color: '#666' }}>
                                        מחיקת החשבון תגרום למחיקה של:
                                    </p>
                                    <ul className="delete-list" style={{ listStyle: 'none', padding: 0, margin: '0 auto', maxWidth: '300px' }}>
                                        <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>📢 כל המודעות והתוכן שיצרת</li>
                                        <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>📋 כל הקמפיינים והפרויקטים</li>
                                        <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>⭐ כל הדירוגים והביקורות</li>
                                        <li style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>👤 כל הנתונים האישיים והפרופיל</li>
                                        <li style={{ padding: '8px 0' }}>💳 כל התשלומים וההיסטוריה הפיננסית</li>
                                    </ul>
                                    <p className="confirm-text" style={{ marginTop: '25px', fontSize: '14px', color: '#666' }}>
                                        כדי לאשר את המחיקה, הקלד <strong>"מחק לצמיתות"</strong> בתיבה למטה:
                                    </p>
                                    <input
                                        type="text"
                                        value={confirmationText}
                                        onChange={(e) => setConfirmationText(e.target.value)}
                                        placeholder="הקלד 'מחק לצמיתות'"
                                        className="confirmation-input"
                                        style={{
                                            width: '100%',
                                            maxWidth: '300px',
                                            padding: '12px',
                                            border: '2px solid #ddd',
                                            borderRadius: '6px',
                                            marginTop: '10px',
                                            fontSize: '16px',
                                            textAlign: 'center',
                                            outline: 'none',
                                            transition: 'border-color 0.3s'
                                        }}
                                        onFocus={(e) => e.target.style.borderColor = '#2196f3'}
                                        onBlur={(e) => e.target.style.borderColor = '#ddd'}
                                    />
                                </div>
                            </div>
                            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'center', gap: '15px', padding: '20px', borderTop: '1px solid #eee' }}>
                                <button
                                    className="btn-secondary"
                                    onClick={() => setShowDeleteModal(false)}
                                    disabled={isDeleting}
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
                                        minWidth: '120px'
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
                                        minWidth: '120px'
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

export default AgentProfile;