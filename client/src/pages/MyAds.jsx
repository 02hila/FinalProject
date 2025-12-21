import React, { useEffect, useState } from "react";
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
  const [sharingAdId, setSharingAdId] = useState(null); // למעקב איזה פרסומת בתהליך שיתוף

  // ---- שליפת נתונים ----
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        
        if (!res.ok) {
          throw new Error(`שגיאה: ${res.status}`);
        }
        
        const data = await res.json();
        const adsArray = data.success && Array.isArray(data.ads) ? data.ads : [];
        
        setAds(adsArray);
        setFilteredAds(adsArray);
        
        const uniqueCampaigns = [...new Map(adsArray.map(ad => [ad.campaignId?._id, ad.campaignId])).values()].filter(Boolean);
        setCampaigns(uniqueCampaigns);
        
      } catch (err) {
        console.error('❌ Error:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    if (user?.token) {
      fetchAds();
    } else {
      setLoading(false);
    }
  }, [user]);

  // ✅ רענון אוטומטי כל 30 שניות
  useEffect(() => {
    const interval = setInterval(async () => {
      if (user?.token) {
        try {
          const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads`, {
            headers: { Authorization: `Bearer ${user?.token}` },
          });
          
          if (res.ok) {
            const data = await res.json();
            const adsArray = data.success && Array.isArray(data.ads) ? data.ads : [];
            setAds(adsArray);
          }
        } catch (err) {
          console.error('Auto-refresh error:', err);
        }
      }
    }, 30000);
    
    return () => clearInterval(interval);
  }, [user?.token]);

  // ---- סינון ----
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
      const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${adId}/download`, {
        headers: { Authorization: `Bearer ${user?.token}` }
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

  // ✅ תיעוד שיתוף בשרת
  const recordShare = async (adId, platform) => {
    try {
      await fetch(`https://adsmaker.onrender.com/api/ads/share/${adId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${user?.token}`
        },
        body: JSON.stringify({ platform })
      });
      console.log(`✅ Share recorded: ${platform}`);
    } catch (error) {
      console.error('❌ Error recording share:', error);
    }
  };

  // ✅ שיתוף נייטיב - עובד על כל הטלפונים (iOS + Android)
  const shareAd = async (ad) => {
    setSharingAdId(ad._id); // מציג אינדיקציה של טעינה
    
    try {
      const shareUrl = `${window.location.origin}/ad/${ad._id}`;
      const shareText = ad.text || ad.title || 'בואו לראות את המבצע שלנו!';
      const shareTitle = ad.title || 'מודעה חדשה';
      
      // בדיקה אם Web Share API זמין (כל הטלפונים המודרניים)
      if (navigator.share) {
        
        // ניסיון לשתף עם תמונה (אם נתמך)
        if (navigator.canShare && ad.imageData) {
          try {
            // המרת base64 לקובץ
            const response = await fetch(ad.imageData);
            const blob = await response.blob();
            const file = new File([blob], `ad-${ad._id}.png`, { type: 'image/png' });
            
            // בדיקה אם אפשר לשתף קבצים
            if (navigator.canShare({ files: [file] })) {
              await navigator.share({
                title: shareTitle,
                text: shareText,
                url: shareUrl,
                files: [file]
              });
              
              // תיעוד השיתוף
              await recordShare(ad._id, 'native_with_image');
              setSharingAdId(null);
              return;
            }
          } catch (fileErr) {
            console.log('File sharing not supported, falling back to text share');
          }
        }
        
        // שיתוף בלי תמונה (תמיד עובד)
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        
        // תיעוד השיתוף
        await recordShare(ad._id, 'native');
        
      } else {
        // Fallback למחשבים - העתקה ללוח
        const fullText = `${shareTitle}\n${shareText}\n\n${shareUrl}`;
        await navigator.clipboard.writeText(fullText);
        alert('הקישור והטקסט הועתקו! כעת תוכל להדביק בכל מקום.');
        await recordShare(ad._id, 'clipboard');
      }
      
    } catch (err) {
      // המשתמש ביטל את השיתוף - זה בסדר
      if (err.name !== 'AbortError') {
        console.error('Share error:', err);
        
        // Fallback - העתקה ללוח
        try {
          const shareUrl = `${window.location.origin}/ad/${ad._id}`;
          await navigator.clipboard.writeText(shareUrl);
          alert('הקישור הועתק!');
          await recordShare(ad._id, 'clipboard_fallback');
        } catch (clipErr) {
          alert('לא ניתן לשתף כרגע. נסה שוב מאוחר יותר.');
        }
      }
    } finally {
      setSharingAdId(null);
    }
  };

  if (loading) return <div className="my-ads-page"><p>טוען...</p></div>;
  if (error) return <div className="my-ads-page"><p>שגיאה: {error}</p></div>;

  return (
    <div className="my-ads-page">
      {/* כפתור חזרה */}
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
                  
                  {/* 1. אזור התמונה (למעלה) */}
                  <div className="ad-image-wrapper">
                    {isApproved ? (
                      ad.imageData ? (
                        <a
                          href={`/ad/${ad._id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          title="לחץ לפרטים נוספים"
                        >
                          <img
                            src={ad.imageData}
                            alt={ad.title}
                            className="ad-image"
                            loading="lazy"
                            style={{ cursor: 'pointer' }}
                          />
                        </a>
                      ) : (
                        <div className="ad-image-locked">
                          <i className="fas fa-image"></i>
                          <div style={{fontWeight: 'bold', fontSize: '14px'}}>אין תמונה</div>
                        </div>
                      )
                    ) : (
                      <div className="ad-image-locked-container">
                        {ad.imageData && (
                          <img
                            src={ad.imageData}
                            alt={ad.title}
                            className="ad-image-blurred"
                            loading="lazy"
                          />
                        )}
                        <div className="ad-image-locked-overlay">
                          <i className="fas fa-lock" style={{ fontSize: '48px', color: 'white', marginBottom: '10px' }}></i>
                          <div style={{ fontWeight: 'bold', fontSize: '16px', color: 'white', textAlign: 'center' }}>
                            המודעה ממתינה לאישור
                          </div>
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.9)', marginTop: '5px', textAlign: 'center' }}>
                            {ad.status === 'rejected' ? 'המודעה נדחתה' : 'תוכל לשתף ולהוריד לאחר אישור החברה'}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 2. אזור התוכן הלבן (למטה) */}
                  <div className="ad-content">
                    <h3 className="ad-title">{ad.title || "ללא כותרת"}</h3>
                    <p className="ad-text">{ad.text || "אין טקסט למודעה זו..."}</p>
                    
                    <div className="ad-meta-row">
                      <span className={`status-badge ${statusInfo.class}`}>
                        {statusInfo.text}
                        {isApproved && <i className="fas fa-check" style={{marginRight:'4px'}}></i>}
                      </span>
                      <span>{new Date(ad.createdAt).toLocaleDateString('he-IL')}</span>
                      <span>{ad.campaignId?.title || 'ללא קמפיין'}</span>
                    </div>

                    <div className="ad-actions">
                      {isApproved ? (
                        <>
                          <button 
                            className="btn btn-share" 
                            onClick={() => shareAd(ad)}
                            disabled={isSharing}
                          >
                            {isSharing ? (
                              <>
                                <i className="fas fa-spinner fa-spin"></i> משתף...
                              </>
                            ) : (
                              <>
                                <i className="fas fa-share"></i> שתף
                              </>
                            )}
                          </button>
                          <button className="btn btn-download" onClick={() => downloadAd(ad._id)}>
                            <i className="fas fa-download"></i> הורד
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-locked" disabled>
                            <i className="fas fa-lock" style={{marginLeft: '5px'}}></i> שתף
                          </button>
                          <button className="btn btn-locked" disabled>
                            <i className="fas fa-lock" style={{marginLeft: '5px'}}></i> הורד
                          </button>
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