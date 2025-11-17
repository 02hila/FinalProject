import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader'; // ✅ נוסף!
import './AgentDashboard.css';

// ✅ Constants instead of magic numbers
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
    
    const [isReady, setIsReady] = useState(false);
    const statsRef = useRef(null);

    useEffect(() => {
        if (user) {
            const timer = setTimeout(() => setIsReady(true), 100);
            return () => clearTimeout(timer);
        }
    }, [user]);

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        } else if (!loading && user && user.userType !== 'agent') {
            navigate('/dashboard');
        }
    }, [loading, user, navigate]);

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
            {/* ✅ SharedHeader החדש במקום הNavbar הישן! */}
            <SharedHeader 
                userType="agent"
                userName={user?.fullName || 'סוכן'}
                onLogout={handleLogout}
            />

            {/* Container */}
            <div style={styles.container}>
                {/* Welcome Card */}
                <div className="welcome-card">
                    <h1>
                        שלום, {user?.fullName || 'משתמש'}! 👋
                    </h1>
                    <p>ברוך הבא לדשבורד הניהול שלך</p>
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

                {/* Stats Grid */}
                <div className="stats-grid" ref={statsRef}>
                    <div className="stat-card approved">
                        <div style={styles.statIcon}>✅</div>
                        <div className="stat-value" style={styles.statValue}>
                            {stats.approvedAds || 0}
                        </div>
                        <div style={styles.statLabel}>פניות מאושרות</div>
                    </div>

                    <div className="stat-card pending">
                        <div style={styles.statIcon}>⏳</div>
                        <div className="stat-value" style={styles.statValue}>
                            {stats.pendingAds || 0}
                        </div>
                        <div style={styles.statLabel}>ממתינות לאישור</div>
                    </div>

                    <div className="stat-card rejected">
                        <div style={styles.statIcon}>❌</div>
                        <div className="stat-value" style={styles.statValue}>
                            {stats.rejectedAds || 0}
                        </div>
                        <div style={styles.statLabel}>נדחו</div>
                    </div>

                    <div className="stat-card">
                        <div style={styles.statIcon}>💰</div>
                        <div className="stat-value" style={styles.statValue}>
                            {stats.totalAds || 0}
                        </div>
                        <div style={styles.statLabel}>סה"כ מודעות</div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className="quick-actions">
                    <h2>פעולות מהירות</h2>
                    <div style={styles.actionsGrid}>
                        <Link to="/ad-generator" className="action-btn" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>⚡</span>
                            <span style={styles.actionText}>מחולל מודעות</span>
                        </Link>

                        <Link to="/my-ads" className="action-btn" style={{ ...styles.actionBtn, ...styles.actionBtnMyAds }}>
                            <span style={styles.actionIcon}>🖼️</span>
                            <span style={styles.actionText}>המודעות שלי</span>
                        </Link>

                        <Link to="/my-campaigns" className="action-btn" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>📊</span>
                            <span style={styles.actionText}>הקמפיינים שלי</span>
                        </Link>

                        <button 
                            onClick={showMyStats}
                            className="action-btn"
                            style={styles.actionBtn}
                        >
                            <span style={styles.actionIcon}>📈</span>
                            <span style={styles.actionText}>הסטטיסטיקות שלי</span>
                        </button>

                        <Link to="/agent-profile" className="action-btn" style={styles.actionBtn}>
                            <span style={styles.actionIcon}>👤</span>
                            <span style={styles.actionText}>הפרופיל שלי</span>
                        </Link>
                    </div>
                </div>
            </div>
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