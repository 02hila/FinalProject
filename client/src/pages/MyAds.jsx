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
        console.log('🔍 Fetching ads for user:', user);
        const apiUrl = `https://adsmaker.onrender.com/api/ads`;
        console.log('📡 API URL:', apiUrl);
        
        const res = await fetch(apiUrl, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });
        
        console.log('📥 Response status:', res.status);
        
        if (!res.ok) throw new Error("שגיאה בטעינת נתונים");
        
        const data = await res.json();
        console.log('📊 Ads data received:', data);
        console.log('📊 Number of ads:', data?.length || 0);
        
        setAds(data);
        setFilteredAds(data);
        
        // שליפת רשימת קמפיינים ייחודיים
        const uniqueCampaigns = [...new Map(data.map(ad => [ad.campaignId?._id, ad.campaignId])).values()].filter(Boolean);
        console.log('📋 Unique campaigns:', uniqueCampaigns);
        setCampaigns(uniqueCampaigns);
      } catch (err) {
        console.error('❌ Error fetching ads:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    if (user) {
      fetchAds();
    } else {
      console.warn('⚠️ No user found');
    }
  }, [user]);

  // ---- סינון ----
  useEffect(() => {
    console.log('🔍 Filtering ads. Selected campaign:', selectedCampaign);
    console.log('📊 Total ads before filter:', ads.length);
    
    if (selectedCampaign === "all") {
      setFilteredAds(ads);
      console.log('✅ Showing all ads:', ads.length);
    } else {
      const filtered = ads.filter(ad => ad.campaignId?._id === selectedCampaign);
      setFilteredAds(filtered);
      console.log('✅ Filtered ads:', filtered.length);
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
          const res = await fetch(`https://adsmaker.onrender.com/api/ads/download/${adId}`, {
              headers: { Authorization: `Bearer ${user?.token}` }
          });
          const blob = await res.blob();
          const url = window.URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url; a.download = "ad.png"; a.click();
      } catch(e) { console.error(e); }
  };

  // פתיחת מודאל שיתוף
  const shareAd = (ad) => {
    setSelectedAdForShare(ad);
    setShareModalOpen(true);
  };

  console.log('🎨 Rendering. Loading:', loading, 'Error:', error, 'Filtered ads:', filteredAds.length);

  if (loading) return <div className="my-ads-page"><p>טוען...</p></div>;
  if (error) return <div className="my-ads-page"><p>שגיאה: {error}</p></div>;

  return (
    <div className="my-ads-page">
      {/* ✅ כפתור חזרה מתוקן */}
      <button className="back-button" onClick={() => navigate("/agent-dashboard")}>
        חזרה לדשבורד <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <PageSelectorModal />

        <div className="campaign-filter">
          <label>סנן לפי קמפיין:</label>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="all">כל הקמפיינים</option>
            {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
          </select>
        </div>

        <div className="ads-grid">
          {filteredAds.length === 0 ? (
            <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888' }}>אין מודעות להצגה</p>
          ) : (
            filteredAds.map((ad) => {
                const statusInfo = getStatusData(ad.status);
                const isApproved = ad.status === 'approved';

                return (
                  <div key={ad._id} className="myads-item">
                    
                    {/* 1. אזור התמונה (למעלה) */}
                    <div className="ad-image-wrapper">
                      {isApproved && ad.imageData ? (
                        <img src={ad.imageData} alt={ad.title} className="ad-image" loading="lazy" />
                      ) : (
                        <div className="ad-image-locked">
                          <i className="fas fa-lock"></i>
                          <div style={{fontWeight: 'bold', fontSize: '14px'}}>הורדה נעולה</div>
                          <div style={{fontSize: '12px'}}>התמונה תהיה זמינה לאחר אישור</div>
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
                         <span>{ad.campaignId?.title}</span>
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