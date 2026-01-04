import React, { useEffect, useState, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import "./MyAds.css";

const ITEMS_PER_PAGE = 6;

const MyAds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Data state
  const [ads, setAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalAds, setTotalAds] = useState(0);
  
  // UI state
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharingAdId, setSharingAdId] = useState(null);

  // Modal state
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [currentShareAd, setCurrentShareAd] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Fetch ads with pagination from server
  const fetchAds = useCallback(async (page = 1, campaign = "all") => {
    setLoading(true);
    
    try {
      const token = user?.token || localStorage.getItem('token');
      
      if (!token) {
        setError('אנא התחבר מחדש');
        setLoading(false);
        return;
      }
      
      // Build URL with pagination params
      let url = `https://adsmaker.onrender.com/api/pending-ads?page=${page}&limit=${ITEMS_PER_PAGE}`;
      if (campaign !== "all") {
        url += `&campaignId=${campaign}`;
      }
      
      console.log('📡 Fetching page', page);
      
      const res = await fetch(url, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      if (!res.ok) {
        throw new Error(`שגיאה: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('✅ Received:', data);
      
      if (data.success) {
        setAds(data.ads || []);
        setTotalPages(data.totalPages || 1);
        setTotalAds(data.totalAds || data.ads?.length || 0);
        
        // Get campaigns list (only on first load)
        if (data.campaigns) {
          setCampaigns(data.campaigns);
        } else if (campaigns.length === 0 && data.ads?.length > 0) {
          const uniqueCampaigns = [...new Map(
            data.ads.map(ad => [ad.campaignId?._id, ad.campaignId])
          ).values()].filter(Boolean);
          setCampaigns(uniqueCampaigns);
        }
      }
      
      setError('');
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user?.token, campaigns.length]);

  // Initial load
  useEffect(() => {
    fetchAds(1, "all");
  }, []);

  // Handle page change
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      fetchAds(newPage, selectedCampaign);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Handle campaign filter change
  const handleCampaignChange = (campaign) => {
    setSelectedCampaign(campaign);
    setCurrentPage(1);
    fetchAds(1, campaign);
  };

  // Status helper
  const getStatusData = (status) => {
    switch(status) {
      case 'approved': return { class: 'status-approved', text: 'מאושר' };
      case 'rejected': return { class: 'status-rejected', text: 'נדחה' };
      default: return { class: 'status-pending', text: 'ממתין' };
    }
  };

  // Download ad
  const downloadAd = async (adId) => {
    try {
      const token = user?.token || localStorage.getItem('token');
      const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${adId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) throw new Error('שגיאה בהורדת התמונה');
      
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; 
      a.download = `ad-${adId}.png`; 
      a.click();
      window.URL.revokeObjectURL(url);
    } catch(e) { 
      console.error('❌ Download error:', e);
      alert('לא ניתן להוריד פרסומת שטרם אושרה');
    }
  };

  // Share ad
  const shareAd = async (ad) => {
    setSharingAdId(ad._id);
    setCurrentShareAd(ad);
    
    try {
      const shareUrl = `${window.location.origin}/ad/${ad._id}`;
      const shareText = ad.text || ad.title || 'בואו לראות את המבצע שלנו!';
      const shareTitle = ad.title || 'פרסומת חדשה';
      
      if (navigator.share) {
        if (navigator.canShare && ad.imageData) {
          try {
            const response = await fetch(ad.imageData);
            const blob = await response.blob();
            const file = new File([blob], `ad-${ad._id}.png`, { type: 'image/png' });
            
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({ title: shareTitle, text: shareText, url: shareUrl, files: [file] });
            }
          } catch (fileErr) {
            await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
          }
        } else {
          await navigator.share({ title: shareTitle, text: shareText, url: shareUrl });
        }
        
        setTimeout(() => setShowConfirmPopup(true), 1000);
        
      } else {
        const fullText = `${shareTitle}\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullText);
        alert('הקישור והטקסט הועתקו!');
        setTimeout(() => setShowConfirmPopup(true), 1000);
      }
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        try {
          const shareUrl = `${window.location.origin}/ad/${ad._id}`;
          await navigator.clipboard.writeText(shareUrl);
          alert('הקישור הועתק!');
          setTimeout(() => setShowConfirmPopup(true), 1000);
        } catch (clipErr) {
          alert('לא ניתן לשתף כרגע.');
        }
      }
    } finally {
      setSharingAdId(null);
    }
  };

  // Confirm share
  const handleConfirmYes = async () => {
    if (!currentShareAd) return;
    
    setIsProcessing(true);
    setShowConfirmPopup(false);
    
    try {
      const token = user?.token || localStorage.getItem('token');
      const response = await fetch(`https://adsmaker.onrender.com/api/share/confirm-share/${currentShareAd._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ platform: 'native' })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('🎉 תודה! נשלחה הודעה לחברה.');
      } else {
        setBlockReason(data.message);
        setShowBlockedPopup(true);
      }
    } catch (error) {
      alert('שגיאה בעדכון השיתוף');
    } finally {
      setIsProcessing(false);
      setCurrentShareAd(null);
    }
  };

  const handleConfirmNo = () => {
    setShowConfirmPopup(false);
    setCurrentShareAd(null);
  };

  // Render pagination (Google style)
  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisible = 5;
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
    let end = Math.min(totalPages, start + maxVisible - 1);

    if (end - start + 1 < maxVisible) {
      start = Math.max(1, end - maxVisible + 1);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return (
      <div className="pagination">
        <button 
          className="pagination-btn nav-btn"
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="fas fa-chevron-right"></i> הקודם
        </button>
        
        {start > 1 && (
          <>
            <button className="pagination-btn" onClick={() => handlePageChange(1)}>1</button>
            {start > 2 && <span className="pagination-dots">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
            onClick={() => handlePageChange(page)}
          >
            {page}
          </button>
        ))}
        
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="pagination-dots">...</span>}
            <button className="pagination-btn" onClick={() => handlePageChange(totalPages)}>{totalPages}</button>
          </>
        )}
        
        <button 
          className="pagination-btn nav-btn"
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          הבא <i className="fas fa-chevron-left"></i>
        </button>
      </div>
    );
  };

  // Loading state
  if (loading && ads.length === 0) {
    return (
      <div className="my-ads-page">
        <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
          חזרה לדשבורד <i className="fas fa-arrow-left"></i>
        </button>
        <div className="container">
          <h1><i className="fas fa-ad"></i> הפרסומות שלי</h1>
          <div className="loading">
            <div className="spinner"></div>
            <p>טוען פרסומות...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error && ads.length === 0) {
    return (
      <div className="my-ads-page">
        <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
          חזרה לדשבורד <i className="fas fa-arrow-left"></i>
        </button>
        <div className="container">
          <h1><i className="fas fa-ad"></i> הפרסומות שלי</h1>
          <div className="empty-state">
            <i className="fas fa-exclamation-triangle" style={{ color: '#e74c3c' }}></i>
            <p>שגיאה: {error}</p>
            <button className="retry-btn" onClick={() => fetchAds(1, selectedCampaign)}>
              <i className="fas fa-redo"></i> נסה שוב
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-ads-page">
      {/* Modals */}
      {showConfirmPopup && (
        <div className="modal-overlay">
          <div className="modal-content share-modal">
            <i className="fas fa-question-circle modal-icon"></i>
            <h2>האם שיתפת את הפרסומת?</h2>
            <p className="modal-subtitle">אם שיתפת, נשלח הודעה לחברה לתשלום</p>
            <div className="modal-buttons">
              <button className="btn-cancel" onClick={handleConfirmNo}>
                <i className="fas fa-times"></i> לא
              </button>
              <button className="btn-submit" onClick={handleConfirmYes} disabled={isProcessing}>
                {isProcessing ? <><i className="fas fa-spinner fa-spin"></i> שולח...</> : <><i className="fas fa-check"></i> כן, שיתפתי</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedPopup && (
        <div className="modal-overlay">
          <div className="modal-content share-modal">
            <i className="fas fa-exclamation-triangle modal-icon warning"></i>
            <h2>לא ניתן להשלים כרגע</h2>
            <p className="modal-subtitle">{blockReason}</p>
            <button className="btn-submit" onClick={() => setShowBlockedPopup(false)}>הבנתי</button>
          </div>
        </div>
      )}

      <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
        חזרה לדשבורד <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <h1><i className="fas fa-ad"></i> הפרסומות שלי</h1>

        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="campaign-filter">
            <label>סנן לפי קמפיין:</label>
            <select value={selectedCampaign} onChange={(e) => handleCampaignChange(e.target.value)}>
              <option value="all">כל הקמפיינים ({totalAds})</option>
              {campaigns.map(c => (
                <option key={c._id} value={c._id}>{c.title}</option>
              ))}
            </select>
          </div>
          
          <div className="page-info">
            {loading ? 'טוען...' : `עמוד ${currentPage} מתוך ${totalPages} (${totalAds} פרסומות)`}
          </div>
        </div>

        {/* Ads Grid */}
        {loading ? (
          <div className="loading inline">
            <div className="spinner"></div>
          </div>
        ) : ads.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-ad"></i>
            <p>אין פרסומות להצגה</p>
          </div>
        ) : (
          <div className="ads-grid">
            {ads.map((ad) => {
              const statusInfo = getStatusData(ad.status);
              const isApproved = ad.status === 'approved';
              const isSharing = sharingAdId === ad._id;

              return (
                <div key={ad._id} className="ad-card">
                  <div className="ad-image-wrapper">
                    {isApproved ? (
                      ad.imageData ? (
                        <img src={ad.imageData} alt={ad.title} className="ad-image" loading="lazy" />
                      ) : (
                        <div className="ad-image-placeholder">
                          <i className="fas fa-image"></i>
                          <span>אין תמונה</span>
                        </div>
                      )
                    ) : (
                      <div className="ad-image-locked-container">
                        {ad.imageData && <img src={ad.imageData} alt={ad.title} className="ad-image-blurred" loading="lazy" />}
                        <div className="ad-image-locked-overlay">
                          <i className="fas fa-lock"></i>
                          <span>ממתין לאישור</span>
                        </div>
                      </div>
                    )}
                    <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>
                  </div>

                  <div className="ad-content">
                    <h3 className="ad-title">{ad.title || "ללא כותרת"}</h3>
                    <p className="ad-text">{ad.text || "אין טקסט לפרסומת זו..."}</p>
                    
                    <div className="ad-meta">
                      <div className="meta-item">
                        <i className="fas fa-calendar"></i>
                        <span>{new Date(ad.createdAt).toLocaleDateString('he-IL')}</span>
                      </div>
                      <div className="meta-item">
                        <i className="fas fa-bullhorn"></i>
                        <span>{ad.campaignId?.title || 'ללא קמפיין'}</span>
                      </div>
                    </div>

                    <div className="ad-actions">
                      {isApproved ? (
                        <>
                          <button className="btn-share" onClick={() => shareAd(ad)} disabled={isSharing}>
                            {isSharing ? <><i className="fas fa-spinner fa-spin"></i> משתף...</> : <><i className="fas fa-share"></i> שתף</>}
                          </button>
                          <button className="btn-download" onClick={() => downloadAd(ad._id)}>
                            <i className="fas fa-download"></i> הורד
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn-locked" disabled><i className="fas fa-lock"></i> שתף</button>
                          <button className="btn-locked" disabled><i className="fas fa-lock"></i> הורד</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && renderPagination()}
      </div>
    </div>
  );
};

export default MyAds;