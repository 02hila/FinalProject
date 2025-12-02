import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageSelectorModal from "../components/PageSelectorModal";
import ShareModal from "../components/Sharemodal";
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
  
  // State למודאל שיתוף
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedAdForShare, setSelectedAdForShare] = useState(null);

  // ---- שליפת נתונים ----
  useEffect(() => {
    const fetchAds = async () => {
      try {
        // שליפת כל המודעות של הסוכן
        const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        
        if (!res.ok) {
          throw new Error(`שגיאה: ${res.status}`);
        }
        
        const data = await res.json();
        
        // ✅ התשובה היא: { success: true, ads: [...] }
        const adsArray = data.success && Array.isArray(data.ads) ? data.ads : [];
        
        setAds(adsArray);
        setFilteredAds(adsArray);
        
        // שליפת רשימת קמפיינים ייחודיים
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

  // פתיחת מודאל שיתוף
  const shareAd = (ad) => {
    setSelectedAdForShare(ad);
    setShareModalOpen(true);
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

                return (
                  <div key={ad._id} className="myads-item">
                    
                    {/* 1. אזור התמונה (למעלה) */}
                    <div className="ad-image-wrapper">
                      {ad.imageData ? (
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
                      )}
                    </div>

                    {/* 2. אזור התוכן הלבן (למטה) - ללא QR */}
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
                                <button className="btn btn-share" onClick={() => shareAd(ad)}>
                                    <i className="fas fa-share"></i> שתף
                                </button>
                                <button className="btn btn-download" onClick={() => downloadAd(ad._id)}>
                                    <i className="fas fa-download"></i> הורד
                                </button>
                            </>
                        ) : (
                            <>
                                <button className="btn btn-locked" disabled>
                                     <i className="fas fa-share"></i> שתף
                                </button>
                                <button className="btn btn-locked" disabled>
                                     <i className="fas fa-download"></i> הורד
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

      {/* מודאל שיתוף */}
      <ShareModal 
        isOpen={shareModalOpen} 
        onClose={() => setShareModalOpen(false)} 
        ad={selectedAdForShare} 
      />
    </div>
  );
};

export default MyAds;