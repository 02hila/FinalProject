import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

const RATING_THRESHOLDS = {
  EXCELLENT: 4.5,
  GOOD: 3.5,
};

const RATING_COLORS = {
  EXCELLENT: 'linear-gradient(135deg, #ffd700 0%, #ffed4e 100%)',
  GOOD: 'linear-gradient(135deg, #95d5b2 0%, #74c69d 100%)',
  FAIR: 'linear-gradient(135deg, #ffb4a2 0%, #ff9999 100%)',
};

const AgentDashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();
    
    const [showDropdown, setShowDropdown] = useState(false);
    const statsRef = useRef(null);
    const dropdownRef = useRef(null);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        } else if (!loading && user && user.userType !== 'agent') {
            navigate('/dashboard');
        }
    }, [loading, user, navigate]);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const ratingBadgeStyle = useMemo(() => {
        const average = user?.stats?.averageRating || 0;
        if (average >= RATING_THRESHOLDS.EXCELLENT) {
            return { background: RATING_COLORS.EXCELLENT };
        } else if (average >= RATING_THRESHOLDS.GOOD) {
            return { background: RATING_COLORS.GOOD };
        } else if (average > 0) {
            return { background: RATING_COLORS.FAIR };
        }
        return {};
    }, [user?.stats?.averageRating]);

    const showMyStats = () => {
        statsRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('userId');
        localStorage.removeItem('userType');
        navigate('/login');
    };

    if (loading || !user) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p>טוען נתונים...</p>
            </div>
        );
    }

    const stats = user.stats || {
        approvedAds: 0,
        pendingAds: 0,
        rejectedAds: 0,
        totalAds: 0,
        averageRating: 0,
        totalRatings: 0
    };

    return (
        <div style={styles.body}>
            <header style={styles.header}>
                <div style={styles.headerContainer}>
                    <div style={styles.headerLeft}>
                        <h1 style={styles.logo}>⚡ Ads Maker</h1>
                        <div style={styles.userInfo}>
                            <span style={styles.userName}>{user?.fullName || 'סוכן'}</span>
                            <span style={styles.userType}>סוכן מפרסם</span>
                        </div>
                    </div>

                    <nav style={styles.nav}>
                        <Link to="/agent-dashboard" style={styles.navLink}>🏠 דשבורד</Link>
                        <Link to="/ad-generator" style={styles.navLink}>⚡ מחולל</Link>
                        <Link to="/my-ads" style={styles.navLink}>🖼️ מודעות</Link>
                        <Link to="/my-campaigns" style={styles.navLink}>📊 קמפיינים</Link>
                        <Link to="/agent-profile" style={styles.navLink}>👤 פרופיל</Link>
                        
                        {/* ✅ תפריט עוד */}
                        <div style={styles.dropdownContainer} ref={dropdownRef}>
                            <button 
                                onClick={() => setShowDropdown(!showDropdown)}
                                style={styles.moreBtn}
                            >
                                ⋮ עוד
                            </button>
                            
                            {showDropdown && (
                                <div style={styles.dropdown}>
                                    <Link 
                                        to="/privacy-policy" 
                                        style={styles.dropdownItem}
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        🔒 מדיניות פרטיות
                                    </Link>
                                    <Link 
                                        to="/terms-of-service" 
                                        style={styles.dropdownItem}
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        📜 תנאי שימוש
                                    </Link>
                                    <Link 
                                        to="/landing" 
                                        style={styles.dropdownItem}
                                        onClick={() => setShowDropdown(false)}
                                    >
                                        🏠 דף נחיתה
                                    </Link>
                                </div>
                            )}
                        </div>
                    </nav>

                    <div style={styles.headerRight}>
                        <div style={styles.headerStats}>
                            <div style={styles.statBadge}>
                                <span style={styles.statLabel}>מודעות</span>
                                <span style={styles.statNumber}>{stats.totalAds || 0}</span>
                            </div>
                            <div style={styles.statBadge}>
                                <span style={styles.statLabel}>דירוג</span>
                                <span style={styles.statNumber}>
                                    ⭐ {stats.averageRating > 0 ? stats.averageRating.toFixed(1) : '0'}
                                </span>
                            </div>
                        </div>
                        <button onClick={handleLogout} style={styles.logoutBtn}>
                            יציאה
                        </button>
                    </div>
                </div>
            </header>

            <div style={styles.container}>
                <div style={styles.welcomeCard}>
                    <h1 style={styles.welcomeTitle}>
                        שלום, {user?.fullName || 'משתמש'}! 👋
                    </h1>
                    <p style={styles.welcomeSubtitle}>ברוך הבא לדשבורד הניהול שלך</p>
                    <div style={{ ...styles.ratingBadge, ...ratingBadgeStyle }}>
                        <span>⭐</span>
                        <span>
                            {stats.averageRating > 0 
                                ? stats.averageRating.toFixed(1) 
                                : 'חדש'}
                        </span>
                        <span>({stats.totalRatings || 0} דירוגים)</span>
                    </div>
                </div>

                <div style={styles.statsGrid} ref={statsRef}>
                    <div style={{...styles.statCard, ...styles.statCardApproved}}>
                        <div style={styles.statIcon}>✅</div>
                        <div style={styles.statValue}>{stats.approvedAds || 0}</div>
                        <div style={styles.statLabel}>פניות מאושרות</div>
                    </div>
                    <div style={{...styles.statCard, ...styles.statCardPending}}>
                        <div style={styles.statIcon}>⏳</div>
                        <div style={styles.statValue}>{stats.pendingAds || 0}</div>
                        <div style={styles.statLabel}>ממתינות לאישור</div>
                    </div>
                    <div style={{...styles.statCard, ...styles.statCardRejected}}>
                        <div style={styles.statIcon}>❌</div>
                        <div style={styles.statValue}>{stats.rejectedAds || 0}</div>
                        <div style={styles.statLabel}>נדחו</div>
                    </div>
                    <div style={styles.statCard}>
                        <div style={styles.statIcon}>💰</div>
                        <div style={styles.statValue}>{stats.totalAds || 0}</div>
                        <div style={styles.statLabel}>סה"כ מודעות</div>
                    </div>
                </div>

                <div style={styles.quickActions}>
                    <h2 style={styles.quickActionsTitle}>פעולות מהירות</h2>
                    <div style={styles.actionsGrid}>
                        <Link to="/ad-generator" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>⚡</span>
                            <span style={styles.actionText}>מחולל מודעות</span>
                        </Link>
                        <Link to="/my-ads" style={{ ...styles.actionBtn, ...styles.actionBtnMyAds }}>
                            <span style={styles.actionIcon}>🖼️</span>
                            <span style={styles.actionText}>המודעות שלי</span>
                        </Link>
                        <Link to="/my-campaigns" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>📊</span>
                            <span style={styles.actionText}>הקמפיינים שלי</span>
                        </Link>
                        <button onClick={showMyStats} style={styles.actionBtn}>
                            <span style={styles.actionIcon}>📈</span>
                            <span style={styles.actionText}>הסטטיסטיקות שלי</span>
                        </button>
                        <Link to="/agent-profile" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>👤</span>
                            <span style={styles.actionText}>הפרופיל שלי</span>
                        </Link>
                    </div>
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            `}</style>
        </div>
    );
};

const styles = {
    body: {
        fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
        background: '#f5f7fa',
        direction: 'rtl',
        minHeight: '100vh',
    },
    header: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        position: 'sticky',
        top: 0,
        zIndex: 1000,
        padding: '15px 0',
    },
    headerContainer: {
        maxWidth: '1400px',
        margin: '0 auto',
        padding: '0 20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '20px',
        flexWrap: 'wrap',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
    },
    logo: {
        color: 'white',
        margin: 0,
        fontSize: '24px',
        fontWeight: 'bold',
    },
    userInfo: {
        display: 'flex',
        flexDirection: 'column',
        gap: '2px',
    },
    userName: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px',
    },
    userType: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: '12px',
    },
    nav: {
        display: 'flex',
        gap: '10px',
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    navLink: {
        color: 'white',
        textDecoration: 'none',
        padding: '8px 12px',
        borderRadius: '8px',
        transition: 'all 0.3s',
        fontSize: '14px',
        fontWeight: '500',
        background: 'rgba(255,255,255,0.1)',
    },
    dropdownContainer: {
        position: 'relative',
    },
    moreBtn: {
        color: 'white',
        background: 'rgba(255,255,255,0.1)',
        border: 'none',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '18px',
        fontWeight: 'bold',
        transition: 'all 0.3s',
    },
    dropdown: {
        position: 'absolute',
        top: '50px',
        left: '0',
        background: 'white',
        borderRadius: '8px',
        boxShadow: '0 8px 25px rgba(0,0,0,0.3)',
        minWidth: '220px',
        zIndex: 9999,
        overflow: 'hidden',
    },
    dropdownItem: {
        display: 'block',
        padding: '14px 20px',
        color: '#333',
        textDecoration: 'none',
        fontSize: '14px',
        transition: 'all 0.2s',
        borderBottom: '1px solid #f0f0f0',
        background: 'white',
    },
    headerRight: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
    },
    headerStats: {
        display: 'flex',
        gap: '10px',
    },
    statBadge: {
        background: 'rgba(255,255,255,0.2)',
        padding: '8px 15px',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '2px',
    },
    statLabel: {
        color: 'rgba(255,255,255,0.8)',
        fontSize: '11px',
    },
    statNumber: {
        color: 'white',
        fontWeight: 'bold',
        fontSize: '16px',
    },
    logoutBtn: {
        background: 'white',
        color: '#667eea',
        border: 'none',
        padding: '10px 20px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontWeight: 'bold',
        fontSize: '14px',
        transition: 'all 0.3s',
        boxShadow: '0 2px 5px rgba(0,0,0,0.1)',
    },
    loadingContainer: {
        height: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '20px',
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
    },
    container: {
        maxWidth: '1400px',
        margin: '30px auto',
        padding: '0 20px',
    },
    welcomeCard: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '20px',
        padding: '40px',
        color: 'white',
        boxShadow: '0 10px 30px rgba(102, 126, 234, 0.3)',
        marginBottom: '30px',
    },
    welcomeTitle: {
        margin: '0 0 10px 0',
        fontSize: '32px',
    },
    welcomeSubtitle: {
        margin: '0',
        opacity: '0.9',
        fontSize: '18px',
    },
    ratingBadge: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '5px',
        color: '#333',
        padding: '8px 20px',
        borderRadius: '25px',
        fontWeight: 'bold',
        marginTop: '10px',
    },
    statsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
        gap: '20px',
        marginBottom: '30px',
    },
    statCard: {
        background: 'white',
        borderRadius: '15px',
        padding: '30px',
        textAlign: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
        transition: 'transform 0.3s, box-shadow 0.3s',
        cursor: 'pointer',
    },
    statCardApproved: {
        borderTop: '4px solid #27ae60',
    },
    statCardPending: {
        borderTop: '4px solid #f39c12',
    },
    statCardRejected: {
        borderTop: '4px solid #e74c3c',
    },
    statIcon: {
        fontSize: '36px',
        marginBottom: '10px',
    },
    statValue: {
        fontSize: '32px',
        fontWeight: 'bold',
        color: '#667eea',
        marginBottom: '5px',
    },
    statLabel: {
        color: '#666',
        fontSize: '14px',
    },
    quickActions: {
        background: 'white',
        borderRadius: '15px',
        padding: '30px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.08)',
    },
    quickActionsTitle: {
        marginTop: '0',
        marginBottom: '20px',
        color: '#333',
    },
    actionsGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
    },
    actionBtn: {
        display: 'flex',
        alignItems: 'center',
        gap: '15px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        textDecoration: 'none',
        borderRadius: '12px',
        transition: 'all 0.3s',
        boxShadow: '0 3px 10px rgba(102, 126, 234, 0.3)',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
    },
    actionBtnMyAds: {
        background: 'linear-gradient(135deg, #27ae60 0%, #2ecc71 100%)',
        boxShadow: '0 3px 10px rgba(39, 174, 96, 0.3)',
    },
    actionIcon: {
        fontSize: '28px',
    },
    actionText: {
        fontWeight: 'bold',
    },
};

export default AgentDashboard;