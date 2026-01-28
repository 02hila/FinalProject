/**
 * CompanyDashboard Component
 *
 * Main dashboard interface for company users in the Ads Maker platform.
 * Provides comprehensive campaign management, ad approval workflow,
 * agent management, and financial tracking capabilities.
 *
 * Features:
 * - Multi-tab interface (Overview, Pending Ads, Proposals, Campaigns, Agents, History)
 * - Ad approval/rejection workflow with rating system
 * - Campaign creation and assignment to agents
 * - Price proposal management and approval
 * - Agent filtering and selection
 * - Real-time statistics and history tracking
 * - Responsive design with modal dialogs
 *
 * @component
 * @returns {JSX.Element} The company dashboard interface
 */
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate } from 'react-router-dom';
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
    const { user, loading, handleLogout, loadUserFromToken } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('overview');
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });
    // Pending Ads State
    const [pendingAds, setPendingAds] = useState([]);
    const [loadingAds, setLoadingAds] = useState(false);
    // Agents State
    const [allAgents, setAllAgents] = useState([]);
    const [filteredAgents, setFilteredAgents] = useState([]);
    const [agentFilters, setAgentFilters] = useState({ rating: '', specialty: '', search: '' });
    // Campaigns State
    const [campaignForm, setCampaignForm] = useState({ name: '', desc: '', target: '', budget: '' });
    const [selectedAgents, setSelectedAgents] = useState([]);
    // History State
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    // Proposals State
    const [proposals, setProposals] = useState([]);
    const [loadingProposals, setLoadingProposals] = useState(false);
    // Global data loaded flag
    const [dataLoaded, setDataLoaded] = useState(false);
    // Modal State
    const [modal, setModal] = useState({ type: null, adId: null });
    const [rating, setRating] = useState(0);
    const [approveComment, setApproveComment] = useState('');
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDetails, setRejectDetails] = useState('');
    const [allowRevision, setAllowRevision] = useState(false);

    // FIX 1: Remove user dependency from fetch functions
    const fetchPendingAds = async (userId) => {
        if (!userId) return;
        setLoadingAds(true);
        try {
            console.log('🔵 Fetching pending ads for:', userId);
            const data = await getPendingAds(userId);
            console.log('🔵 Pending ads response:', data);
            if (data.success) {
                setPendingAds(data.ads || []);
                setStats(prev => ({ ...prev, pendingAds: data.ads?.length || 0 }));
                console.log('✅ Set', data.ads?.length, 'pending ads');
            }
        } catch (error) {
            console.error("Error fetching pending ads:", error);
        } finally {
            setLoadingAds(false);
        }
    };

    const fetchAgents = async () => {
        try {
            const data = await getAgents();
            if (data.success) {
                setAllAgents(data.agents || []);
                setFilteredAgents(data.agents || []);
            }
        } catch (error) {
            console.error("Error fetching agents:", error);
        }
    };

    const fetchHistory = async (userId) => {
        if (!userId) return;
        setLoadingHistory(true);
        try {
            console.log('🔵 Fetching history for:', userId);
            const data = await getHistory(userId);
            console.log('🔵 History response:', data);
            if (data.success) {
                setHistory(data.ads || []);
                console.log('✅ Set', data.ads?.length, 'history ads');
            }
        } catch (error) {
            console.error("Error fetching history:", error);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchProposals = async (userId) => {
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
    };

    const refetchData = useCallback(() => {
        if (user?._id) {
            fetchPendingAds(user._id);
            fetchAgents();
            fetchHistory(user._id);
            fetchProposals(user._id);
        }
    }, [user?._id]);

    // FIX 2: Simplified useEffect with no function dependencies
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
    }, [user?._id, dataLoaded]); // Only depend on user._id and dataLoaded

    const handleTabClick = (tab) => {
        setActiveTab(tab);
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

    // FIX 3: Better handling of empty history
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
            alert('Please fill in all fields');
            return;
        }
        if (selectedAgents.length === 0) {
            alert('Please select at least one agent');
            return;
        }

        const campaignData = {
            title: campaignForm.name,
            description: campaignForm.desc,
            targetAudience: campaignForm.target,
            budget: campaignForm.budget,
            assignedAgents: selectedAgents,
            companyId: user._id
        };

        try {
            const data = await apiCreateCampaign(campaignData);
            if (data.success) {
                alert('🎉 הקמפיין נוצר בהצלחה!');
                setCampaignForm({ name: '', desc: '', target: '', budget: '' });
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

    const handleApproveAd = async () => {
        console.log('🔵 handleApproveAd started', { rating, modal });
        
        if (rating === 0) {
            alert('אנא בחר דירוג');
            return;
        }
        
        // FIX: Save adId BEFORE clearing modal
        const adId = modal.adId;
        console.log('🔵 Saved adId:', adId);
        
        try {
            console.log('🔵 Calling approveAd API...', { adId, rating, comment: approveComment, companyId: user._id });
            
            const data = await apiApproveAd(adId, { rating, comment: approveComment, companyId: user._id });
            
            console.log('🔵 API Response:', data);
            
            if (data.success) {
                console.log('✅ Ad approved successfully!');
                
                //  Show success message FIRST
                alert('✅ הפרסומת אושרה בהצלחה! המודעה הועברה להיסטוריה.');
                
                // Then close modal
                setModal({ type: null, adId: null });
                
                // Clear form
                setRating(0);
                setApproveComment('');
                
                // Force reload all data
                console.log('🔵 Reloading data...');
                setDataLoaded(false);
                
                await Promise.all([
                    fetchPendingAds(user._id),
                    fetchHistory(user._id),
                    fetchProposals(user._id)
                ]);
                
                console.log('✅ Data reloaded!');
                setDataLoaded(true);
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

    const handleRejectAd = async () => {
        if (!rejectReason || !rejectDetails) {
            alert('אנא מלא את כל שדות החובה');
            return;
        }
        
        // FIX: Save adId BEFORE clearing modal
        const adId = modal.adId;
        
        try {
            const data = await apiRejectAd(adId, { 
                rejectionReason: rejectReason,
                rejectionDetails: rejectDetails, 
                allowRevision 
            });
            
            if (data.success) {
                // Show success message FIRST
                alert('❌ הפרסומת נדחתה בהצלחה. הסוכן יקבל הודעה עם הסיבה.');
                
                // Then close modal
                setModal({ type: null, adId: null });
                
                // Clear form
                setRejectReason('');
                setRejectDetails('');
                setAllowRevision(false);
                
                // Force reload all data
                setDataLoaded(false);
                await Promise.all([
                    fetchPendingAds(user._id),
                    fetchHistory(user._id),
                    fetchProposals(user._id)
                ]);
                setDataLoaded(true);
            } else {
                alert('שגיאה בדחיית הפרסומת: ' + data.error);
                setModal({ type: null, adId: null });
            }
        } catch (error) {
            console.error('Error rejecting ad:', error);
            alert('❌ שגיאה בדחיית הפרסומת');
            setModal({ type: null, adId: null });
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
                refetchData();
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
                refetchData();
            } else {
                alert('❌ שגיאה: ' + (data.error || 'לא ניתן לדחות את ההצעה'));
            }
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            alert('❌ שגיאה בדחיית ההצעה');
        }
    };

    if (!user) {
        return null;
    }

    return (
        <div className="company-dashboard-body">
            {modal.type === 'approve' && <ApproveModal setModal={setModal} handleApproveAd={handleApproveAd} rating={rating} setRating={setRating} approveComment={approveComment} setApproveComment={setApproveComment} />}
            {modal.type === 'reject' && <RejectModal setModal={setModal} handleRejectAd={handleRejectAd} rejectReason={rejectReason} setRejectReason={setRejectReason} rejectDetails={rejectDetails} setRejectDetails={setRejectDetails} allowRevision={allowRevision} setAllowRevision={setAllowRevision} />}

            <nav className="company-dashboard-navbar">
                <div className="company-dashboard-navbar-brand">
                    <span>⚡</span>
                    <span>Ads Maker - דשבורד חברה</span>
                </div>
                <div className="company-dashboard-navbar-user">
                    <span className="company-dashboard-user-badge">🏢 חברה</span>
                    <span>{user?.companyName || user?.fullName || 'משתמש'}</span>
                    <button className="company-dashboard-btn-logout" onClick={handleLogout}>
                        יציאה
                    </button>
                </div>
            </nav>

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
                        className={`company-dashboard-tab-btn ${activeTab === 'pending' ? 'active' : ''}`}
                        onClick={() => handleTabClick('pending')}
                    >
                        <span>⏰</span>
                        <span>ממתין לאישור</span>
                        {stats.pendingAds > 0 && (
                            <span className="company-dashboard-badge">{stats.pendingAds}</span>
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
                                פרסומות ממתינות לאישור ({pendingAds.length})
                            </h2>
                            
                            {pendingAds.length === 0 ? (
                                <div className="company-dashboard-empty-state">
                                    <div className="company-dashboard-empty-state-icon">✅</div>
                                    <p>אין פרסומות ממתינות לאישור</p>
                                </div>
                            ) : (
                                pendingAds.map((ad, index) => {
                                    // Better validation: check if it's a valid base64 image
                                    const hasValidImage = ad.imageData && 
                                                         ad.imageData.length > 100 && 
                                                         (ad.imageData.startsWith('data:image/') || ad.imageData.startsWith('/9j/'));
                                    
                                    if (!hasValidImage && ad.imageData) {
                                        console.log(`⚠️ Ad ${index + 1} has invalid imageData:`, {
                                            id: ad._id,
                                            title: ad.title,
                                            imageLength: ad.imageData?.length,
                                            imageStart: ad.imageData?.substring(0, 50)
                                        });
                                    }
                                    
                                    return (
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
                                        
                                        <div style={{ margin: '15px 0' }}>
                                            {hasValidImage ? (
                                                <img 
                                                    src={ad.imageData} 
                                                    alt="Ad Preview" 
                                                    loading="lazy"
                                                    style={{ 
                                                        maxWidth: '100%', 
                                                        height: 'auto', 
                                                        borderRadius: '8px', 
                                                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                        display: 'block'
                                                    }}
                                                    onError={(e) => {
                                                        console.error('❌ Failed to load image for ad:', ad._id);
                                                        e.target.style.display = 'none';
                                                        const errorDiv = document.createElement('div');
                                                        errorDiv.style.cssText = 'padding: 40px; background: #ffebee; border-radius: 8px; text-align: center; color: #c62828; border: 2px solid #ef5350;';
                                                        errorDiv.innerHTML = `
                                                            <div style="font-size: 48px; margin-bottom: 10px;">⚠️</div>
                                                            <p style="margin: 0; font-weight: bold;">שגיאה בטעינת התמונה</p>
                                                            <p style="margin: 5px 0 0 0; font-size: 12px;">יתכן שהתמונה פגומה או גדולה מדי</p>
                                                        `;
                                                        e.target.parentElement.appendChild(errorDiv);
                                                    }}
                                                />
                                            ) : (
                                                <div style={{ padding: '40px', background: '#f0f0f0', borderRadius: '8px', textAlign: 'center', border: '2px dashed #ccc' }}>
                                                    <div style={{ fontSize: '48px', marginBottom: '10px' }}>🖼️</div>
                                                    <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>אין תמונה למודעה זו</p>
                                                    <p style={{ margin: '5px 0 0 0', color: '#999', fontSize: '12px' }}>המודעה מכילה רק טקסט</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="company-dashboard-ad-actions">
                                            <button onClick={() => openModal('approve', ad._id)} className="company-dashboard-btn company-dashboard-btn-approve">✅ אשר מודעה</button>
                                            <button onClick={() => openModal('reject', ad._id)} className="company-dashboard-btn company-dashboard-btn-reject">❌ דחה מודעה</button>
                                        </div>
                                    </div>
                                )})
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
                                                </div>
                                            </div>
                                            <div className="company-dashboard-agent-stats">
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
    return (
        <div className="company-dashboard-modal">
            <div className="company-dashboard-modal-content">
                <h3 className="company-dashboard-section-title">❌ דחה פרסומת</h3>
                <p style={{ color: '#666', marginBottom: '20px' }}>אנא פרט מדוע דחית את הפרסומת - זה יעזור לסוכן להשתפר</p>
                <div className="company-dashboard-form-group">
                    <label>סיבת הדחייה *</label>
                    <select value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} className="company-dashboard-form-input">
                        <option value="">בחר סיבה...</option>
                        <option value="not_relevant">לא רלוונטי למוצר/שירות</option>
                        <option value="poor_quality">איכות גרפית נמוכה</option>
                        <option value="wrong_message">המסר לא נכון</option>
                        <option value="target_audience">לא מתאים לקהל היעד</option>
                        <option value="brand_mismatch">לא מתאים למותג</option>
                        <option value="other">אחר</option>
                    </select>
                </div>
                <div className="company-dashboard-form-group">
                    <label>הסבר מפורט *</label>
                    <textarea value={rejectDetails} onChange={(e) => setRejectDetails(e.target.value)} rows="4" placeholder="פרט מה לא התאים ומה ניתן לשפר..." className="company-dashboard-form-input"></textarea>
                </div>
                <div className="company-dashboard-form-group">
                    <label className="company-dashboard-checkbox-label">
                        <input type="checkbox" checked={allowRevision} onChange={(e) => setAllowRevision(e.target.checked)} />
                        <span>אפשר לסוכן לשלוח גרסה מתוקנת</span>
                    </label>
                </div>
                <div className="company-dashboard-modal-actions">
                    <button onClick={() => setModal({ type: null, adId: null })} className="company-dashboard-btn company-dashboard-btn-cancel">ביטול</button>
                    <button onClick={handleRejectAd} className="company-dashboard-btn company-dashboard-btn-reject">דחה פרסומת</button>
                </div>
            </div>
        </div>
    );
};

export default CompanyDashboard;