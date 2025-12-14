// CompanyDashboard.jsx – FIXED VERSION
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader';
import './CompanyDashboard.css';
import {
    getPendingAds,
    getAgents,
    getHistory,
    getPriceProposals,
    createCampaign as apiCreateCampaign,
    approveAd as apiApproveAd,
    rejectAd as apiRejectAd,
    approveProposal,
    rejectProposal
} from '../services/companyService';

const CompanyDashboard = () => {
    const { user, loading, handleLogout } = useAuth();
    const navigate = useNavigate();
    
    // ✅ State definitions
    const [activeTab, setActiveTab] = useState('overview');
    const [agents, setAgents] = useState([]);
    const [pendingAds, setPendingAds] = useState([]);
    const [history, setHistory] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });
    const [dataLoading, setDataLoading] = useState(true);
    const [error, setError] = useState(null);

    // ✅ Redirect logic - MUST BE FIRST
    useEffect(() => {
        if (!loading && !user) {
            console.log('❌ No user - redirecting to login');
            navigate('/login');
        } else if (!loading && user && user.userType !== 'company') {
            console.log('❌ Wrong user type - redirecting to dashboard');
            navigate('/dashboard');
        }
    }, [loading, user, navigate]);

    // ✅ Fetch all data using the CORRECT API functions
    useEffect(() => {
        if (!user?._id || loading) return;

        const fetchData = async () => {
            try {
                setDataLoading(true);
                setError(null);

                console.log('🔵 Fetching data for company:', user._id);

                // Fetch all data in parallel
                const [agentsData, pendingData, historyData, proposalsData] = await Promise.all([
                    getAgents(),
                    getPendingAds(user._id),
                    getHistory(user._id),
                    getPriceProposals(user._id)
                ]);

                // Update agents
                if (agentsData.success) {
                    setAgents(agentsData.agents || []);
                    console.log('✅ Loaded', agentsData.agents?.length, 'agents');
                }

                // Update pending ads
                if (pendingData.success) {
                    setPendingAds(pendingData.ads || []);
                    setStats(prev => ({ ...prev, pendingAds: pendingData.ads?.length || 0 }));
                    console.log('✅ Loaded', pendingData.ads?.length, 'pending ads');
                }

                // Update history
                if (historyData.success) {
                    setHistory(historyData.ads || []);
                    console.log('✅ Loaded', historyData.ads?.length, 'history items');
                }

                // Update proposals
                if (proposalsData.success) {
                    const pending = proposalsData.proposals?.filter(p => p.status === 'pending') || [];
                    setProposals(pending);
                    setStats(prev => ({ ...prev, proposalsCount: pending.length }));
                    console.log('✅ Loaded', pending.length, 'proposals');
                }

            } catch (err) {
                console.error('❌ Error fetching dashboard data:', err);
                setError('שגיאה בטעינת נתוני הדשבורד');
            } finally {
                setDataLoading(false);
            }
        };

        fetchData();
    }, [user?._id, loading]);

    // ✅ Loading state
    if (loading || dataLoading) {
        return (
            <div style={{
                padding: '50px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                minHeight: '100vh',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div>
                    <div style={{marginBottom: '20px'}}>⏳</div>
                    <div>טוען נתונים...</div>
                </div>
            </div>
        );
    }

    // ✅ No user state
    if (!user) {
        return (
            <div style={{
                padding: '50px',
                textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                minHeight: '100vh',
                color: 'white',
                fontSize: '24px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                <div>
                    <div style={{marginBottom: '20px'}}>❌</div>
                    <div>אין משתמש מחובר</div>
                </div>
            </div>
        );
    }

    // ✅ Error state
    if (error) {
        return (
            <div className="company-dashboard-body">
                <SharedHeader 
                    userType="company"
                    userName={user?.companyName || user?.fullName || 'חברה'}
                    onLogout={handleLogout}
                />
                <div style={{ padding: '2rem', textAlign: 'center' }}>
                    <h2 style={{ color: '#e74c3c' }}>❌ {error}</h2>
                    <button 
                        onClick={() => window.location.reload()} 
                        style={{
                            padding: '10px 20px',
                            background: '#667eea',
                            color: 'white',
                            border: 'none',
                            borderRadius: '8px',
                            cursor: 'pointer',
                            marginTop: '20px'
                        }}
                    >
                        נסה שוב
                    </button>
                </div>
            </div>
        );
    }

    // ✅ Calculate dashboard stats
    const dashboardStats = {
        approved: history.filter(ad => ad.status === 'approved').length,
        pending: history.filter(ad => ad.status === 'pending').length,
        rejected: history.filter(ad => ad.status === 'rejected').length,
        total: history.length
    };

    return (
        <div className="company-dashboard-body">
            <SharedHeader 
                userType="company"
                userName={user?.companyName || user?.fullName || 'חברה'}
                onLogout={handleLogout}
            />

            <div className="company-dashboard-container">
                <div className="company-dashboard-welcome-card">
                    <h1>שלום, {user?.companyName || 'חברה'}! 👋</h1>
                    <p>ברוך הבא לדשבורד ניהול הקמפיינים והמודעות שלך</p>
                </div>

                <div className="company-dashboard-tabs">
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'overview' ? 'active' : ''}`}
                        onClick={() => setActiveTab('overview')}
                    >
                        <span>📊</span>
                        <span>סקירה כללית</span>
                    </button>
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                    >
                        <span>⏰</span>
                        <span>ממתין לאישור</span>
                        {stats.pendingAds > 0 && (
                            <span className="company-dashboard-badge">{stats.pendingAds}</span>
                        )}
                    </button>
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
                        onClick={() => setActiveTab('agents')}
                    >
                        <span>👥</span>
                        <span>סוכנים</span>
                        {agents.length > 0 && (
                            <span className="company-dashboard-badge" style={{background: '#3498db'}}>
                                {agents.length}
                            </span>
                        )}
                    </button>
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => setActiveTab('history')}
                    >
                        <span>📜</span>
                        <span>היסטוריה</span>
                        {history.length > 0 && (
                            <span className="company-dashboard-badge" style={{background: '#95a5a6'}}>
                                {history.length}
                            </span>
                        )}
                    </button>
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-stats-grid">
                            <div className="company-dashboard-stat-card approved">
                                <div className="company-dashboard-stat-icon">✅</div>
                                <div className="company-dashboard-stat-value">{dashboardStats.approved}</div>
                                <div className="company-dashboard-stat-label">מודעות שאושרו</div>
                            </div>
                            <div className="company-dashboard-stat-card pending">
                                <div className="company-dashboard-stat-icon">⏳</div>
                                <div className="company-dashboard-stat-value">{dashboardStats.pending}</div>
                                <div className="company-dashboard-stat-label">מודעות ממתינות</div>
                            </div>
                            <div className="company-dashboard-stat-card rejected">
                                <div className="company-dashboard-stat-icon">❌</div>
                                <div className="company-dashboard-stat-value">{dashboardStats.rejected}</div>
                                <div className="company-dashboard-stat-label">מודעות שנדחו</div>
                            </div>
                            <div className="company-dashboard-stat-card">
                                <div className="company-dashboard-stat-icon">📊</div>
                                <div className="company-dashboard-stat-value">{dashboardStats.total}</div>
                                <div className="company-dashboard-stat-label">סה"כ מודעות</div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pending Ads Tab */}
                {activeTab === 'pending' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">
                            ⏰ פרסומות ממתינות לאישור ({pendingAds.length})
                        </h2>
                        {pendingAds.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">✅</div>
                                <p>אין פרסומות ממתינות לאישור</p>
                            </div>
                        ) : (
                            <ul>
                                {pendingAds.map(ad => (
                                    <li key={ad._id} style={{ marginBottom: '10px' }}>
                                        <strong>{ad.title || 'מודעה'}</strong> - {ad.agentId?.fullName || 'סוכן'}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* Agents Tab */}
                {activeTab === 'agents' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">
                            👥 סוכנים ({agents.length})
                        </h2>
                        {agents.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">😢</div>
                                <p>אין סוכנים במערכת</p>
                            </div>
                        ) : (
                            <ul>
                                {agents.map(agent => (
                                    <li key={agent._id}>
                                        {agent.fullName} ({agent.email}) - 
                                        ⭐ {agent.stats?.averageRating?.toFixed(1) || 'N/A'}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {/* History Tab */}
                {activeTab === 'history' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">
                            📜 היסטוריה ({history.length})
                        </h2>
                        {history.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">📝</div>
                                <p>אין היסטוריה</p>
                            </div>
                        ) : (
                            <ul>
                                {history.map(ad => (
                                    <li key={ad._id}>
                                        {ad.title || 'מודעה'} - {ad.status}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

export default CompanyDashboard;