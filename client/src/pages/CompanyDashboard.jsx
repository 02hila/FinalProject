import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom'; // ✅ FIX: removed Link
import SharedHeader from '../components/SharedHeader';
import './CompanyDashboard.css';
import {
    getPendingAds,
    getAgents,
    getHistory,
    getPriceProposals,
    createCampaign as apiCreateCampaign,
    approveAd as apiApproveAd,
    rejectAd as apiRejectAd, // ✅ FIX: now used
    approveProposal,
    rejectProposal
} from '../services/companyService';

const CompanyDashboard = () => {
    const { user, loading, handleLogout, loadUserFromToken } = useAuth();
    const navigate = useNavigate();
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
    const [rejectDetails, setRejectDetails] = useState('');

    /* ---------- Reject Ad ---------- */
    const handleRejectAd = async (selectedReasons) => {
        if (!selectedReasons || selectedReasons.length === 0) {
            alert('לא נבחרו רכיבים');
            return;
        }

        if (!rejectDetails) {
            alert('אנא הוסף הסבר');
            return;
        }

        try {
            const data = await apiRejectAd({
                adId: modal.adId,
                rejectionReasons: selectedReasons,
                rejectionDetails: rejectDetails,
                companyId: user._id
            });

            if (data.success) {
                setModal({ type: null, adId: null });
                setRejectDetails('');
                alert('✅ הפרסומת נדחתה ונשלחה גרסה משופרת');
                refetchData();
            } else {
                alert('❌ שגיאה בדחייה');
                setModal({ type: null, adId: null });
            }
        } catch (err) {
            console.error(err);
            alert('❌ שגיאה בדחייה');
            setModal({ type: null, adId: null });
        }
    };

    /* ---------- MODALS ---------- */
    const openModal = (type, adId) => {
        setModal({ type, adId });
        setRating(0);
    };

    if (!user) return null;

    return (
        <div className="company-dashboard-body">

            {modal.type === 'approve' && (
                <ApproveModal
                    setModal={setModal}
                    handleApproveAd={handleApproveAd}
                    rating={rating}
                    setRating={setRating}
                    approveComment={approveComment}
                    setApproveComment={setApproveComment}
                />
            )}

            {modal.type === 'reject' && (
                <RejectModal
                    setModal={setModal}
                    handleRejectAd={handleRejectAd}
                    rejectDetails={rejectDetails}
                    setRejectDetails={setRejectDetails}
                />
            )}

            <SharedHeader
                userType="company"
                userName={user?.companyName || user?.fullName || 'חברה'}
                onLogout={handleLogout}
            />

            {/* --- שאר הקובץ נשאר ללא שינוי --- */}
        </div>
    );
};

/* ---------- Reject Modal ---------- */
const RejectModal = ({ setModal, handleRejectAd, rejectDetails, setRejectDetails }) => {
    const [selectedReasons, setSelectedReasons] = useState([]);

    const reasons = [
        { id: 'title', label: '📝 כותרת', description: 'הכותרת לא מתאימה' },
        { id: 'text', label: '💬 טקסט', description: 'נדרש שיפור בניסוח' },
        { id: 'image', label: '🖼️ תמונה', description: 'התמונה לא מתאימה' }
    ];

    const toggleReason = (id) => {
        setSelectedReasons(prev =>
            prev.includes(id) ? prev.filter(r => r !== id) : [...prev, id]
        );
    };

    return (
        <div className="company-dashboard-modal">
            <div className="company-dashboard-modal-content">
                <h3>❌ דחיית פרסומת</h3>

                {reasons.map(r => (
                    <div
                        key={r.id}
                        onClick={() => toggleReason(r.id)}
                        style={{
                            border: selectedReasons.includes(r.id) ? '2px solid #667eea' : '2px solid #ccc',
                            padding: '12px',
                            borderRadius: '10px',
                            marginBottom: '10px',
                            cursor: 'pointer'
                        }}
                    >
                        <strong>{r.label}</strong>
                        <p style={{ margin: 0 }}>{r.description}</p>
                    </div>
                ))}

                <textarea
                    value={rejectDetails}
                    onChange={e => setRejectDetails(e.target.value)}
                    placeholder="הסבר מפורט"
                    rows={4}
                    className="company-dashboard-form-input"
                />

                <div className="company-dashboard-modal-actions">
                    <button onClick={() => setModal({ type: null, adId: null })}>ביטול</button>
                    <button onClick={() => handleRejectAd(selectedReasons)}>
                        דחה ויצור גרסה חדשה
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CompanyDashboard;
