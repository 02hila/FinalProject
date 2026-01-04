import React, { useEffect, useState, useRef, useCallback } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageSelectorModal from "../components/PageSelectorModal";
import "./MyAds.css";

const ITEMS_PER_PAGE = 6; // מספר פרסומות בעמוד

const MyAds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [filteredAds, setFilteredAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [sharingAdId, setSharingAdId] = useState(null);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);

  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [currentShareAd, setCurrentShareAd] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const hasFetched = useRef(false);

  // חישוב פרסומות לפי עמוד נוכחי
  const totalPages = Math.ceil(filteredAds.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentAds = filteredAds.slice(startIndex, endIndex);

  const fetchAds = useCallback(async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    
    try {
      const token = user?.token || localStorage.getItem('token');
      
      if (!token) {
        console.warn('⚠️ No token found');
        setError('אנא התחבר מחדש');
        setLoading(false);
        return;
      }
      
      console.log('📡 Fetching ads...');
      
      const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
      });
      
      if (!res.ok) {
        throw new Error(`שגיאה: ${res.status}`);
      }
      
      const data = await res.json();
      console.log('✅ Received:', data.ads?.length || 0, 'ads');
      
      const adsArray = data.success && Array.isArray(data.ads) ? data.ads : [];
      
      setAds(adsArray);
      setFilteredAds(adsArray);
      
      const uniqueCampaigns = [...new Map(adsArray.map(ad => [ad.campaignId?._id, ad.campaignId])).values()].filter(Boolean);
      setCampaigns(uniqueCampaigns);
      
      setError('');
      
    } catch (err) {
      console.error('❌ Error:', err);
      setError(err.message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, [user?.token]);

  useEffect(() => {
    if (hasFetched.current) return;
    
    const token = user?.token || localStorage.getItem('token');
    if (token) {
      hasFetched.current = true;
      fetchAds(true);
    } else {
      setLoading(false);
      setError('אנא התחבר מחדש');
    }
  }, [fetchAds]);

  // רענון אוטומטי כל 30 שניות
  useEffect(() => {
    const interval = setInterval(() => {
      const token = user?.token || localStorage.getItem('token');
      if (token && hasFetched.current) {
        console.log('🔄 Auto-refresh...');
        fetchAds(false);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [fetchAds]);

  // סינון + איפוס עמוד
  useEffect(() => {
    if (selectedCampaign === "all") {
      setFilteredAds(ads);
    } else {
      setFilteredAds(ads.filter(ad => ad.campaignId?._id === selectedCampaign));
    }
    setCurrentPage(1);
  }, [selectedCampaign, ads]);

  // פונקציות עזר
  const getStatusData = (status) => {
    switch(status) {
      case 'approved': return { class: 'status-approved', text: 'מאושר' };
      case 'rejected': return { class: 'status-rejected', text: 'נדחה' };
      default: return { class: 'status-pending', text: 'ממתין' };
    }
  };

  const downloadAd = async (adId) => {
    try {
      const token = user?.token || localStorage.getItem('token');
      const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${adId}/download`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('שגיאה בהורדת התמונה');
      }
      
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
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl,
                files: [file]
              });
            }
          } catch (fileErr) {
            console.log('File sharing not supported, falling back to text share');
            await navigator.share({
              title: shareTitle,
              text: shareText,
              url: shareUrl
            });
          }
        } else {
          await navigator.share({
            title: shareTitle,
            text: shareText,
            url: shareUrl
          });
        }
        
        setTimeout(() => {
          setShowConfirmPopup(true);
        }, 1000);
        
      } else {
        const fullText = `${shareTitle}\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullText);
        alert('הקישור והטקסט הועתקו! כעת תוכל להדביק בכל מקום.');
        
        setTimeout(() => {
          setShowConfirmPopup(true);
        }, 1000);
      }
      
    } catch (err) {
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        try {
          const shareUrl = `${window.location.origin}/ad/${ad._id}`;
          await navigator.clipboard.writeText(shareUrl);
          alert('הקישור הועתק!');
          setTimeout(() => {
            setShowConfirmPopup(true);
          }, 1000);
        } catch (clipErr) {
          alert('לא ניתן לשתף כרגע. נסה שוב מאוחר יותר.');
        }
      }
    } finally {
      setSharingAdId(null);
    }
  };

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
      console.error('Error confirming share:', error);
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

  // פונקציות ניווט בין עמודים
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const renderPagination = () => {
    if (totalPages <= 1) return null;

    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }

    return (
      <div className="pagination">
        <button 
          className="pagination-btn"
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage === 1}
        >
          <i className="fas fa-chevron-right"></i>
        </button>
        
        {startPage > 1 && (
          <>
            <button className="pagination-btn" onClick={() => goToPage(1)}>1</button>
            {startPage > 2 && <span className="pagination-dots">...</span>}
          </>
        )}
        
        {pages.map(page => (
          <button
            key={page}
            className={`pagination-btn ${currentPage === page ? 'active' : ''}`}
            onClick={() => goToPage(page)}
          >
            {page}
          </button>
        ))}
        
        {endPage < totalPages && (
          <>
            {endPage < totalPages - 1 && <span className="pagination-dots">...</span>}
            <button className="pagination-btn" onClick={() => goToPage(totalPages)}>{totalPages}</button>
          </>
        )}
        
        <button 
          className="pagination-btn"
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage === totalPages}
        >
          <i className="fas fa-chevron-left"></i>
        </button>
      </div>
    );
  };

  // Loading State - כמו בקמפיינים
  if (loading) {
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
  
  // Error State
  if (error) {
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
            <button className="retry-btn" onClick={() => window.location.reload()}>
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
              <button 
                className="btn-submit" 
                onClick={handleConfirmYes}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <><i className="fas fa-spinner fa-spin"></i> שולח...</>
                ) : (
                  <><i className="fas fa-check"></i> כן, שיתפתי</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedPopup && (
        <div className="modal-overlay">
          <div className="modal-content share-modal blocked">
            <i className="fas fa-exclamation-triangle modal-icon warning"></i>
            <h2>לא ניתן להשלים כרגע</h2>
            <p className="modal-subtitle">{blockReason}</p>
            <button className="btn-submit" onClick={() => setShowBlockedPopup(false)}>
              הבנתי
            </button>
          </div>
        </div>
      )}

      <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
        חזרה לדשבורד <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <PageSelectorModal />

        <h1><i className="fas fa-ad"></i> הפרסומות שלי</h1>

        {/* Filter & Info Bar */}
        <div className="filter-bar">
          <div className="campaign-filter">
            <label>סנן לפי קמפיין:</label>
            <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
              <option value="all">כל הקמפיינים ({ads.length})</option>
              {campaigns.map(c => (
                <option key={c._id} value={c._id}>
                  {c.title} ({ads.filter(ad => ad.campaignId?._id === c._id).length})
                </option>
              ))}
            </select>
          </div>
          
          {filteredAds.length > 0 && (
            <div className="page-info">
              מציג {startIndex + 1}-{Math.min(endIndex, filteredAds.length)} מתוך {filteredAds.length} פרסומות
            </div>
          )}
        </div>

        {/* Ads Grid */}
        {currentAds.length === 0 ? (
          <div className="empty-state">
            <i className="fas fa-ad"></i>
            <p>אין פרסומות להצגה</p>
          </div>
        ) : (
          <div className="ads-grid">
            {currentAds.map((ad) => {
              const statusInfo = getStatusData(ad.status);
              const isApproved = ad.status === 'approved';
              const isSharing = sharingAdId === ad._id;

              return (
                <div key={ad._id} className="ad-card">
                  {/* Image Section */}
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

                  {/* Content Section */}
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

                    {/* Actions */}
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
        {renderPagination()}
      </div>
    </div>
  );
};

export default MyAds;