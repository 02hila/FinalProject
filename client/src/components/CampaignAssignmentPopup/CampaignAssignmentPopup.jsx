/**
 * CampaignAssignmentPopup.jsx
 *
 * A celebratory overlay popup displayed to agents when they are newly assigned
 * to a campaign by a company. It shows the campaign title, company name,
 * description, budget, and target audience (when available), along with action
 * buttons to either dismiss or navigate to the campaigns page. The popup is
 * designed to appear only once per assignment.
 *
 * Props:
 *  - campaign       (Object)   The campaign object containing title, description,
 *                               companyId (populated), budget, and targetAudience.
 *  - onClose        (Function) Callback invoked when the user dismisses the popup.
 *  - onViewCampaign (Function) Callback to navigate the user to the campaigns page.
 *
 * Used by: AgentDashboard, triggered after polling detects a new campaign assignment.
 */
import React from 'react';
import './CampaignAssignmentPopup.css';

/**
 * Renders an overlay popup notifying the agent about a new campaign assignment.
 *
 * @param {Object}   props
 * @param {Object}   props.campaign       - The assigned campaign data.
 * @param {Function} props.onClose        - Handler to dismiss the popup.
 * @param {Function} props.onViewCampaign - Handler to navigate to the campaigns view.
 * @returns {React.ReactElement|null} Returns null when no campaign is provided.
 */
const CampaignAssignmentPopup = ({ campaign, onClose, onViewCampaign }) => {
    if (!campaign) return null;

    // Resolve the company display name from the populated companyId reference.
    const companyName = campaign.companyId?.companyName || campaign.companyId?.fullName || 'חברה';

    return (
        <div className="campaign-popup-overlay" onClick={onClose}>
            <div className="campaign-popup-container" onClick={(e) => e.stopPropagation()}>
                {/* Confetti decoration */}
                <div className="campaign-popup-confetti">
                    <span>🎉</span>
                    <span>🎊</span>
                    <span>✨</span>
                </div>

                {/* Header */}
                <div className="campaign-popup-header">
                    <div className="campaign-popup-icon">🚀</div>
                    <h2 className="campaign-popup-title">מזל טוב!</h2>
                    <p className="campaign-popup-subtitle">נבחרת לקמפיין חדש!</p>
                </div>

                {/* Content */}
                <div className="campaign-popup-content">
                    <div className="campaign-popup-company">
                        <span className="campaign-popup-label">החברה:</span>
                        <span className="campaign-popup-value">{companyName}</span>
                    </div>

                    <div className="campaign-popup-campaign-name">
                        <span className="campaign-popup-label">שם הקמפיין:</span>
                        <span className="campaign-popup-value">{campaign.title}</span>
                    </div>

                    {campaign.description && (
                        <div className="campaign-popup-description">
                            <span className="campaign-popup-label">תיאור:</span>
                            <p className="campaign-popup-text">{campaign.description}</p>
                        </div>
                    )}

                    {campaign.budget > 0 && (
                        <div className="campaign-popup-budget">
                            <span className="campaign-popup-label">תקציב:</span>
                            <span className="campaign-popup-value campaign-popup-budget-value">
                                ₪{campaign.budget.toLocaleString()}
                            </span>
                        </div>
                    )}

                    {campaign.targetAudience && (
                        <div className="campaign-popup-target">
                            <span className="campaign-popup-label">קהל יעד:</span>
                            <span className="campaign-popup-value">{campaign.targetAudience}</span>
                        </div>
                    )}
                </div>

                {/* Message */}
                <div className="campaign-popup-message">
                    <p>עכשיו אתה יכול ליצור מודעות עבור הקמפיין הזה באמצעות מחולל המודעות!</p>
                </div>

                {/* Actions */}
                <div className="campaign-popup-actions">
                    <button
                        className="campaign-popup-btn campaign-popup-btn-secondary"
                        onClick={onClose}
                    >
                        הבנתי
                    </button>
                    <button
                        className="campaign-popup-btn campaign-popup-btn-primary"
                        onClick={onViewCampaign}
                    >
                        צפה בקמפיינים שלי
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CampaignAssignmentPopup;
