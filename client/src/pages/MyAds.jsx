import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageSelectorModal from "../components/PageSelectorModal";
import "./MyAds.css"; // חשוב מאוד! וודאי שהקובץ קיים

const MyAds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [filteredAds, setFilteredAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ---- שליפת מודעות ----
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });

        if (!res.ok) throw new Error("שגיאה בטעינת המודעות");

        const data = await res.json();
        setAds(data);
        setFilteredAds(data);

        // שליפת קמפיינים לרשימה
        const uniqueCampaigns = [
          ...new Map(data.map((ad) => [ad.campaignId?._id, ad.campaignId])).values(),
        ].filter(Boolean);
        setCampaigns(uniqueCampaigns);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (user) fetchAds();
  }, [user]);

  // ---- סינון לפי קמפיין ----
  useEffect(() => {
    if (selectedCampaign === "all") {
      setFilteredAds(ads);
    } else {
      setFilteredAds(ads.filter((ad) => ad.campaignId?._id === selectedCampaign));
    }
  }, [selectedCampaign, ads]);

  // ---- פונקציות עזר ----
  const getStatusClass = (status) => {
    if (status === "approved") return "status-approved";
    if (status === "rejected") return "status-rejected";
    return "status-pending";
  };

  const getStatusText = (status) => {
    if (status === "approved") return "מאושר";
    if (status === "rejected") return "נדחה";
    return "ממתין לאישור";
  };

  const downloadAd = async (adId) => {
    // לוגיקת הורדה
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads/download/${adId}`, {
         headers: { Authorization: `Bearer ${user?.token}` }
      });
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `ad-${adId}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (e) {
      console.error("Download failed", e);
    }
  };

  const shareAd = (adId) => {
    alert("פונקציית שיתוף תופעל בקרוב");
  };

  if (loading) return <div className="my-ads-page loading"><div className="spinner"></div><p>טוען מודעות...</p></div>;
  if (error) return <div className="my-ads-page error"><p>{error}</p></div>;

  return (
    <div className="my-ads-page">
      {/* כפתור חזרה */}
      <button className="back-button" onClick={() => navigate("/dashboard")}>
        חזרה לדשבורד <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <PageSelectorModal />

        {/* פילטר */}
        <div className="campaign-filter">
          <label>סנן לפי קמפיין:</label>
          <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
            <option value="all">כל הקמפיינים</option>
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>{c.title}</option>
            ))}
          </select>
        </div>

        {/* גריד המודעות */}
        <div className="ads-grid">
          {filteredAds.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-image"></i>
              <h3>אין מודעות להצגה</h3>
            </div>
          ) : (
            filteredAds.map((ad) => (
              <div key={ad._id} className="myads-item">
                
                {/* --- חלק עליון: תמונה --- */}
                <div className="ad-image-container">
                    {ad.status === "approved" && ad.imageData ? (
                    <img src={ad.imageData} alt="מודעה" className="ad-image" />
                    ) : (
                    <div className="ad-image-locked">
                        <i className="fas fa-lock"></i>
                        <h3>הורדה נעולה</h3>
                        <p>התמונה תהיה זמינה לאחר אישור</p>
                    </div>
                    )}
                </div>

                {/* --- חלק תחתון: תוכן וכפתורים --- */}
                <div className="ad-content">
                  <div className="ad-header">
                      <span className={`status-badge ${getStatusClass(ad.status)}`}>
                        {getStatusText(ad.status)}
                      </span>
                      <span className="ad-date">
                        {new Date(ad.createdAt).toLocaleDateString('he-IL')}
                      </span>
                  </div>

                  <h3 className="ad-title">{ad.title || "מודעה ללא כותרת"}</h3>
                  <p className="ad-text">{ad.text || "ללא טקסט נוסף..."}</p>
                  
                  <div className="ad-campaign-info">
                    <i className="fas fa-tag"></i> {ad.campaignId?.title || "קמפיין כללי"}
                  </div>

                  {/* כפתורים */}
                  <div className="ad-actions">
                    {ad.status === "approved" ? (
                      <>
                        <button className="btn btn-share" onClick={() => shareAd(ad._id)}>
                          <i className="fas fa-share"></i> שתף
                        </button>
                        <button className="btn btn-download" onClick={() => downloadAd(ad._id)}>
                          <i className="fas fa-download"></i> הורד
                        </button>
                      </>
                    ) : (
                      <button className="btn btn-locked" disabled>
                        <i className="fas fa-lock"></i> לפרטים נוספים (נעול)
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default MyAds;