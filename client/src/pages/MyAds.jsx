import React, { useEffect, useState, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageSelectorModal from "../components/PageSelectorModal";
import "./MyAds.css";

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
  

  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [currentShareAd, setCurrentShareAd] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);

  
  const hasFetched = useRef(false);

  
  const fetchAds = async (showLoader = false) => {
    if (showLoader) {
      setLoading(true);
    }
    
    try {
      //  קבל token
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
  };

  
  useEffect(() => {
    if (hasFetched.current) return; //  אם כבר טענו - עצור!
    
    const token = user?.token || localStorage.getItem('token');
    if (token) {
      hasFetched.current = true; //  סמן שטענו
      fetchAds(true);
    } else {
      setLoading(false);
      setError('אנא התחבר מחדש');
    }
  }, []); 

  //  רענון אוטומטי כל 30 שניות
  useEffect(() => {
    const interval = setInterval(() => {
      const token = user?.token || localStorage.getItem('token');
      if (token && hasFetched.current) {
        console.log('🔄 Auto-refresh...');
        fetchAds(false);
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, []); 

  //  סינון
  useEffect(() => {
    if (selectedCampaign === "all") {
      setFilteredAds(ads);
    } else {
      setFilteredAds(ads.filter(ad => ad.campaignId?._id === selectedCampaign));
    }
  }, [selectedCampaign, ads]);

  // ---- פונקציות עזר ----
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
      alert('לא ניתן להוריד מודעה שטרם אושרה');
    }
  };

  const shareAd = async (ad) => {
    setSharingAdId(ad._id);
    setCurrentShareAd(ad);
    
    try {
      const shareUrl = `${window.location.origin}/ad/${ad._id}`;
      const shareText = ad.text || ad.title || 'בואו לראות את המבצע שלנו!';
      const shareTitle = ad.title || 'מודעה חדשה';
      
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

  if (loading) {
    return (
      <div className="my-ads-page">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <div className="loading-text">טוען מודעות...</div>
          <div className="loading-subtext">
            זה יכול לקחת כמה שניות אם השרת התעורר מחדש 🌙
          </div>
        </div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="my-ads-page">
        <div className="container">
          <p style={{ color: '#dc3545', textAlign: 'center', padding: '40px' }}>
            <i className="fas fa-exclamation-triangle"></i> שגיאה: {error}
          </p>
          <button onClick={() => window.location.reload()} style={{ margin: '0 auto', display: 'block' }}>
            נסה שוב
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="my-ads-page">
      {showConfirmPopup && (
        <div className="share-confirm-overlay">
          <div className="share-confirm-modal">
            <i className="fas fa-question-circle"></i>
            <h4>האם שיתפת את הפרסומת?</h4>
            <p>אם שיתפת, נשלח הודעה לחברה לתשלום</p>
            <div className="confirm-buttons">
              <button 
                className="confirm-yes" 
                onClick={handleConfirmYes}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <><i className="fas fa-spinner fa-spin"></i> שולח...</>
                ) : (
                  <><i className="fas fa-check"></i> כן, שיתפתי</>
                )}
              </button>
              <button className="confirm-no" onClick={handleConfirmNo}>
                <i className="fas fa-times"></i> לא
              </button>
            </div>
          </div>
        </div>
      )}

      {showBlockedPopup && (
        <div className="share-confirm-overlay">
          <div className="share-confirm-modal blocked">
            <i className="fas fa-exclamation-triangle"></i>
            <h4>לא ניתן להשלים כרגע</h4>
            <p>{blockReason}</p>
            <button onClick={() => setShowBlockedPopup(false)}>הבנתי</button>
          </div>
        </div>
      )}

      <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
        חזרה לדשבורד <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <PageSelectorModal />

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

        <div className="ads-grid">
          {filteredAds.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888' }}>
              אין מודעות להצגה
            </p>
          ) : (
            filteredAds.map((ad) => {
              const statusInfo = getStatusData(ad.status);
              const isApproved = ad.status === 'approved';
              const isSharing = sharingAdId === ad._id;

              return (
                <div key={ad._id} className="myads-item">
                  
                  <div className="ad-image-wrapper">
                    {isApproved ? (
                      ad.imageData ? (
                        <a href={`/ad/${ad._id}`} target="_blank" rel="noopener noreferrer">
                          <img src={ad.imageData} alt={ad.title} className="ad-image" loading="lazy" />
                        </a>
                      ) : (
                        <div className="ad-image-locked">
                          <i className="fas fa-image"></i>
                          <div>אין תמונה</div>
                        </div>
                      )
                    ) : (
                      <div className="ad-image-locked-container">
                        {ad.imageData && <img src={ad.imageData} alt={ad.title} className="ad-image-blurred" loading="lazy" />}
                        <div className="ad-image-locked-overlay">
                          <i className="fas fa-lock"></i>
                          <div>המודעה ממתינה לאישור</div>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ad-content">
                    <h3 className="ad-title">{ad.title || "ללא כותרת"}</h3>
                    <p className="ad-text">{ad.text || "אין טקסט למודעה זו..."}</p>
                    
                    <div className="ad-meta-row">
                      <span className={`status-badge ${statusInfo.class}`}>{statusInfo.text}</span>
                      <span>{new Date(ad.createdAt).toLocaleDateString('he-IL')}</span>
                      <span>{ad.campaignId?.title || 'ללא קמפיין'}</span>
                    </div>

                    <div className="ad-actions">
                      {isApproved ? (
                        <>
                          <button className="btn btn-share" onClick={() => shareAd(ad)} disabled={isSharing}>
                            {isSharing ? <><i className="fas fa-spinner fa-spin"></i> משתף...</> : <><i className="fas fa-share"></i> שתף</>}
                          </button>
                          <button className="btn btn-download" onClick={() => downloadAd(ad._id)}>
                            <i className="fas fa-download"></i> הורד
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-locked" disabled><i className="fas fa-lock"></i> שתף</button>
                          <button className="btn btn-locked" disabled><i className="fas fa-lock"></i> הורד</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default MyAds;