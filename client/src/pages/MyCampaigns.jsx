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
                alert('✅ ההצעה שלך נשלחה בהצלחה!');
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
                    <i className="fas fa-arrow-right"></i> חזרה לדשבורד
                </button>

                <h1><i className="fas fa-bullhorn"></i> הקמפיינים שלי</h1>

                {campaigns.length === 0 ? (
                    <div className="empty-state">
                        <h3>עדיין אין קמפיינים</h3>
                    </div>
                ) : (
                    <div className="campaigns-grid">
                        {campaigns.map((campaign) => (
                            <div key={campaign._id} className="campaign-card">
                                <div className="campaign-header">
                                    <div className="campaign-company">{campaign.companyName || 'חברה'}</div>
                                    <div className="campaign-title">{campaign.title}</div>
                                </div>
                                <div className="campaign-content">
                                    <div className="campaign-description">{campaign.description}</div>
                                    
                                    {campaign.budget && (
                                        <div className="campaign-budget" onClick={() => openNegotiateModal(campaign)}>
                                            <i className="fas fa-shekel-sign"></i>
                                            {/* תיקון: שימוש ב-campaign הנוכחי ולא ב-selected */}
                                            <strong>₪{(campaign.budget * 0.1).toLocaleString()}</strong>
                                            <div style={{ fontSize: '12px', marginTop: '5px' }}>💡 לחץ להצעה</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {showModal && selectedCampaign && (
                <div className="modal-overlay" onClick={closeNegotiateModal}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>💰 הצע מחיר משלך</h2>
                        <p>קמפיין: {selectedCampaign.title}</p>
                        
                        <div className="modal-budget-section">
                            <div className="budget-row">
                                <span>החלק המקורי (10%):</span>
                                {/* תיקון: שימוש ב-selectedCampaign */}
                                <strong>₪{(selectedCampaign.budget * 0.1).toLocaleString()}</strong>
                            </div>
                            <div className="budget-input-section">
                                <label>הסכום שאתה מציע:</label>
                                <input 
                                    type="number" 
                                    value={proposedBudget}
                                    onChange={(e) => setProposedBudget(parseFloat(e.target.value))}
                                />
                            </div>
                        </div>
                        
                        <textarea 
                            value={proposalMessage}
                            onChange={(e) => setProposalMessage(e.target.value)}
                            placeholder="הסבר להצעה..."
                        />
                        
                        <div className="modal-buttons">
                            <button onClick={closeNegotiateModal}>ביטול</button>
                            <button className="btn-submit" onClick={submitProposal}>שלח הצעה</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MyCampaigns;