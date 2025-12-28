import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyCampaigns.css';

const MyCampaigns = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const openNegotiateModal = (campaign) => {
        setSelectedCampaign(campaign);
        setProposedBudget(campaign.budget * 0.1);
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
        
        if (proposedBudget === selectedCampaign.budget) {
            alert('ℹ️ הסכום זהה למחיר המקורי. אם אתה מסכים, אין צורך לשלוח הצעה.');
            return;
        }
        
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
                    proposedBudget: proposedBudget,
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
                <p>טוען קמפיינים...</p>
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

                                    {campaign.budget && (
                                        <div 
                                            className="campaign-budget"
                                            onClick={() => openNegotiateModal(campaign)}
                                        >
                                            <i className="fas fa-shekel-sign"></i>
<strong>₪{(selectedCampaign.budget * 0.1).toLocaleString()}</strong>                                            <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.9 }}>
                                                💡 לחץ כדי להציע מחיר
                                            </div>
                                        </div>
                                    )}
                                    
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
                                <span>החלק שלך (10%):</span>
                                <strong>₪{(selectedCampaign.budget * 0.1).toLocaleString()}</strong>
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