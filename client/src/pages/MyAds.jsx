import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useNavigate } from "react-router-dom";
import PageSelectorModal from "../components/PageSelectorModal";

const MyAds = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [ads, setAds] = useState([]);
  const [filteredAds, setFilteredAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  // ---- שליפת מודעות ----
  useEffect(() => {
    const fetchAds = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads`, {
          headers: { Authorization: `Bearer ${user?.token}` },
        });

        if (!res.ok) throw new Error("קרתה שגיאה בטעינת המודעות");

        const data = await res.json();
        setAds(data);
        setFilteredAds(data);

        // שליפת קמפיינים ייחודיים
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

  // ---- סינון מודעות ----
  useEffect(() => {
    if (selectedCampaign === "all") {
      setFilteredAds(ads);
    } else {
      setFilteredAds(ads.filter((ad) => ad.campaignId?._id === selectedCampaign));
    }
  }, [selectedCampaign, ads]);

  // ---- פונקציות סטטוס ----
  const getStatusClass = (status) => {
    switch (status) {
      case "approved":
        return "status-approved";
      case "pending":
        return "status-pending";
      case "rejected":
        return "status-rejected";
      default:
        return "";
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case "approved":
        return "מאושר";
      case "pending":
        return "ממתין";
      case "rejected":
        return "נדחה";
      default:
        return "";
    }
  };

  // ---- פונקציות עזר ----
  const getCampaignTitle = (ad) => ad.campaignId?.title || "לא ידוע";

  // ---- הורדה ----
  const downloadAd = async (adId) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads/download/${adId}`, {
        headers: { Authorization: `Bearer ${user?.token}` },
      });

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");

      a.href = url;
      a.download = "ad.png";
      a.click();
      a.remove();
    } catch (err) {
      console.error("Download error:", err);
    }
  };

  // ---- שיתוף ----
  const shareAd = (adId) => {
    alert("שיתוף בקרוב...");
  };

  // ---- חזרה לדשבורד ----
  const goBack = () => {
    navigate("/dashboard");
  };

  // ---- התצוגה בזמן טעינה, שגיאה וכו' ----
  if (pageLoading) {
    return (
      <div className="my-ads-page loading">
        <p>טוען...</p>
        <div className="spinner"></div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-ads-page loading">
        <p>טוען מודעות...</p>
        <div className="spinner"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-ads-page error">
        <p>שגיאה: {error}</p>
      </div>
    );
  }

  // -------------------
  //   התצוגה הראשית
  // -------------------
  return (
    <div className="my-ads-page">
      {/* כפתור חזרה לדשבורד */}
      <button className="back-button" onClick={goBack}>
        חזרה לדשבורד
        <i className="fas fa-arrow-left"></i>
      </button>

      <div className="container">
        <PageSelectorModal />

        <div className="campaign-filter">
          <label>סנן לפי קמפיין:</label>
          <select
            value={selectedCampaign}
            onChange={(e) => setSelectedCampaign(e.target.value)}
          >
            <option value="all">כל הקמפיינים</option>
            {campaigns.map((c) => (
              <option key={c._id} value={c._id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        <div className="ads-grid">
          {filteredAds.length === 0 ? (
            <div className="empty-state">
              <i className="fas fa-bullhorn"></i>
              <h3>אין מודעות להצגה</h3>
            </div>
          ) : (
            filteredAds.map((ad) => (
              <div key={ad._id} className="myads-item">
                {/* תמונה או תמונה נעולה */}
                {ad.status === "approved" && ad.imageData ? (
                  <img
                    src={ad.imageData}
                    alt={ad.title || "מודעה"}
                    className="ad-image"
                    loading="lazy"
                  />
                ) : (
                  <div className="ad-image-locked">
                    <i className="fas fa-lock"></i>
                    <p>
                      <strong>הורדה נעולה</strong>
                    </p>
                    <p>התמונה תהיה זמינה לאחר אישור</p>
                  </div>
                )}

                <div className="ad-content">
                  <div className="ad-title">{ad.title || "ללא כותרת"}</div>
                  <div className="ad-text">{ad.text || "ללא טקסט"}</div>

                  <div className="ad-meta">
                    <span className={getStatusClass(ad.status)}>
                      {getStatusText(ad.status)}
                    </span>
                    <div>
                      <strong>קמפיין:</strong> {getCampaignTitle(ad)}
                    </div>
                    <div>
                      <strong>תאריך יצירה:</strong>{" "}
                      {new Date(ad.createdAt).toLocaleDateString("he-IL")}
                    </div>
                  </div>

                  <div className="ad-actions">
                    {ad.status === "approved" ? (
                      <>
                        <button
                          className="btn btn-share"
                          onClick={() => shareAd(ad._id)}
                        >
                          <i className="fas fa-share"></i> שתף
                        </button>
                        <button
                          className="btn btn-download"
                          onClick={() => downloadAd(ad._id)}
                        >
                          <i className="fas fa-download"></i> הורד
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-locked" disabled>
                          <i className="fas fa-lock"></i> שיתוף נעול
                        </button>
                        <button className="btn btn-locked" disabled>
                          <i className="fas fa-lock"></i> הורדה נעולה
                        </button>
                      </>
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