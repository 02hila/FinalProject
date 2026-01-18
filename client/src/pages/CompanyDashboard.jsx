/**
 * CompanyDashboard - Main Dashboard for Company Users
 *
 * This component serves as the central hub for companies to manage their
 * advertising operations. It provides a tabbed interface with the following sections:
 *
 * Tabs:
 *   - Overview: Statistics cards showing ad counts (approved, pending, rejected)
 *   - Pending: Ads waiting for company approval with approve/reject actions
 *   - Proposals: Price proposals from agents for budget adjustments
 *   - Campaigns: Create and manage advertising campaigns
 *   - Agents: Browse and select agents for campaigns
 *   - History: View past approved and rejected ads
 *
 * Features:
 *   - Server-side pagination for pending ads
 *   - Auto-refresh every 30 seconds
 *   - Rating system for approved ads
 *   - Detailed rejection workflow with component selection
 *
 * Data is automatically filtered to show only the company's own data.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import SharedHeader from '../components/SharedHeader';
import PaymentSection from '../components/PaymentSection';
import ExpandableText from '../components/ExpandableText';
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

// Number of ads to display per page in the pending ads section
const ITEMS_PER_PAGE = 6;

const CompanyDashboard = () => {
    // Authentication and navigation hooks
    const { user, loading, handleLogout } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ============================================
    // State Management
    // ============================================

    // Currently active tab in the dashboard navigation
    const [activeTab, setActiveTab] = useState('overview');

    // Summary statistics for the overview cards
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });

    // Ads waiting for company review and approval
    const [pendingAds, setPendingAds] = useState([]);
    const [loadingAds, setLoadingAds] = useState(false);

    // All available agents and filtered subset based on search criteria
    const [allAgents, setAllAgents] = useState([]);
    const [filteredAgents, setFilteredAgents] = useState([]);
    const [agentFilters, setAgentFilters] = useState({ rating: '', specialty: '', search: '' });

    // Form data for creating new campaigns
    const [campaignForm, setCampaignForm] = useState({ name: '', desc: '', target: '', budget: '', websiteUrl: '' });

    // Agents selected to work on a new campaign
    const [selectedAgents, setSelectedAgents] = useState([]);

    // Historical ads (approved and rejected)
    const [history, setHistory] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Price proposals from agents requesting budget changes
    const [proposals, setProposals] = useState([]);
    const [loadingProposals, setLoadingProposals] = useState(false);

    // Flag indicating initial data load is complete
    const [dataLoaded, setDataLoaded] = useState(false);

    // Modal state for approve/reject dialogs
    const [modal, setModal] = useState({ type: null, adId: null });

    // Rating and feedback for approving ads
    const [rating, setRating] = useState(0);
    const [approveComment, setApproveComment] = useState('');

    // Rejection form fields
    const [rejectReason, setRejectReason] = useState('');
    const [rejectDetails, setRejectDetails] = useState('');
    const [allowRevision, setAllowRevision] = useState(false);

    // Used to trigger re-renders after data updates
    const [updateCounter, setUpdateCounter] = useState(0);

    // For highlighting a specific payment when redirected from notifications
    const [highlightedPaymentId, setHighlightedPaymentId] = useState(null);

    // Loading state for statistics fetch
    const [statsLoading, setStatsLoading] = useState(true);

    // Server-side pagination for pending ads list
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [totalAds, setTotalAds] = useState(0);
    
    // ============================================
    // Data Fetching Functions
    // ============================================

    /**
     * Fetches dashboard statistics from the server.
     * Updates the stats state with counts for approved, pending, and rejected ads.
     */
    const fetchStats = useCallback(async () => {
        if (!user?._id) return;
        try {
            const token = localStorage.getItem('token');
            const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000';
            const response = await fetch(`${API_URL}/api/company/stats`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await response.json();
            if (data.success && data.stats) {
                // Use functional update to preserve proposalsCount from fetchProposals
                setStats(prev => ({
                    ...prev,
                    pendingAds: data.stats.ads?.pending || 0,
                    approvedAds: data.stats.ads?.approved || 0,
                    rejectedAds: data.stats.ads?.rejected || 0,
                    totalAds: data.stats.ads?.total || 0
                }));
            }
        } catch (error) {
            console.error("Error fetching stats:", error);
        } finally {
            setStatsLoading(false);
        }
    }, [user?._id]);
    
    // קריאת query parameters מה-URL
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
            if (!tabParam) {
                setActiveTab('payments');
            }
        }
    }, [searchParams]);
    
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
    
    /**
     * Fetches pending ads with server-side pagination.
     * Only retrieves ads that need company approval.
     *
     * @param {string} userId - The company's user ID
     * @param {number} page - Page number to fetch (1-indexed)
     * @param {boolean} showLoader - Whether to show loading indicator
     */
    const fetchPendingAds = useCallback(async (userId, page = 1, showLoader = true) => {
        if (!userId) return;
        
        if (showLoader) {
            setLoadingAds(true);
        }
        
        try {
            console.log(`📡 Fetching pending ads - Page: ${page}`);
            const data = await getPendingAds(userId, page, ITEMS_PER_PAGE);
            
            if (data.success) {
                setPendingAds(data.ads || []);
                setTotalPages(data.totalPages || 1);
                setTotalAds(data.total || 0);
                setCurrentPage(data.currentPage || page);
                
                // Update stats with total from server
                setStats(prev => ({ ...prev, pendingAds: data.total || 0 }));
                
                console.log(`✅ Loaded ${data.ads?.length || 0} ads, Page ${data.currentPage} of ${data.totalPages}, Total: ${data.total}`);
            }
        } catch (error) {
            console.error("Error fetching pending ads:", error);
        } finally {
            if (showLoader) {
                setLoadingAds(false);
            }
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

    // Initial load and polling
    useEffect(() => {
        if (user?._id) {
            setStatsLoading(true);
            Promise.all([
                fetchStats(),
                fetchPendingAds(user._id, 1, true),
                fetchAgents(),
                fetchHistory(user._id),
                fetchProposals(user._id)
            ]).finally(() => {
                setDataLoaded(true);
            });

            // Poll every 30 seconds
            const statsInterval = setInterval(() => {
                fetchStats();
                fetchPendingAds(user._id, currentPage, false);
                fetchProposals(user._id);
            }, 30000);

            return () => clearInterval(statsInterval);
        }
    }, [user?._id, fetchStats, fetchPendingAds, fetchAgents, fetchHistory, fetchProposals]);

    // ============================================
    // Pagination Handlers
    // ============================================

    /**
     * Navigates to a specific page of pending ads.
     * Scrolls the container into view after page change.
     */
    const goToPage = (page) => {
        if (page >= 1 && page <= totalPages && page !== currentPage) {
            setCurrentPage(page);
            fetchPendingAds(user._id, page, true);
            document.querySelector('.company-dashboard-pending-ads-container')?.scrollIntoView({ behavior: 'smooth' });
        }
    };

    const goToPreviousPage = () => {
        if (currentPage > 1) {
            goToPage(currentPage - 1);
        }
    };

    const goToNextPage = () => {
        if (currentPage < totalPages) {
            goToPage(currentPage + 1);
        }
    };

    // Generate page numbers array
    const getPageNumbers = () => {
        const pages = [];
        const maxVisiblePages = 5;
        
        if (totalPages <= maxVisiblePages) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);
            
            if (currentPage > 3) {
                pages.push('...');
            }
            
            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);
            
            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) {
                    pages.push(i);
                }
            }
            
            if (currentPage < totalPages - 2) {
                pages.push('...');
            }
            
            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }
        
        return pages;
    };

    const handleTabClick = (tab) => {
        setActiveTab(tab);
        
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
        if (statsLoading) {
            return { approved: 0, pending: 0, rejected: 0, total: 0 };
        }
        return {
            approved: stats.approvedAds || history.filter(ad => ad.status === 'approved').length,
            pending: stats.pendingAds || history.filter(ad => ad.status === 'pending').length,
            rejected: stats.rejectedAds || history.filter(ad => ad.status === 'rejected').length,
            total: stats.totalAds || history.length
        };
    }, [history, stats, statsLoading]);

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
                
                // Close modal and clear form
                setModal({ type: null, adId: null });
                setRating(0);
                setApproveComment('');
                
                // Show success message
                alert('✅ הפרסומת אושרה בהצלחה! המודעה הועברה להיסטוריה.');
                
                // ✅ Refresh current page
                await fetchPendingAds(user._id, currentPage, true);
                
                console.log('✅ Pending ads refreshed!');
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

    const handleRejectAd = async (overrideReason = null, overrideDetails = null, overrideAllowRevision = null) => {
        const finalReason = overrideReason !== null ? overrideReason : rejectReason;
        const finalDetails = overrideDetails !== null ? overrideDetails : rejectDetails;
        const finalAllowRevision = overrideAllowRevision !== null ? overrideAllowRevision : allowRevision;
        
        if (!finalReason || !finalDetails) {
            alert('אנא מלא את כל שדות החובה');
            return;
        }
        
        const adId = modal.adId;
        
        setModal({ type: null, adId: null });
        
        try {
            const data = await apiRejectAd(adId, { 
                rejectionReason: finalReason,
                rejectionDetails: finalDetails, 
                allowRevision: finalAllowRevision 
            });
            
            if (data.success) {
                console.log('✅ Ad rejected and alternative created!');
                
                setRejectReason('');
                setRejectDetails('');
                setAllowRevision(false);
                
                alert('✅ הפרסומת נדחתה ופרסומת חלופית נוצרה! הרשימה תתעדכן.');
                
                // Refresh current page
                await fetchPendingAds(user._id, currentPage, true);
                
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
                await fetchProposals(user._id);
            } else {
                alert('❌ שגיאה: ' + (data.error || 'לא ניתן לדחות את ההצעה'));
            }
        } catch (error) {
            console.error('Error rejecting proposal:', error);
            alert('❌ שגיאה בדחיית ההצעה');
        }
    };

    // Debug logs
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

    // Calculate display range for pagination info
    const indexOfFirstAd = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const indexOfLastAd = Math.min(currentPage * ITEMS_PER_PAGE, totalAds);

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
                        {proposals.length > 0 && (
                            <span className="company-dashboard-badge">{proposals.length}</span>
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
                        {dataLoaded && history.filter(ad => !ad.isDeleted && ad.status !== 'deleted').length > 0 && (
                            <span className="company-dashboard-badge" style={{background: '#95a5a6'}}>{history.filter(ad => !ad.isDeleted && ad.status !== 'deleted').length}</span>
                        )}
                    </button>
                </div>
                
                {activeTab === 'overview' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-stats-grid">
                            <div className="company-dashboard-stat-card approved">
                                <div className="company-dashboard-stat-icon">✅</div>
                                <div className="company-dashboard-stat-value">
                                    {statsLoading ? <span className="company-dashboard-loading">...</span> : dashboardStats.approved}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות שאושרו</div>
                            </div>
                            <div className="company-dashboard-stat-card pending">
                                <div className="company-dashboard-stat-icon">⏳</div>
                                <div className="company-dashboard-stat-value">
                                    {statsLoading ? <span className="company-dashboard-loading">...</span> : dashboardStats.pending}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות ממתינות</div>
                            </div>
                            <div className="company-dashboard-stat-card rejected">
                                <div className="company-dashboard-stat-icon">❌</div>
                                <div className="company-dashboard-stat-value">
                                    {statsLoading ? <span className="company-dashboard-loading">...</span> : dashboardStats.rejected}
                                </div>
                                <div className="company-dashboard-stat-label">מודעות שנדחו</div>
                            </div>
                            <div className="company-dashboard-stat-card">
                                <div className="company-dashboard-stat-icon">📊</div>
                                <div className="company-dashboard-stat-value">
                                    {statsLoading ? <span className="company-dashboard-loading">...</span> : dashboardStats.total}
                                </div>
                                <div className="company-dashboard-stat-label">סה"כ מודעות</div>
                            </div>
                            {/* הצעות מחיר בסקירה כללית */}
                            <div className="company-dashboard-stat-card proposals">
                                <div className="company-dashboard-stat-icon">💰</div>
                                <div className="company-dashboard-stat-value">
                                    {loadingProposals ? <span className="company-dashboard-loading">...</span> : proposals.length}
                                </div>
                                <div className="company-dashboard-stat-label">הצעות מחיר ממתינות</div>
                            </div>
                            {/* סוכנים פעילים */}
                            <div className="company-dashboard-stat-card agents">
                                <div className="company-dashboard-stat-icon">👥</div>
                                <div className="company-dashboard-stat-value">
                                    {statsLoading ? <span className="company-dashboard-loading">...</span> : allAgents.length}
                                </div>
                                <div className="company-dashboard-stat-label">סוכנים זמינים</div>
                            </div>
                        </div>
                    </div>
                )}
                
                {activeTab === 'pending' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-pending-ads-container">
                            <h2 className="company-dashboard-section-title">
                                <span>⏰</span>
                                פרסומות ממתינות לאישור ({totalAds})
                            </h2>
                            
                            {loadingAds ? (
                                <div className="company-dashboard-empty-state">
                                    <div className="company-dashboard-empty-state-icon">⏳</div>
                                    <p>טוען פרסומות...</p>
                                </div>
                            ) : pendingAds.length === 0 ? (
                                <div className="company-dashboard-empty-state">
                                    <div className="company-dashboard-empty-state-icon">✅</div>
                                    <p>אין פרסומות ממתינות לאישור</p>
                                </div>
                            ) : (
                                <>
                                    {/* Pagination Info */}
                                    {totalAds > 0 && (
                                        <div className="company-dashboard-pagination-info">
                                            מציג {indexOfFirstAd}-{indexOfLastAd} מתוך {totalAds} פרסומות
                                        </div>
                                    )}
                                    
                                    {/* Ads Grid */}
                                    <div className="company-dashboard-ads-grid">
                                        {pendingAds.map(ad => (
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
                                                    <ExpandableText
                                                        text={ad.text || 'אין טקסט'}
                                                        maxLines={3}
                                                        style={{ margin: 0, color: '#2c3e50' }}
                                                    />
                                                </div>
                                                {ad.imageData && (
                                                    <div style={{ margin: '15px 0' }}>
                                                        <img src={ad.imageData} alt="Ad Preview" style={{ maxWidth: '100%', height: 'auto', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                                    </div>
                                                )}
                                                {/* QR Code Section */}
                                                {ad.qrCode?.enabled && ad.qrCode?.imageData && (
                                                    <div style={{
                                                        background: 'linear-gradient(135deg, #f8f9ff 0%, #fff 100%)',
                                                        border: '2px solid #e8eaff',
                                                        borderRadius: '12px',
                                                        padding: '15px',
                                                        margin: '15px 0'
                                                    }}>
                                                        <div style={{
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '8px',
                                                            marginBottom: '12px',
                                                            color: '#667eea',
                                                            fontWeight: 600,
                                                            fontSize: '14px'
                                                        }}>
                                                            <i className="fas fa-qrcode" style={{ fontSize: '18px' }}></i>
                                                            <span>QR Code</span>
                                                            {ad.qrCode.scans > 0 && (
                                                                <span style={{
                                                                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                                                    color: 'white',
                                                                    padding: '3px 10px',
                                                                    borderRadius: '12px',
                                                                    fontSize: '11px',
                                                                    marginRight: 'auto'
                                                                }}>{ad.qrCode.scans} סריקות</span>
                                                            )}
                                                        </div>
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                                            <img
                                                                src={ad.qrCode.imageData}
                                                                alt="QR Code"
                                                                style={{
                                                                    width: '80px',
                                                                    height: '80px',
                                                                    borderRadius: '8px',
                                                                    border: '2px solid #ecf0f1',
                                                                    background: 'white',
                                                                    padding: '5px'
                                                                }}
                                                            />
                                                            {ad.qrCode.shortUrl && (
                                                                <div style={{ flex: 1, minWidth: 0 }}>
                                                                    <a
                                                                        href={ad.qrCode.shortUrl}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        style={{
                                                                            color: '#667eea',
                                                                            textDecoration: 'none',
                                                                            fontSize: '12px',
                                                                            wordBreak: 'break-all',
                                                                            display: 'block',
                                                                            padding: '8px 12px',
                                                                            background: 'white',
                                                                            borderRadius: '6px',
                                                                            border: '1px solid #e8eaff'
                                                                        }}
                                                                    >
                                                                        {ad.qrCode.shortUrl}
                                                                    </a>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                                <div className="company-dashboard-ad-actions">
                                                    <button onClick={() => openModal('approve', ad._id)} className="company-dashboard-btn company-dashboard-btn-approve">✅ אשר מודעה</button>
                                                    <button onClick={() => openModal('reject', ad._id)} className="company-dashboard-btn company-dashboard-btn-reject">❌ דחה מודעה</button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    
                                    {/*Pagination Controls - Always show if there are ads */}
                                    {totalAds > 0 && (
                                        <div className="company-dashboard-pagination">
                                            <button 
                                                className="company-dashboard-pagination-btn company-dashboard-pagination-nav"
                                                onClick={goToPreviousPage}
                                                disabled={currentPage === 1}
                                            >
                                                <span>›</span>
                                                <span>הקודם</span>
                                            </button>
                                            
                                            <div className="company-dashboard-pagination-numbers">
                                                {getPageNumbers().map((page, index) => (
                                                    page === '...' ? (
                                                        <span key={`ellipsis-${index}`} className="company-dashboard-pagination-ellipsis">...</span>
                                                    ) : (
                                                        <button
                                                            key={page}
                                                            className={`company-dashboard-pagination-btn company-dashboard-pagination-number ${currentPage === page ? 'active' : ''}`}
                                                            onClick={() => goToPage(page)}
                                                        >
                                                            {page}
                                                        </button>
                                                    )
                                                ))}
                                            </div>
                                            
                                            <button 
                                                className="company-dashboard-pagination-btn company-dashboard-pagination-nav"
                                                onClick={goToNextPage}
                                                disabled={currentPage === totalPages}
                                            >
                                                <span>הבא</span>
                                                <span>‹</span>
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'proposals' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-section-container">
                            <h2 className="company-dashboard-section-title">
                                <span>💰</span>
                                <span>הצעות מחיר מהסוכנים</span>
                                {proposals.length > 0 && (
                                    <span className="company-dashboard-section-badge">{proposals.length}</span>
                                )}
                            </h2>
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
                                                    <div style={{ fontSize: '14px', marginBottom: '5px', opacity: 0.9 }}>הצעה לסכום כולל</div>
                                                    <div style={{ fontSize: '24px', fontWeight: 'bold' }}>₪{(proposal.originalBudget + proposal.proposedBudget).toLocaleString()}</div>
                                                </div>
                                            </div>
                                            <div style={{ background: 'white', padding: '15px', borderRadius: '10px', borderRight: '4px solid #667eea' }}>
                                                <strong style={{ display: 'block', marginBottom: '8px', color: '#2c3e50' }}>💬 הסבר הסוכן:</strong>
                                                <p style={{ margin: 0, lineHeight: 1.6, color: '#666' }}>{proposal.message || 'אין הסבר'}</p>
                                            </div>
                                            <div style={{ marginTop: '15px', textAlign: 'center', fontSize: '18px', fontWeight: 'bold', color: proposal.proposedBudget > proposal.originalBudget ? '#e74c3c' : '#27ae60' }}>
                                                {proposal.proposedBudget > 0 ? '📈' : '📉'}
                                                {proposal.proposedBudget > 0 ? 'עלייה' : 'הפחתה'} של 
                                                ₪{Math.abs(proposal.proposedBudget).toLocaleString()} ({Math.abs((proposal.proposedBudget / proposal.originalBudget) * 100).toFixed(1)}%)
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
                                    filteredAgents.map(agent => {
                                        // Get social platform info (icon and name)
                                        const getSocialInfo = (platform, handle) => {
                                            if (platform === 'instagram' || handle?.includes('instagram')) {
                                                return { icon: '📸', name: 'Instagram' };
                                            }
                                            if (platform === 'facebook' || handle?.includes('facebook')) {
                                                return { icon: '📘', name: 'Facebook' };
                                            }
                                            if (platform === 'tiktok' || handle?.includes('tiktok')) {
                                                return { icon: '🎵', name: 'TikTok' };
                                            }
                                            if (platform === 'linkedin' || handle?.includes('linkedin')) {
                                                return { icon: '💼', name: 'LinkedIn' };
                                            }
                                            if (platform === 'twitter' || handle?.includes('twitter') || handle?.includes('x.com')) {
                                                return { icon: '🐦', name: 'Twitter/X' };
                                            }
                                            if (handle) {
                                                return { icon: '🔗', name: 'Social' };
                                            }
                                            return null;
                                        };

                                        // Clean username - remove @ and URL prefixes
                                        const cleanUsername = (handle) => {
                                            if (!handle) return '';
                                            return handle
                                                .replace(/^@/, '')
                                                .replace(/instagram\.com\//gi, '')
                                                .replace(/facebook\.com\//gi, '')
                                                .replace(/tiktok\.com\/@?/gi, '')
                                                .replace(/linkedin\.com\/in\//gi, '')
                                                .replace(/twitter\.com\//gi, '')
                                                .replace(/x\.com\//gi, '')
                                                .trim();
                                        };

                                        const socialInfo = getSocialInfo(agent.socialMediaPlatform, agent.socialMediaHandle);
                                        const username = cleanUsername(agent.socialMediaHandle);

                                        return (
                                            <div key={agent._id} className="agent-share-card">
                                                {/* Header with gradient */}
                                                <div className="agent-share-card-header">
                                                    <div className="agent-share-card-avatar">
                                                        {agent.profilePic ? (
                                                            <img
                                                                src={agent.profilePic}
                                                                alt={agent.fullName}
                                                                onError={(e) => {
                                                                    e.target.style.display = 'none';
                                                                    e.target.nextSibling.style.display = 'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div className="avatar-fallback" style={{ display: agent.profilePic ? 'none' : 'flex' }}>
                                                            {agent.fullName?.charAt(0) || '?'}
                                                        </div>
                                                    </div>
                                                    <div className="agent-share-card-rating">
                                                        ⭐ {agent.stats?.averageRating ? agent.stats.averageRating.toFixed(1) : 'חדש'}
                                                    </div>
                                                </div>

                                                {/* Content */}
                                                <div className="agent-share-card-content">
                                                    <h3 className="agent-share-card-name">{agent.fullName}</h3>
                                                    <p className="agent-share-card-specialty">
                                                        {agent.specialty || 'סוכן מפרסם'}
                                                    </p>

                                                    {/* Social Media Handle with Platform Name */}
                                                    {agent.socialMediaHandle && socialInfo && (
                                                        <div className="agent-share-card-social">
                                                            <span className="social-icon">{socialInfo.icon}</span>
                                                            <span className="social-platform-name">{socialInfo.name}:</span>
                                                            <span className="social-username">{username}</span>
                                                        </div>
                                                    )}
                                                    
                                                    {/* Stats Row */}
                                                    <div className="agent-share-card-stats">
                                                        <div className="agent-stat-item">
                                                            <span className="agent-stat-value">{agent.stats?.approvedAds || 0}</span>
                                                            <span className="agent-stat-label">מאושרות</span>
                                                        </div>
                                                        <div className="agent-stat-item">
                                                            <span className="agent-stat-value">{agent.stats?.totalRatings || 0}</span>
                                                            <span className="agent-stat-label">דירוגים</span>
                                                        </div>
                                                        <div className="agent-stat-item">
                                                            <span className="agent-stat-value">{agent.stats?.campaignsCompleted || 0}</span>
                                                            <span className="agent-stat-label">קמפיינים</span>
                                                        </div>
                                                    </div>
                                                    
                                                    {/* Contact Info */}
                                                    <div className="agent-share-card-contact">
                                                        <div className="contact-item">
                                                            <span>📧</span>
                                                            <span className="contact-email">{agent.email}</span>
                                                        </div>
                                                        {agent.phone && (
                                                            <div className="contact-item">
                                                                <span>📞</span>
                                                                <span>{agent.phone}</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                
                                                {/* Action Button */}
                                                <div className="agent-share-card-action">
                                                    <button 
                                                        onClick={() => {
                                                            setActiveTab('campaigns');
                                                            toggleAgentSelection(agent._id);
                                                        }} 
                                                        className="agent-hire-btn"
                                                    >
                                                        ➕ צור קמפיין עם סוכן זה
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'history' && (
                    <div className="company-dashboard-tab-content">
                        <div className="company-dashboard-section-container">
                            {/* Filter out deleted ads from history */}
                            {(() => {
                                const activeHistory = history.filter(ad => !ad.isDeleted && ad.status !== 'deleted');
                                return (
                                    <>
                                        <h2 className="company-dashboard-section-title">
                                            <span>📜</span>
                                            <span>היסטוריית מודעות וקמפיינים</span>
                                            {activeHistory.length > 0 && (
                                                <span className="company-dashboard-section-badge" style={{background: '#95a5a6'}}>{activeHistory.length}</span>
                                            )}
                                        </h2>

                                        {activeHistory.length === 0 ? (
                                            <div className="company-dashboard-empty-state">
                                                <div className="company-dashboard-empty-state-icon">📝</div>
                                                <p>אין היסטוריית מודעות קודמת</p>
                                            </div>
                                        ) : (
                                            <div className="company-dashboard-history-list">
                                                {activeHistory.map(ad => {
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
                                    </>
                                );
                            })()}
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