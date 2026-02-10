/**
 * MyCampaigns Component
 *
 * This component displays the agent's assigned advertising campaigns.
 * It provides a comprehensive interface for viewing campaign details, managing price negotiations,
 * and tracking campaign progress and deadlines.
 *
 * Key Features:
 * - Displays all campaigns assigned to the authenticated agent
 * - Shows campaign details: company, description, target audience, budget, deadlines
 * - Price negotiation system allowing agents to propose custom fees
 * - Real-time display of approved proposals and negotiated rates
 * - Campaign filtering and status tracking
 * - Interactive budget display with negotiation modal
 *
 * The component handles complex price negotiation logic where agents can propose
 * fees above the standard 10% commission, with approval workflow through companies.
 * All UI text is maintained in Hebrew to preserve site functionality for Hebrew-speaking users.
 *
 * @component
 * @returns {JSX.Element} The agent's campaigns page
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyCampaigns.css';

const MyCampaigns = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [loadingProposals, setLoadingProposals] = useState(true);
    const [approvedProposals, setApprovedProposals] = useState({}); 
    const [currentAgentId, setCurrentAgentId] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [proposedBudget, setProposedBudget] = useState(0);
    const [proposalMessage, setProposalMessage] = useState('');

    const API_URL = 'https://adsmaker.onrender.com/api';
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (!token) {
            alert('נדרש להתחבר תחילה');
            navigate('/login');
            return;
        }
        loadMyCampaigns();
    }, []);

    useEffect(() => {
        if (campaigns.length > 0 && currentAgentId) {
            loadApprovedProposals();
        }
        // eslint-disable-next-line
    }, [campaigns, currentAgentId]);

    // Poll for approved proposals and campaigns updates every 30 seconds
    useEffect(() => {
        if (!campaigns.length || !currentAgentId) return;

        const updateInterval = setInterval(() => {
            loadApprovedProposals();
            reloadCampaigns();
        }, 30000); // Check every 30 seconds for updates

        return () => clearInterval(updateInterval);
    }, [campaigns, currentAgentId]);
    const loadApprovedProposals = async () => {
    setLoadingProposals(true); 
    try {
        const results = {};
        for (const campaign of campaigns) {
            const res = await fetch(`${API_URL}/price-proposals?campaignId=${campaign._id}&agentId=${currentAgentId}&status=approved`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (data.success && data.proposals && data.proposals.length > 0) {
                    results[campaign._id] = data.proposals[0];
                }
            }
        }
        setApprovedProposals(results);
    } catch (err) {
        console.error('שגיאה בשליפת הצעות מאושרות:', err);
    } finally {
        setLoadingProposals(false);
    }
};
    const loadMyCampaigns = async () => {
        try {
            const userResponse = await fetch(`${API_URL}/auth/me`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!userResponse.ok) throw new Error('Failed to load user data');
            const userData = await userResponse.json();
            if (!userData.success) throw new Error('Failed to load user data');
            const agentId = userData.user._id || userData.user.id;
            setCurrentAgentId(agentId);

            const response = await fetch(`${API_URL}/campaigns/agent/${agentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if (data.success) {
                setCampaigns(data.campaigns || []);
            }
        } catch (error) {
            console.error('❌ Error loading campaigns:', error);
            alert('שגיאה בטעינת הקמפיינים: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const reloadCampaigns = async () => {
        if (!currentAgentId) return;
        try {
            const response = await fetch(`${API_URL}/campaigns/agent/${currentAgentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                if (data.success) {
                    setCampaigns(data.campaigns || []);
                }
            }
        } catch (error) {
            console.error('❌ Error reloading campaigns:', error);
        }
    };

  const openNegotiateModal = (campaign) => {
    setSelectedCampaign(campaign);
    // אם יש הצעה מאושרת - הצג את הסכום שאושר, אחרת הסכום הבסיסי
    const baseFee = Math.round(campaign.budget * 0.7);
    const approved = approvedProposals[campaign._id];
    if (approved?.status === 'approved') {
        setProposedBudget(baseFee + approved.proposedBudget);
    } else {
        setProposedBudget(baseFee);
    }
    setProposalMessage('');
    setShowModal(true);
};

    const closeNegotiateModal = () => {
        setShowModal(false);
        setSelectedCampaign(null);
        setProposedBudget(0);
        setProposalMessage('');
    };

    const submitProposal = async () => {
        if (isNaN(proposedBudget) || proposedBudget <= 0) {
            alert('❌ אנא הזן סכום תקין');
            return;
        }

        if (!proposalMessage.trim()) {
            alert('❌ אנא הסבר למה אתה מבקש סכום זה');
            return;
        }

        const baseFee = Math.round(selectedCampaign.budget * 0.7);
        const currentAmount = approvedProposals[selectedCampaign._id]?.status === 'approved'
            ? (baseFee + approvedProposals[selectedCampaign._id].proposedBudget)
            : baseFee;

        if (proposedBudget === currentAmount) {
            alert('הסכום הוא אותו סכום כמו התקציב אין צורך לשלוח בקשה לשינוי');
            return;
        }
        const diff = proposedBudget - baseFee;
        console.log('🔍 Base fee:', baseFee);
        console.log('🔍 Proposed (what agent entered):', proposedBudget);
        console.log('🔍 Diff (what will be sent):', diff);
        try {
            const response = await fetch(`${API_URL}/price-proposals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            body: JSON.stringify({
    campaignId: selectedCampaign._id,
    agentId: currentAgentId,
    proposedBudget: diff,
    message: proposalMessage
})
            });

            const data = await response.json();

            if (data.success) {
                closeNegotiateModal();
                alert('✅ ההצעה שלך נשלחה בהצלחה! החברה תקבל את ההצעה ותשיב לך בהקדם.');
            } else {
                alert('❌ שגיאה: ' + (data.error || 'לא ניתן לשלוח את ההצעה'));
            }
        } catch (error) {
            console.error('❌ Error:', error);
            alert('❌ שגיאה בשליחת ההצעה: ' + error.message);
        }
    };

    if (loading) {
        return (
            <div className="loading">
                <div className="spinner"></div>
                <p>טוען נתונים...</p>
            </div>
        );
    }

    return (
        <div className="campaigns-page">
            <div className="container">
                <button className="back-button" onClick={() => navigate('/agent-dashboard')}>
                    <i className="fas fa-arrow-right"></i>
                    חזרה לדשבורד
                </button>

                <h1>
                    <i className="fas fa-bullhorn"></i> הקמפיינים שלי
                </h1>

                {campaigns.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-bullhorn"></i>
                        <h3>עדיין אין קמפיינים</h3>
                        <p>הקמפיינים שלך יופיעו כאן</p>
                    </div>
                ) : (
                    <div className="campaigns-grid">
                        {campaigns.map((campaign) => (
                            <div key={campaign._id} className="campaign-card">
                                <div className="campaign-header">
                                    <div className="campaign-company">
                                        <i className="fas fa-building"></i>
                                        {campaign.companyName || 'לא צוין שם חברה'}
                                    </div>
                                    <div className="campaign-title">{campaign.title}</div>
                                </div>
                                <div className="campaign-content">
                                    <div className="campaign-description">
                                        {campaign.description || 'אין תיאור זמין'}
                                    </div>

                                    <div className="campaign-meta">
                                        <div className="meta-item">
                                            <i className="fas fa-users"></i>
                                            <strong>קהל יעד:</strong>
                                            <span>{campaign.targetAudience || 'לא צוין'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <i className="fas fa-shekel-sign"></i>
                                            <strong>תקציב הקמפיין:</strong>
                                            <span>₪{campaign.budget?.toLocaleString() || 'לא צוין'}</span>
                                        </div>
                                        <div className="meta-item">
                                            <i className="fas fa-calendar"></i>
                                            <strong>תאריך יצירה:</strong>
                                            <span>{new Date(campaign.createdAt).toLocaleDateString('he-IL')}</span>
                                        </div>
                                        {campaign.deadline && (
                                            <div className="meta-item">
                                                <i className="fas fa-clock"></i>
                                                <strong>מועד אחרון:</strong>
                                                <span>{new Date(campaign.deadline).toLocaleDateString('he-IL')}</span>
                                            </div>
                                        )}
                                    </div>

                                    <div
                                        className="campaign-budget"
                                        onClick={() => openNegotiateModal(campaign)}
                                    >
                                        <i className="fas fa-shekel-sign"></i>
                                       <strong>
    ₪{
        (() => {
            const baseFee = Math.round(campaign.budget * 0.7);
            return loadingProposals ? '...' :
            approvedProposals[campaign._id]?.status === 'approved'
                ? (baseFee + approvedProposals[campaign._id].proposedBudget).toLocaleString()
                : baseFee.toLocaleString();
        })()
    }
</strong>
                                        <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
                                            {approvedProposals[campaign._id]?.proposedBudget && approvedProposals[campaign._id].status === 'approved'
                                                ? 'הסכום שלך'
                                                : 'הסכום שלך'}
                                            <br />💡 לחץ כדי להציע מחיר
                                        </div>
                                    </div>
                                    
                                    {campaign.tags && campaign.tags.length > 0 && (
                                        <div className="campaign-tags">
                                            {campaign.tags.map((tag, index) => (
                                                <span key={index} className="tag">{tag}</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Negotiation Modal */}
            {showModal && selectedCampaign && (
                <div className="modal-overlay" onClick={closeNegotiateModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>💰 הצע מחיר משלך</h2>
                        <p className="modal-subtitle">קמפיין: {selectedCampaign.title}</p>
                        
                        <div className="modal-budget-section">
      <div className="budget-row">
    <span>{approvedProposals[selectedCampaign._id]?.status === 'approved' ? 'הסכום הנוכחי שלך:' : 'הסכום הבסיסי שלך:'}</span>
    <span>₪{
        (() => {
            const baseFee = Math.round(selectedCampaign.budget * 0.7);
            return approvedProposals[selectedCampaign._id]?.status === 'approved'
                ? (baseFee + approvedProposals[selectedCampaign._id].proposedBudget).toLocaleString()
                : baseFee.toLocaleString();
        })()
    }</span>
</div>
                            <div className="budget-input-section">
                                <label>הסכום שאתה מציע לעצמך (העמלה שלך):</label>
                                <input 
                                    type="number" 
                                    value={proposedBudget}
                                    onChange={(e) => setProposedBudget(parseFloat(e.target.value))}
                                    min="0"
                                />
                            </div>
                        </div>
                        
                        <div className="modal-message-section">
                            <label>הודעה לחברה (למה אתה מבקש סכום זה?):</label>
                            <textarea 
                                rows="4" 
                                value={proposalMessage}
                                onChange={(e) => setProposalMessage(e.target.value)}
                                placeholder="למשל: 'אני מבקש יותר בגלל הניסיון שלי...' או 'אני מציע פחות כי...'"
                            />
                        </div>
                        
                        <div className="modal-buttons">
                            <button className="btn-cancel" onClick={closeNegotiateModal}>
                                ביטול
                            </button>
                            <button className="btn-submit" onClick={submitProposal}>
                                📤 שלח הצעה
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyCampaigns;