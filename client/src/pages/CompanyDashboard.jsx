import PaymentSection from '../components/PaymentSection';
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext'; // ✅ חובה!
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader';
import './CompanyDashboard.css';
import PaymentSection from '../components/PaymentSection';

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
    const [searchParams] = useSearchParams(); // ✅ קריאת query parameters מה-URL
    
    // State definitions
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });
    const [pendingAds, setPendingAds] = useState([]);
    const [loadingAds, setLoadingAds] = useState(false);
    const [allAgents, setAllAgents] = useState([]);
    const [filteredAgents, setFilteredAgents] = useState([]);
    const [agentFilters, setAgentFilters] = useState({ rating: '', specialty: '', search: '' });
    const [campaignForm, setCampaignForm] = useState({ name: '', desc: '', target: '', budget: '', websiteUrl: '' });
    const [selectedAgents, setSelectedAgents] = useState([]);
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const [proposals, setProposals] = useState([]);
    const [loadingProposals, setLoadingProposals] = useState(false);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [modal, setModal] = useState({ type: null, adId: null });
    const [rating, setRating] = useState(0);
    const [approveComment, setApproveComment] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDetails, setRejectDetails] = useState('');
    const [allowRevision, setAllowRevision] = useState(false);
    const [updateCounter, setUpdateCounter] = useState(0);
    const [highlightedPaymentId, setHighlightedPaymentId] = useState(null); // ✅ לסימון תשלום ספציפי
    
    // ✅ NEW: קריאת query parameters מה-URL ופתיחת לשונית מתאימה
    useEffect(() => {
        const tabParam = searchParams.get('tab');
        const paymentIdParam = searchParams.get('paymentId');
        
        if (tabParam) {
            console.log('📌 Opening tab from URL:', tabParam);
            setActiveTab(tabParam);
        }
        
        if (paymentIdParam) {
            console.log('💰 Payment ID from URL:', paymentIdParam);
            setHighlightedPaymentId(paymentIdParam);
            // פתיחת לשונית תשלומים אם יש paymentId
            if (!tabParam) {
                setActiveTab('payments');
            }
        }
    }, [searchParams]);
    
    // ✅ FIX 1: Redirect logic with proper dependencies
    useEffect(() => {
        if (!loading) {
            if (!user) {
                console.log('❌ No user - redirecting to login');
                navigate('/login', { replace: true });
            } else if (user.userType !== 'company') {
                console.log('❌ Wrong user type - redirecting to dashboard');
                navigate('/dashboard', { replace: true });
            }
        }
    }, [loading, user, navigate]);
    
    // ✅ FIX 2: Fetch functions with useCallback
    const fetchPendingAds = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingAds(true);
        try {
            const data = await getPendingAds(userId);
            if (data.success) {
                setPendingAds(data.ads || []);
                // ✅ Use total from server response (not just the returned ads count)
                const totalCount = data.total !== undefined ? data.total : (data.ads?.length || 0);
                setStats(prev => ({ ...prev, pendingAds: totalCount }));
            }
        } catch (error) {
            console.error("Error fetching pending ads:", error);
        } finally {
            setLoadingAds(false);
        }
    }, []);

    const fetchAgents = useCallback(async () => {
        try {
            const data = await getAgents();
            if (data.success) {
                setAllAgents(data.agents || []);
                setFilteredAgents(data.agents || []);
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
        }
    }, []);

    const fetchHistory = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingHistory(true);
        try {
            const data = await getHistory(userId);
            if (data.success) {
                setHistory(data.ads || []);
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    }, []);

    const fetchProposals = useCallback(async (userId) => {
        if (!userId) return;
        setLoadingProposals(true);
        try {
            const data = await getPriceProposals(userId);
            if (data.success) {
                const pending = data.proposals?.filter(p => p.status === 'pending') || [];
                setProposals(pending);
                setStats(prev => ({ ...prev, proposalsCount: pending.length }));
            }
        } catch (error) {
            console.error("Error fetching proposals:", error);
        } finally {
            setLoadingProposals(false);
        }
    }, []);

    // ✅ FIX 3: Data loading effect WITHOUT dependency loop
    useEffect(() => {
        if (user?._id && !dataLoaded) {
            Promise.all([
                fetchPendingAds(user._id),
                fetchAgents(),
                fetchHistory(user._id),
                fetchProposals(user._id)
            ]).finally(() => {
                setDataLoaded(true);
            });
        }
    }, [user?._id, fetchPendingAds, fetchAgents, fetchHistory, fetchProposals]); 

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        // ✅ נקה את ה-query params מה-URL כשמחליפים טאב
        if (searchParams.has('tab') || searchParams.has('paymentId')) {
            navigate('/company-dashboard', { replace: true });
        }
    };

    const handleAgentFilterChange = (e) => {
        const { name, value } = e.target;
        setAgentFilters(prev => ({ ...prev, [name]: value }));
    };

    useEffect(() => {
        let agents = allAgents;
        if (agentFilters.rating) {
            agents = agents.filter(a => (a.stats?.averageRating || 0) >= parseInt(agentFilters.rating));
        }
        if (agentFilters.specialty) {
            agents = agents.filter(a => a.specialty === agentFilters.specialty);
        }
        if (agentFilters.search) {
            agents = agents.filter(a =>
                a.fullName.toLowerCase().includes(agentFilters.search.toLowerCase()) ||
                a.email.toLowerCase().includes(agentFilters.search.toLowerCase())
            );
        }
        setFilteredAgents(agents);
    }, [agentFilters, allAgents]);

    const dashboardStats = useMemo(() => {
        const approved = history.filter(ad => ad.status === 'approved').length;
        const pending = history.filter(ad => ad.status === 'pending').length;
        const rejected = history.filter(ad => ad.status === 'rejected').length;
        return {
            approved,
            pending,
            rejected,
            total: history.length
        };
    }, [history]);

    const handleCampaignFormChange = (e) => {
        const { name, value } = e.target;
        setCampaignForm(prev => ({ ...prev, [name]: value }));
    };

    const toggleAgentSelection = (agentId) => {
        setSelectedAgents(prev =>
            prev.includes(agentId) ? prev.filter(id => id !== agentId) : [...prev, agentId]
        );
    };

    const handleCreateCampaign = async () => {
        if (!campaignForm.name || !campaignForm.desc || !campaignForm.target || !campaignForm.budget) {
            alert('אנא מלא את כל השדות');
            return;
        }
        if (selectedAgents.length === 0) {
            alert('אנא בחר לפחות סוכן אחד');
            return;
        }

        const campaignData = {
            title: campaignForm.name,
            description: campaignForm.desc,
            targetAudience: campaignForm.target,
            budget: campaignForm.budget,
            websiteUrl: campaignForm.websiteUrl,
            assignedAgents: selectedAgents,
            companyId: user._id
        };

        try {
            const data = await apiCreateCampaign(campaignData);
            if (data.success) {
                alert('🎉 הקמפיין נוצר בהצלחה!');
                setCampaignForm({ name: '', desc: '', target: '', budget: '', websiteUrl: '' });
                setSelectedAgents([]);
                setActiveTab('overview');
            } else {
                alert('שגיאה ביצירת קמפיין: ' + data.error);
            }
        } catch (error) {
            console.error('Error creating campaign:', error);
            alert('שגיאת שרת ביצירת קמפיין.');
        }
    };

    // ✅ FIXED: handleApproveAd with proper state updates
    const handleApproveAd = async () => {
        console.log('🔵 handleApproveAd started', { rating, modal });
        
        if (rating === 0) {
            alert('אנא בחר דירוג');
            return;
        }
        
        const adId = modal.adId;
        console.log('🔵 Saved adId:', adId);
        
        try {
            console.log('🔵 Calling approveAd API...');
            
            const data = await apiApproveAd(adId, { 
                rating, 
                comment: approveComment, 
                companyId: user._id 
            });
            
            console.log('🔵 API Response:', data);
            
            if (data.success) {
                console.log('✅ Ad approved successfully!');
                
                // ✅ IMMEDIATE: Update pending count right away!
                setPendingAds(prev => prev.filter(ad => ad._id !== adId));
                setStats(prev => ({ ...prev, pendingAds: prev.pendingAds - 1 }));
                setUpdateCounter(prev => prev + 1); // ✅ Force re-render
                
                // Close modal and clear form
                setModal({ type: null, adId: null });
                setRating(0);
                setApproveComment('');
                
                // Show success message
                alert('✅ הפרסומת אושרה בהצלחה! המודעה הועברה להיסטוריה.');
                
                console.log('✅ Local state updated!');
            } else {
                console.error('❌ API returned error:', data.error);
                alert('שגיאה באישור הפרסומת: ' + data.error);
                setModal({ type: null, adId: null });
            }
        } catch (error) {
            console.error('❌ Exception in handleApproveAd:', error);
            alert('❌ שגיאה באישור הפרסומת');
            setModal({ type: null, adId: null });
        }
    };

    // ✅ FIXED: handleRejectAd - מרענן את הרשימה אחרי יצירת פרסומת חלופית
    const handleRejectAd = async (overrideReason = null, overrideDetails = null, overrideAllowRevision = null) => {
        const finalReason = overrideReason !== null ? overrideReason : rejectReason;
        const finalDetails = overrideDetails !== null ? overrideDetails : rejectDetails;
        const finalAllowRevision = overrideAllowRevision !== null ? overrideAllowRevision : allowRevision;
        
        if (!finalReason || !finalDetails) {
            alert('אנא מלא את כל שדות החובה');
            return;
        }
        
        const adId = modal.adId;
        
        // Close modal immediately to show loading state
        setModal({ type: null, adId: null });
        
        try {
            const data = await apiRejectAd(adId, { 
                rejectionReason: finalReason,
                rejectionDetails: finalDetails, 
                allowRevision: finalAllowRevision 
            });
            
            if (data.success) {
                console.log('✅ Ad rejected and alternative created!');
                
                // Clear form
                setRejectReason('');
                setRejectDetails('');
                setAllowRevision(false);
                
                // Show success message
                alert('✅ הפרסומת נדחתה ופרסומת חלופית נוצרה! הרשימה תתעדכן.');
                
                // ✅ IMPORTANT: רענן את רשימת הפרסומות הממתינות
                await fetchPendingAds(user._id);
                
                console.log('✅ Pending ads list refreshed!');
            } else {
                alert('שגיאה בדחיית הפרסומת: ' + data.error);
            }
        } catch (error) {
            console.error('Error rejecting ad:', error);
            alert('❌ שגיאה בדחיית הפרסומת');
        }
    };

    const openModal = (type, adId) => {
        setModal({ type, adId });
        setRating(0);
    };

    const handleApproveProposal = async (proposalId) => {
        if (!window.confirm('האם אתה בטוח שברצונך לאשר את ההצעה? התקציב בקמפיין יתעדכן בהתאם.')) return;
        try {
            const data = await approveProposal(proposalId, { message: 'ההצעה אושרה על ידי החברה' });
            if (data.success) {
                alert('✅ ההצעה אושרה! התקציב בקמפיין עודכן.');
                // Refresh proposals
                await fetchProposals(user._id);
            } else {
                alert('❌ שגיאה: ' + (data.error || 'לא ניתן לאשר את ההצעה'));
            }
        } catch (error) {
            console.error('Error approving proposal:', error);
            alert('❌ שגיאה באישור ההצעה');
        }
    };

    const handleRejectProposal = async (proposalId) => {
        const reason = window.prompt('למה אתה דוחה את ההצעה? (אופציונלי)');
        try {
            const data = await rejectProposal(proposalId, { message: reason || 'ההצעה נדחתה על ידי החברה' });
            if (data.success) {
                alert('❌ ההצעה נדחתה. הסוכן יקבל הודעה.');
                // Refresh proposals
                await fetchProposals(user._id);
            } else {
                alert('❌ שגיאה: ' + (data.error || 'לא ניתן לדחות את ההצעה'));
            }
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            alert('❌ שגיאה בדחיית ההצעה');
        }
    };

    // ✅ Debug logs
    console.log('🔵 CompanyDashboard render - user:', user);
    console.log('🔵 CompanyDashboard render - loading:', loading);

    if (loading) {
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

    if (!user) {
        console.log('❌ No user in CompanyDashboard');
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
                    <div style={{marginTop: '20px', fontSize: '16px'}}>מעביר להתחברות...</div>
                </div>
            </div>
        );
    }

    console.log('✅ CompanyDashboard rendering with user:', user.fullName || user.companyName);

    return (
        <div className="company-dashboard-body">
            {modal.type === 'approve' && <ApproveModal setModal={setModal} handleApproveAd={handleApproveAd} rating={rating} setRating={setRating} approveComment={approveComment} setApproveComment={setApproveComment} />}
            {modal.type === 'reject' && <RejectModal setModal={setModal} handleRejectAd={handleRejectAd} rejectReason={rejectReason} setRejectReason={setRejectReason} rejectDetails={rejectDetails} setRejectDetails={setRejectDetails} allowRevision={allowRevision} setAllowRevision={setAllowRevision} />}

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
                        onClick={() => handleTabClick('overview')}
                    >
                        <span>📊</span>
                        <span>סקירה כללית</span>
                    </button>
                    <button 
                        className="company-dashboard-tab-btn"
                        onClick={() => navigate('/company-qr-analytics')}
                    >
                        <span>📊</span>
                        <span>סטטיסטיקות QR</span>
                    </button>
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => handleTabClick('pending')}
                    >
                        <span>⏰</span>
                        <span>ממתין לאישור</span>
                        {stats.pendingAds > 0 && (
                            <span className="company-dashboard-badge">
                                {stats.pendingAds}
                            </span>
                        )}
                    </button>
                    
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
                        onClick={() => handleTabClick('proposals')}
                    >
                        <span>💰</span>
                        <span>הצעות מחיר</span>
                        {stats.proposalsCount > 0 && (
                            <span className="company-dashboard-badge">{stats.proposalsCount}</span>
                        )}
                    </button>

                    {/* ✅ NEW: לשונית תשלומים */}
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
                        onClick={() => handleTabClick('payments')}
                    >
                        <span>💳</span>
                        <span>תשלומים</span>
                    </button>
                    
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'campaigns' ? 'active' : ''}`}
                        onClick={() => handleTabClick('campaigns')}
                    >
                        <span>🎯</span>
                        <span>ניהול קמפיינים</span>
                    </button>
                    
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'agents' ? 'active' : ''}`}
                        onClick={() => handleTabClick('agents')}
                    >
                        <span>👥</span>
                        <span>סוכנים זמינים</span>
                        {dataLoaded && allAgents.length > 0 && (
                            <span className="company-dashboard-badge" style={{background: '#3498db'}}>{allAgents.length}</span>
                        )}
                    </button>
                    
                    <button 
                        className="company-dashboard-tab-btn"
                        onClick={() => navigate('/company-profile')}
                    >
                        <span>👤</span>
                        <span>הפרופיל שלי</span>
                    </button>
                    
                    <button 
                        className={`company-dashboard-tab-btn ${activeTab === 'history' ? 'active' : ''}`}
                        onClick={() => handleTabClick('history')}
                    >
                        <span>📜</span>
                        <span>היסטוריה</span>
                        {dataLoaded && history.length > 0 && (
                            <span className="company-dashboard-badge" style={{background: '#95a5a6'}}>{history.length}</span>
                        )}
                    </button>
                </div>
                
                {activeTab === 'overview' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-stats-grid">
                            <div className="company-dashboard-stat-card approved">
                                <div className="company-dashboard-stat-icon">✅</div>
                                <div className="company-dashboard-stat-value">
                                    {dashboardStats.approved}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות שאושרו</div>
                            </div>
                            <div className="company-dashboard-stat-card pending">
                                <div className="company-dashboard-stat-icon">⏳</div>
                                <div className="company-dashboard-stat-value">
                                    {dashboardStats.pending}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות ממתינות</div>
                            </div>
                            <div className="company-dashboard-stat-card rejected">
                                <div className="company-dashboard-stat-icon">❌</div>
                                <div className="company-dashboard-stat-value">
                                    {dashboardStats.rejected}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות שנדחו</div>
                            </div>
                            <div className="company-dashboard-stat-card">
                                <div className="company-dashboard-stat-icon">📊</div>
                                <div className="company-dashboard-stat-value">
                                    {dashboardStats.total}
                                </div>
                                <div className="company-dashboard-stat-label">סה"כ מודעות</div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'pending' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-pending-ads-container">
                            <h2 className="company-dashboard-section-title">
                                <span>⏰</span>
                                פרסומות ממתינות לאישור ({stats.pendingAds > 0 ? stats.pendingAds : pendingAds.length})
                            </h2>
                            
                            {pendingAds.length === 0 ? (
                                <div className="company-dashboard-empty-state">
                                    <div className="company-dashboard-empty-state-icon">✅</div>
                                    <p>אין פרסומות ממתינות לאישור</p>
                                </div>
                            ) : (
                                pendingAds.map(ad => (
                                    <div key={ad._id} className="company-dashboard-ad-card">
                                        <div className="company-dashboard-ad-header">
                                            <div>
                                                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>{ad.title || 'מודעה חדשה'}</h3>
                                                <p style={{ color: '#7f8c8d', margin: 0 }}>
                                                    <strong>סוכן:</strong> {ad.agentId?.fullName || 'לא ידוע'}
                                                </p>
                                                <p style={{ color: '#7f8c8d', margin: '5px 0 0 0' }}>
                                                    <strong>תאריך:</strong> {new Date(ad.createdAt).toLocaleDateString('he-IL')}
                                                </p>
                                            </div>
                                            <span style={{ padding: '8px 16px', background: '#fff3cd', color: '#856404', borderRadius: '20px', fontSize: '14px', fontWeight: 600 }}>
                                                ⏳ ממתין
                                            </span>
                                        </div>
                                        <div style={{ background: '#f8f9fa', padding: '15px', borderRadius: '8px', margin: '15px 0' }}>
                                            <strong style={{ display: 'block', marginBottom: '8px' }}>טקסט המודעה:</strong>
                                            <p style={{ margin: 0, lineHeight: 1.6 }}>{ad.text || 'אין טקסט'}</p>
                                        </div>
                                        {ad.imageData && (
                                            <div style={{ margin: '15px 0' }}>
                                                <img src={ad.imageData} alt="Ad Preview" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                            </div>
                                        )}
                                        <div className="company-dashboard-ad-actions">
                                            <button onClick={() => openModal('approve', ad._id)} className="company-dashboard-btn company-dashboard-btn-approve">✅ אשר מודעה</button>
                                            <button onClick={() => openModal('reject', ad._id)} className="company-dashboard-btn company-dashboard-btn-reject">❌ דחה מודעה</button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'proposals' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-section-container">
                            <h2 className="company-dashboard-section-title">💰 הצעות מחיר מהסוכנים ({proposals.length})</h2>
                            {proposals.length === 0 ? (
                                <div className="company-dashboard-empty-state"><div className="company-dashboard-empty-state-icon">✅</div><p>אין הצעות מחיר חדשות</p></div>
                            ) : (
                                proposals.map(proposal => (
                                    <div key={proposal._id} className="company-dashboard-ad-card">
                                        <div className="company-dashboard-ad-header">
                                            <div>
                                                <h3 style={{ margin: '0 0 10px 0', color: '#2c3e50' }}>📊 {proposal.campaignId?.title || 'קמפיין'}</h3>
                                                <p style={{ color: '#7f8c8d', margin: 0 }}><strong>סוכן:</strong> {proposal.agentId?.fullName || 'לא ידוע'}</p>
                                            </div>
                                            <span style={{ padding: '8px 16px', background: '#fff3cd', color: '#856404', borderRadius: '20px', fontSize: '14px', fontWeight: 600 }}>⏳ ממתין</span>
                                        </div>
                                        <div style={{ background: '#f8f9fa', padding: '20px', borderRadius: '12px', margin: '20px 0' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '15px' }}>
                                                <div style={{ textAlign: 'center', padding: '15px', background: 'white', borderRadius: '10px' }}>
                                                    <div style={{ color: '#95a5a6', fontSize: '14px', marginBottom: '5px' }}>תקציב מקורי</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#95a5a6' }}>₪{proposal.originalBudget.toLocaleString()}</div>
                                                </div>
                                                <div style={{ textAlign: 'center', padding: '15px', background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', borderRadius: '10px', color: 'white' }}>
                                                    <div style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.9 }}>הצעת הסוכן</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>₪{proposal.proposedBudget.toLocaleString()}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderRight: '4px solid #667eea' }}>
                                                <strong style={{ display: 'block', marginBottom: '8px', color: '#2c3e50' }}>💬 הסבר הסוכן:</strong>
                                                <p style={{ margin: 0, lineHeight: 1.6, color: '#666' }}>{proposal.message || 'אין הסבר'}</p>
                                            </div>
                                            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: proposal.proposedBudget > proposal.originalBudget ? '#e74c3c' : '#27ae60' }}>
                                                {proposal.proposedBudget > proposal.originalBudget ? '📈' : '📉'}
                                                {proposal.proposedBudget > proposal.originalBudget ? 'עלייה' : 'הפחתה'} של 
                                                ₪{Math.abs(proposal.proposedBudget - proposal.originalBudget).toLocaleString()}
                                                ({Math.abs(((proposal.proposedBudget - proposal.originalBudget) / proposal.originalBudget) * 100).toFixed(1)}%)
                                            </div>
                                        </div>
                                        <div className="company-dashboard-ad-actions">
                                            <button onClick={() => handleApproveProposal(proposal._id)} className="company-dashboard-btn company-dashboard-btn-approve">
                                                ✅ אשר הצעה
                                            </button>
                                            <button onClick={() => handleRejectProposal(proposal._id)} className="company-dashboard-btn company-dashboard-btn-reject">
                                                ❌ דחה הצעה
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}

                {/* ✅ לשונית תשלומים עם Stripe */}
                {activeTab === 'payments' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-section-container">
                            <PaymentSection highlightedPaymentId={highlightedPaymentId} />
                        </div>
                    </div>
                )}

                {activeTab === 'campaigns' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-campaign-form">
                            <h2 style={{ marginBottom: '25px' }}>🎯 צור קמפיין חדש</h2>
                            <div className="company-dashboard-form-group">
                                <label>שם הקמפיין</label>
                                <input type="text" name="name" value={campaignForm.name} onChange={handleCampaignFormChange} placeholder="לדוגמה: קמפיין קיץ 2025" className="company-dashboard-form-input" />
                            </div>
                            <div className="company-dashboard-form-group">
                                <label>תיאור הקמפיין</label>
                                <textarea name="desc" value={campaignForm.desc} onChange={handleCampaignFormChange} rows="4" placeholder="תאר את מטרות הקמפיין..." className="company-dashboard-form-input"></textarea>
                            </div>
                            <div className="company-dashboard-form-group">
                                <label>קהל יעד</label>
                                <input type="text" name="target" value={campaignForm.target} onChange={handleCampaignFormChange} placeholder="לדוגמה: גברים ונשים 25-45" className="company-dashboard-form-input" />
                            </div>
                            <div className="company-dashboard-form-group">
                                <label>תקציב (₪)</label>
                                <input type="number" name="budget" value={campaignForm.budget} onChange={handleCampaignFormChange} placeholder="5000" className="company-dashboard-form-input" />
                            </div>
                            <div className="company-dashboard-form-group">
                                <label>קישור לאתר החברה</label>
                                <input 
                                    type="url" 
                                    name="websiteUrl" 
                                    value={campaignForm.websiteUrl} 
                                    onChange={handleCampaignFormChange} 
                                    placeholder="https://www.example.com" 
                                    className="company-dashboard-form-input" 
                                />
                            </div>
                            <div className="company-dashboard-form-group">
                                <label>בחר סוכנים לקמפיין ({selectedAgents.length} נבחרו)</label>
                                <div className="company-dashboard-agents-list">
                                    {allAgents.map(agent => (
                                        <div key={agent._id} onClick={() => toggleAgentSelection(agent._id)} className={`company-dashboard-agent-card ${selectedAgents.includes(agent._id) ? 'selected' : ''}`}>
                                            <h3>{agent.fullName}</h3>
                                            <p>{agent.email}</p>
                                            <p style={{fontSize: '12px', color: '#7f8c8d'}}>⭐ {agent.stats?.averageRating?.toFixed(1) || 'N/A'}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <button onClick={handleCreateCampaign} className="company-dashboard-btn company-dashboard-btn-submit">🚀 צור קמפיין</button>
                        </div>
                    </div>
                )}

                {activeTab === 'agents' && (
    <div className="company-dashboard-tab-content">
        <div className="company-dashboard-section-container">
            <h2 className="company-dashboard-section-title">👥 סוכנים זמינים במערכת ({filteredAgents.length} מתוך {allAgents.length})</h2>
            <div className="company-dashboard-filter-bar">
                <select name="rating" onChange={handleAgentFilterChange} value={agentFilters.rating} className="company-dashboard-form-input">
                    <option value="">כל הדירוגים</option>
                    <option value="5">5 כוכבים</option>
                    <option value="4">4+ כוכבים</option>
                    <option value="3">3+ כוכבים</option>
                </select>
                <select name="specialty" onChange={handleAgentFilterChange} value={agentFilters.specialty} className="company-dashboard-form-input">
                    <option value="">כל ההתמחויות</option>
                    <option value="Social Media">מדיה חברתית</option>
                    <option value="SEO">SEO</option>
                    <option value="Content">כתיבת תוכן</option>
                    <option value="Video">וידאו/מולטימדיה</option>
                </select>
                <input
                    type="text"
                    name="search"
                    value={agentFilters.search}
                    onChange={handleAgentFilterChange}
                    placeholder="חפש סוכן (שם/אימייל)..."
                    className="company-dashboard-form-input"
                />
            </div>
            
            <div className="company-dashboard-agents-grid">
                {filteredAgents.length === 0 ? (
                    <div className="company-dashboard-empty-state">
                        <div className="company-dashboard-empty-state-icon">😢</div>
                        <p>לא נמצאו סוכנים התואמים למסננים.</p>
                    </div>
                ) : (
                    filteredAgents.map(agent => (
                        <div key={agent._id} className="company-dashboard-agent-detail-card">
                            <div className="company-dashboard-agent-info">
                                <img src={agent.profilePic || 'https://via.placeholder.com/150'} alt={agent.fullName} className="company-dashboard-agent-avatar" />
                                <div>
                                    <h3 style={{ margin: 0, color: '#3498db' }}>{agent.fullName}</h3>
                                    <p style={{ margin: '5px 0 0 0', color: '#7f8c8d' }}>{agent.specialty || 'כללי'}</p>
                                    {/* ✅ NEW: הצגת שם משתמש ברשת חברתית */}
                                    {agent.socialMediaHandle && (
                                        <p style={{ 
                                            margin: '5px 0 0 0', 
                                            color: '#667eea', 
                                            fontSize: '13px',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px'
                                        }}>
                                            <span>📱</span>
                                            <span>{agent.socialMediaHandle}</span>
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="company-dashboard-agent-stats">
                                <div>
                                    <strong>אימייל:</strong> 
                                    <span style={{ fontSize: '13px', color: '#666' }}>
                                        {agent.email}
                                    </span>
                                </div>
                                <div>
                                    <strong>דירוג:</strong> 
                                    <span style={{ color: '#f39c12' }}>
                                        {agent.stats?.averageRating ? '⭐' + agent.stats.averageRating.toFixed(1) : 'אין דירוג'}
                                    </span>
                                </div>
                                <div>
                                    <strong>קמפיינים:</strong> {agent.stats?.campaignsCompleted || 0}
                                </div>
                            </div>
                            <button 
                                onClick={() => console.log('Hire agent ' + agent._id)} 
                                className="company-dashboard-btn company-dashboard-btn-approve" 
                                style={{ padding: '8px 15px', fontSize: '14px' }}
                            >
                                ➕ צור קמפיין עם סוכן זה
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    </div>
)}

                {activeTab === 'history' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-section-container">
                            <h2 className="company-dashboard-section-title">📜 היסטוריית מודעות וקמפיינים ({history.length})</h2>
                            
                            {history.length === 0 ? (
                                <div className="company-dashboard-empty-state">
                                    <div className="company-dashboard-empty-state-icon">📝</div>
                                    <p>אין היסטוריית מודעות קודמת</p>
                                </div>
                            ) : (
                                <div className="company-dashboard-history-list">
                                    {history.map(ad => {
                                        let statusInfo = { text: 'ממתין', color: '#856404', background: '#fff3cd', icon: '⏳' };
                                        if (ad.status === 'approved') {
                                            statusInfo = { text: 'אושר', color: '#155724', background: '#d4edda', icon: '✅' };
                                        } else if (ad.status === 'rejected') {
                                            statusInfo = { text: 'נדחה', color: '#721c24', background: '#f8d7da', icon: '❌' };
                                        }
                                        
                                        return (
                                            <div key={ad._id} className="company-dashboard-history-item" style={{ borderRight: `5px solid ${statusInfo.color}` }}>
                                                <div className="company-dashboard-history-details">
                                                    <div style={{ fontWeight: 'bold', fontSize: '18px', marginBottom: '5px' }}>
                                                        {ad.title || 'מודעה ללא כותרת'}
                                                    </div>
                                                    <p style={{ margin: '0 0 5px 0', color: '#7f8c8d' }}>
                                                        <strong>קמפיין:</strong> {ad.campaignId?.title || 'כללי'} | 
                                                        <strong>סוכן:</strong> {ad.agentId?.fullName || 'לא ידוע'}
                                                    </p>
                                                    <p style={{ margin: '0', color: '#7f8c8d', fontSize: '12px' }}>
                                                        נוצר ב: {new Date(ad.createdAt).toLocaleDateString('he-IL')}
                                                    </p>
                                                </div>
                                                <span style={{ padding: '8px 16px', background: statusInfo.background, color: statusInfo.color, borderRadius: '20px', fontSize: '14px', fontWeight: 600 }}>
                                                    {statusInfo.icon} {statusInfo.text}
                                                </span>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const ApproveModal = ({ setModal, handleApproveAd, rating, setRating, approveComment, setApproveComment }) => {
    return (
        <div className="company-dashboard-modal">
            <div className="company-dashboard-modal-content">
                <h3 className="company-dashboard-section-title">✅ אשר פרסומת</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>דרג את עבודת הסוכן כדי לעזור לאחרים</p>
                <div className="company-dashboard-form-group">
                    <label>דירוג</label>
                    <div className="company-dashboard-rating-stars">
                        {[1, 2, 3, 4, 5].map(star => (
                            <span key={star} onClick={() => setRating(star)} className={`company-dashboard-star ${rating >= star ? 'active' : ''}`}>★</span>
                        ))}
                    </div>
                </div>
                <div className="company-dashboard-form-group">
                    <label>תגובה (אופציונלי)</label>
                    <textarea value={approveComment} onChange={(e) => setApproveComment(e.target.value)} rows="3" placeholder="מה אהבת בפרסומת?" className="company-dashboard-form-input"></textarea>
                </div>
                <div className="company-dashboard-modal-actions">
                    <button onClick={() => setModal({ type: null, adId: null })} className="company-dashboard-btn company-dashboard-btn-cancel">ביטול</button>
                    <button onClick={handleApproveAd} className="company-dashboard-btn company-dashboard-btn-submit">אשר ודרג</button>
                </div>
            </div>
        </div>
    );
};

const RejectModal = ({ setModal, handleRejectAd, rejectReason, setRejectReason, rejectDetails, setRejectDetails, allowRevision, setAllowRevision }) => {
    const [selectedComponents, setSelectedComponents] = useState([]);

    const components = [
        { id: 'title', label: '📝 הכותרת', description: 'הכותרת לא מתאימה או צריכה שיפור' },
        { id: 'text', label: '💬 טקסט הפרסומת', description: 'הטקסט צריך שינוי או עריכה' },
        { id: 'image', label: '🖼️ התמונה', description: 'התמונה לא מתאימה או באיכות נמוכה' }
    ];

    const toggleComponent = (id) => {
        setSelectedComponents(prev =>
            prev.includes(id) ? prev.filter(c => c !== id) : [...prev, id]
        );
    };

    const handleSubmitReject = () => {
        if (selectedComponents.length === 0) {
            alert('אנא בחר לפחות רכיב אחד');
            return;
        }
        
        if (!rejectDetails) {
            alert('אנא הוסף הסבר מפורט');
            return;
        }

        const reasonsList = selectedComponents.join(', ');
        
        setRejectReason(reasonsList);
        handleRejectAd(reasonsList, rejectDetails, allowRevision || false);
    };

    return (
        <div className="company-dashboard-modal">
            <div className="company-dashboard-modal-content">
                <h3 className="company-dashboard-section-title">❌ דחה פרסומת</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>בחר רכיבים לשינוי</p>
                
                <div style={{ marginBottom: '20px' }}>
                    {components.map(comp => (
                        <div
                            key={comp.id}
                            onClick={() => toggleComponent(comp.id)}
                            style={{
                                border: selectedComponents.includes(comp.id) ? '2px solid #667eea' : '2px solid #ddd',
                                borderRadius: '10px',
                                padding: '15px',
                                marginBottom: '12px',
                                cursor: 'pointer',
                                backgroundColor: selectedComponents.includes(comp.id) ? '#f0f7ff' : 'white',
                                transition: 'all 0.2s'
                            }}
                        >
                            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '5px' }}>
                                <div style={{
                                    width: '22px',
                                    height: '22px',
                                    border: '2px solid #667eea',
                                    borderRadius: '4px',
                                    marginLeft: '10px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: '14px',
                                    fontWeight: 'bold',
                                    color: '#667eea'
                                }}>
                                    {selectedComponents.includes(comp.id) && '✓'}
                                </div>
                                <strong style={{ fontSize: '16px' }}>{comp.label}</strong>
                            </div>
                            <p style={{ 
                                margin: 0, 
                                paddingRight: '32px', 
                                fontSize: '13px', 
                                color: '#666' 
                            }}>
                                {comp.description}
                            </p>
                        </div>
                    ))}
                </div>

                {selectedComponents.length > 0 && (
                    <div style={{
                        padding: '12px',
                        backgroundColor: '#e8f5e9',
                        borderRadius: '8px',
                        marginBottom: '15px',
                        textAlign: 'center',
                        fontWeight: 'bold',
                        color: '#2e7d32'
                    }}>
                        ✓ נבחרו {selectedComponents.length} רכיבים
                    </div>
                )}

                <div className="company-dashboard-form-group">
                    <label>הסבר מפורט *</label>
                    <textarea 
                        value={rejectDetails} 
                        onChange={(e) => setRejectDetails(e.target.value)} 
                        rows="4" 
                        placeholder="פרט מה לא התאים ומה ניתן לשפר..." 
                        className="company-dashboard-form-input"
                    />
                </div>

                <div className="company-dashboard-form-group">
                    <label className="company-dashboard-checkbox-label">
                        <input 
                            type="checkbox" 
                            checked={allowRevision} 
                            onChange={(e) => setAllowRevision(e.target.checked)} 
                        />
                        <span>אפשר לסוכן לשלוח גרסה מתוקנת</span>
                    </label>
                </div>

                <div className="company-dashboard-modal-actions">
                    <button 
                        onClick={() => setModal({ type: null, adId: null })} 
                        className="company-dashboard-btn company-dashboard-btn-cancel"
                    >
                        ביטול
                    </button>
                    <button 
                        onClick={handleSubmitReject}
                        disabled={selectedComponents.length === 0 || !rejectDetails}
                        className="company-dashboard-btn company-dashboard-btn-reject"
                        style={{
                            opacity: (selectedComponents.length === 0 || !rejectDetails) ? 0.5 : 1,
                            cursor: (selectedComponents.length === 0 || !rejectDetails) ? 'not-allowed' : 'pointer'
                        }}
                    >
                        דחה פרסומת
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyDashboard;