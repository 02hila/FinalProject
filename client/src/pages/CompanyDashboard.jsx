import React, { useState, useEffect, useMemo } from 'react';
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
    
    // State
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });
    const [pendingAds, setPendingAds] = useState([]);
    const [allAgents, setAllAgents] = useState([]);
    const [filteredAgents, setFilteredAgents] = useState([]);
    const [agentFilters, setAgentFilters] = useState({ rating: '', specialty: '', search: '' });
    const [campaignForm, setCampaignForm] = useState({ 
        name: '', desc: '', target: '', budget: '', websiteUrl: '' 
    });
    const [selectedAgents, setSelectedAgents] = useState([]);
    const [history, setHistory] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [modal, setModal] = useState({ type: null, adId: null });
    const [rating, setRating] = useState(0);
    const [approveComment, setApproveComment] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDetails, setRejectDetails] = useState('');
    const [allowRevision, setAllowRevision] = useState(false);

    // Redirect
    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        } else if (!loading && user && user.userType !== 'company') {
            navigate('/dashboard');
        }
    }, [loading, user, navigate]);

    // ✅ CRITICAL FIX: Simple dependency on user._id ONLY
    useEffect(() => {
        // Skip if no user ID
        if (!user?._id) {
            console.log('⏸️ No user ID yet');
            return;
        }

        console.log('🚀 USER READY! Loading data for:', user._id);

        const loadData = async () => {
            try {
                // Pending ads
                console.log('📞 Calling getPendingAds...');
                const pendingData = await getPendingAds(user._id);
                console.log('📦 getPendingAds response:', pendingData);
                if (pendingData?.success) {
                    setPendingAds(pendingData.ads || []);
                    setStats(prev => ({ ...prev, pendingAds: pendingData.ads?.length || 0 }));
                }

                // Agents
                console.log('📞 Calling getAgents...');
                const agentsData = await getAgents();
                console.log('📦 getAgents response:', agentsData);
                if (agentsData?.success) {
                    setAllAgents(agentsData.agents || []);
                    setFilteredAgents(agentsData.agents || []);
                }

                // History
                console.log('📞 Calling getHistory...');
                const historyData = await getHistory(user._id);
                console.log('📦 getHistory response:', historyData);
                if (historyData?.success) {
                    setHistory(historyData.ads || []);
                }

                // Proposals
                console.log('📞 Calling getPriceProposals...');
                const proposalsData = await getPriceProposals(user._id);
                console.log('📦 getPriceProposals response:', proposalsData);
                if (proposalsData?.success) {
                    const pending = proposalsData.proposals?.filter(p => p.status === 'pending') || [];
                    setProposals(pending);
                    setStats(prev => ({ ...prev, proposalsCount: pending.length }));
                }

                console.log('🎉 ALL DATA LOADED!');
            } catch (error) {
                console.error('❌ Error loading data:', error);
            }
        };

        loadData();
    }, [user?._id]); // ✅ ONLY depends on user._id - will run when it changes from undefined to a value

    // Filter agents
    useEffect(() => {
        let agents = allAgents;
        if (agentFilters.rating) {
            agents = agents.filter(a => (a.stats?.averageRating || 0) >= parseInt(agentFilters.rating));
        }
        if (agentFilters.specialty) {
            agents = agents.filter(a => a.specialty === agentFilters.specialty);
        }
        if (agentFilters.search) {
            const search = agentFilters.search.toLowerCase();
            agents = agents.filter(a =>
                a.fullName.toLowerCase().includes(search) ||
                a.email.toLowerCase().includes(search)
            );
        }
        setFilteredAgents(agents);
    }, [agentFilters, allAgents]);

    // Stats
    const dashboardStats = useMemo(() => {
        const approved = history.filter(ad => ad.status === 'approved').length;
        const pending = history.filter(ad => ad.status === 'pending').length;
        const rejected = history.filter(ad => ad.status === 'rejected').length;
        return { approved, pending, rejected, total: history.length };
    }, [history]);

    // Handlers
    const handleTabClick = (tab) => setActiveTab(tab);
    const handleAgentFilterChange = (e) => setAgentFilters(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const handleCampaignFormChange = (e) => setCampaignForm(prev => ({ ...prev, [e.target.name]: e.target.value }));
    const toggleAgentSelection = (agentId) => setSelectedAgents(prev =>
        prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
    );

    const handleCreateCampaign = async () => {
        if (!campaignForm.name || !campaignForm.desc || !campaignForm.target || !campaignForm.budget) {
            return alert('אנא מלא את כל השדות');
        }
        if (selectedAgents.length === 0) {
            return alert('אנא בחר לפחות סוכן אחד');
        }
        try {
            const data = await apiCreateCampaign({
                title: campaignForm.name,
                description: campaignForm.desc,
                targetAudience: campaignForm.target,
                budget: campaignForm.budget,
                websiteUrl: campaignForm.websiteUrl,
                assignedAgents: selectedAgents,
                companyId: user._id
            });
            if (data.success) {
                alert('🎉 הקמפיין נוצר בהצלחה!');
                setCampaignForm({ name: '', desc: '', target: '', budget: '', websiteUrl: '' });
                setSelectedAgents([]);
                setActiveTab('overview');
            }
        } catch (error) {
            alert('שגיאה ביצירת קמפיין');
        }
    };

    const handleApproveAd = async () => {
        if (rating === 0) return alert('אנא בחר דירוג');
        try {
            const data = await apiApproveAd(modal.adId, { rating, comment: approveComment, companyId: user._id });
            if (data.success) {
                setPendingAds(prev => prev.filter(ad => ad._id !== modal.adId));
                setStats(prev => ({ ...prev, pendingAds: prev.pendingAds - 1 }));
                setModal({ type: null, adId: null });
                setRating(0);
                setApproveComment('');
                alert('✅ הפרסומת אושרה!');
            }
        } catch (error) {
            alert('שגיאה');
        }
    };

    const handleRejectAd = async () => {
        if (!rejectReason || !rejectDetails) return alert('אנא מלא את כל השדות');
        try {
            const data = await apiRejectAd(modal.adId, { 
                rejectionReason: rejectReason, rejectionDetails: rejectDetails, allowRevision 
            });
            if (data.success) {
                setPendingAds(prev => prev.filter(ad => ad._id !== modal.adId));
                setStats(prev => ({ ...prev, pendingAds: prev.pendingAds - 1 }));
                setModal({ type: null, adId: null });
                setRejectReason('');
                setRejectDetails('');
                setAllowRevision(false);
                alert('❌ הפרסומת נדחתה');
            }
        } catch (error) {
            alert('שגיאה');
        }
    };

    const openModal = (type, adId) => {
        setModal({ type, adId });
        setRating(0);
    };

    // Loading
    if (loading) {
        return (
            <div style={{
                padding: '50px', textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                minHeight: '100vh', color: 'white', fontSize: '24px',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
            }}>
                <div>
                    <div style={{marginBottom: '20px'}}>⏳</div>
                    <div>טוען נתונים...</div>
                </div>
            </div>
        );
    }

    if (!user) {
        return (
            <div style={{
                padding: '50px', textAlign: 'center',
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                minHeight: '100vh', color: 'white', fontSize: '24px'
            }}>אין משתמש מחובר</div>
        );
    }

    console.log('✅ Rendering:', { 
        activeTab, 
        pendingAds: pendingAds.length, 
        agents: allAgents.length,
        history: history.length
    });

    return (
        <div className="company-dashboard-body">
            {modal.type === 'approve' && (
                <ApproveModal setModal={setModal} handleApproveAd={handleApproveAd} 
                    rating={rating} setRating={setRating} 
                    approveComment={approveComment} setApproveComment={setApproveComment} />
            )}
            {modal.type === 'reject' && (
                <RejectModal setModal={setModal} handleRejectAd={handleRejectAd} 
                    rejectReason={rejectReason} setRejectReason={setRejectReason} 
                    rejectDetails={rejectDetails} setRejectDetails={setRejectDetails} 
                    allowRevision={allowRevision} setAllowRevision={setAllowRevision} />
            )}

            <SharedHeader userType="company" userName={user?.companyName || user?.fullName || 'חברה'} onLogout={handleLogout} />

            <div className="company-dashboard-container">
                <div className="company-dashboard-welcome-card">
                    <h1>שלום, {user?.companyName || 'חברה'}! 👋</h1>
                    <p>ברוך הבא לדשבורד ניהול הקמפיינים והמודעות שלך</p>
                </div>

                <div className="company-dashboard-tabs">
                    <button className={`company-dashboard-tab-btn ${activeTab === 'overview' ? 'active' : ''}`} onClick={() => handleTabClick('overview')}>
                        <span>📊</span><span>סקירה כללית</span>
                    </button>
                    <button className={`company-dashboard-tab-btn ${activeTab === 'pending' ? 'active' : ''}`} onClick={() => handleTabClick('pending')}>
                        <span>⏰</span><span>ממתין לאישור</span>
                        {pendingAds.length > 0 && <span className="company-dashboard-badge">{pendingAds.length}</span>}
                    </button>
                    <button className={`company-dashboard-tab-btn ${activeTab === 'agents' ? 'active' : ''}`} onClick={() => handleTabClick('agents')}>
                        <span>👥</span><span>סוכנים</span>
                        {allAgents.length > 0 && <span className="company-dashboard-badge" style={{background: '#3498db'}}>{allAgents.length}</span>}
                    </button>
                    <button className={`company-dashboard-tab-btn ${activeTab === 'history' ? 'active' : ''}`} onClick={() => handleTabClick('history')}>
                        <span>📜</span><span>היסטוריה</span>
                        {history.length > 0 && <span className="company-dashboard-badge" style={{background: '#95a5a6'}}>{history.length}</span>}
                    </button>
                </div>
                
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

                {activeTab === 'pending' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">⏰ פרסומות ממתינות ({pendingAds.length})</h2>
                        {pendingAds.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">✅</div>
                                <p>אין פרסומות ממתינות</p>
                            </div>
                        ) : (
                            pendingAds.map(ad => (
                                <div key={ad._id} className="company-dashboard-ad-card">
                                    <div className="company-dashboard-ad-header">
                                        <div>
                                            <h3>{ad.title || 'מודעה'}</h3>
                                            <p><strong>סוכן:</strong> {ad.agentId?.fullName || 'לא ידוע'}</p>
                                            <p><strong>תאריך:</strong> {new Date(ad.createdAt).toLocaleDateString('he-IL')}</p>
                                        </div>
                                        <span style={{padding: '8px 16px', background: '#fff3cd', color: '#856404', borderRadius: '20px'}}>⏳ ממתין</span>
                                    </div>
                                    <div style={{background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '15px 0'}}>
                                        <strong>טקסט:</strong><p>{ad.text || 'אין טקסט'}</p>
                                    </div>
                                    {ad.imageData && <img src={ad.imageData} alt="Ad" style={{maxWidth: '100%', borderRadius: '8px'}} />}
                                    <div className="company-dashboard-ad-actions">
                                        <button onClick={() => openModal('approve', ad._id)} className="company-dashboard-btn company-dashboard-btn-approve">✅ אשר</button>
                                        <button onClick={() => openModal('reject', ad._id)} className="company-dashboard-btn company-dashboard-btn-reject">❌ דחה</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                {activeTab === 'agents' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">👥 סוכנים ({filteredAgents.length})</h2>
                        {filteredAgents.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">😢</div>
                                <p>אין סוכנים</p>
                            </div>
                        ) : (
                            <ul>
                                {filteredAgents.map(agent => (
                                    <li key={agent._id}>{agent.fullName} - {agent.email}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="company-dashboard-tab-content">
                        <h2 className="company-dashboard-section-title">📜 היסטוריה ({history.length})</h2>
                        {history.length === 0 ? (
                            <div className="company-dashboard-empty-state">
                                <div className="company-dashboard-empty-state-icon">📝</div>
                                <p>אין היסטוריה</p>
                            </div>
                        ) : (
                            <ul>
                                {history.map(ad => (
                                    <li key={ad._id}>{ad.title || 'מודעה'} - {ad.status}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
};

const ApproveModal = ({ setModal, handleApproveAd, rating, setRating, approveComment, setApproveComment }) => (
    <div className="company-dashboard-modal">
        <div className="company-dashboard-modal-content">
            <h3>✅ אשר פרסומת</h3>
            <div className="company-dashboard-form-group">
                <label>דירוג</label>
                <div className="company-dashboard-rating-stars">
                    {[1,2,3,4,5].map(s => <span key={s} onClick={() => setRating(s)} className={`company-dashboard-star ${rating >= s ? 'active' : ''}`}>★</span>)}
                </div>
            </div>
            <div className="company-dashboard-form-group">
                <label>תגובה</label>
                <textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} rows="3" className="company-dashboard-form-input" />
            </div>
            <div className="company-dashboard-modal-actions">
                <button onClick={() => setModal({type: null, adId: null})} className="company-dashboard-btn company-dashboard-btn-cancel">ביטול</button>
                <button onClick={handleApproveAd} className="company-dashboard-btn company-dashboard-btn-submit">אשר</button>
            </div>
        </div>
    </div>
);

const RejectModal = ({ setModal, handleRejectAd, rejectReason, setRejectReason, rejectDetails, setRejectDetails, allowRevision, setAllowRevision }) => (
    <div className="company-dashboard-modal">
        <div className="company-dashboard-modal-content">
            <h3>❌ דחה פרסומת</h3>
            <div className="company-dashboard-form-group">
                <label>סיבה</label>
                <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="company-dashboard-form-input">
                    <option value="">בחר...</option>
                    <option value="not_relevant">לא רלוונטי</option>
                    <option value="poor_quality">איכות נמוכה</option>
                    <option value="other">אחר</option>
                </select>
            </div>
            <div className="company-dashboard-form-group">
                <label>הסבר</label>
                <textarea value={rejectDetails} onChange={(e) => setRejectDetails(e.target.value)} rows="4" className="company-dashboard-form-input" />
            </div>
            <div className="company-dashboard-form-group">
                <label className="company-dashboard-checkbox-label">
                    <input type="checkbox" checked={allowRevision} onChange={(e) => setAllowRevision(e.target.checked)} />
                    <span>אפשר תיקון</span>
                </label>
            </div>
            <div className="company-dashboard-modal-actions">
                <button onClick={() => setModal({type: null, adId: null})} className="company-dashboard-btn company-dashboard-btn-cancel">ביטול</button>
                <button onClick={handleRejectAd} className="company-dashboard-btn company-dashboard-btn-reject">דחה</button>
            </div>
        </div>
    </div>
);

export default CompanyDashboard;