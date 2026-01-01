// client/src/pages/CompanyProfile.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import './Companyprofile.css';
import { getHistory, getPendingAds } from '../services/companyService';

const API_URL = 'https://adsmaker.onrender.com/api';
const CompanyProfile = () => {
    const { user, loading, handleLogout, loadUserFromToken } = useAuth();
    const navigate = useNavigate();
    const token = localStorage.getItem('token');
    
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [statsLoaded, setStatsLoaded] = useState(false);
    const [stats, setStats] = useState({
        approvedAds: 0,
        pendingAds: 0,
        activeCampaigns: 0,
        activeAgents: 0
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

    
    useEffect(() => {
        const loadStats = async () => {
            if (!user?._id || statsLoaded) return;
            
            try {
                // Use the same service as dashboard
                const historyData = await getHistory(user._id);
                
                if (historyData.success && historyData.ads) {
                    const approved = historyData.ads.filter(ad => ad.status === 'approved').length;
                    const pending = historyData.ads.filter(ad => ad.status === 'pending').length;
                    
                    setStats({
                        approvedAds: approved,
                        pendingAds: pending,
                        activeCampaigns: 0, // Will be updated when campaigns API is ready
                        activeAgents: 0 // Will be updated when agents API is ready
                    });
                    setStatsLoaded(true);
                }
            } catch (error) {
                console.error('Error loading stats:', error);
                // Set as loaded even on error to prevent infinite retries
                setStatsLoaded(true);
            }
        };
        
        if (user?._id && !statsLoaded) {
            loadStats();
        }
    }, [user?._id, statsLoaded]);

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
            const response = await fetch(`${API_URL}/users/${user._id}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ הפרופיל עודכן בהצלחה!');
                setIsEditing(false);
                await loadUserFromToken();
            } else {
                alert('❌ שגיאה בעדכון הפרופיל: ' + (data.error || 'אנא נסה שוב'));
            }
        } catch (error) {
            console.error('Error updating profile:', error);
            alert('❌ שגיאת שרת. אנא נסה שוב מאוחר יותר.');
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
                            <div className="company-profile-stat-value" style={{opacity: statsLoaded ? 1 : 0.5}}>
                                {stats.approvedAds}
                            </div>
                            <div className="company-profile-stat-label">מודעות מאושרות</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">⏳</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value" style={{opacity: statsLoaded ? 1 : 0.5}}>
                                {stats.pendingAds}
                            </div>
                            <div className="company-profile-stat-label">ממתינות לאישור</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">🚀</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value" style={{opacity: statsLoaded ? 1 : 0.5}}>
                                {stats.activeCampaigns}
                            </div>
                            <div className="company-profile-stat-label">קמפיינים פעילים</div>
                        </div>
                    </div>
                    <div className="company-profile-stat-card">
                        <div className="company-profile-stat-icon">👥</div>
                        <div className="company-profile-stat-content">
                            <div className="company-profile-stat-value" style={{opacity: statsLoaded ? 1 : 0.5}}>
                                {stats.activeAgents}
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
            </div>
        </div>
    );
};

export default CompanyProfile;