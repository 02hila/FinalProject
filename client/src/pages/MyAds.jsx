import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import PageSelectorModal from "../components/PageSelectorModal";

const MyAds = () => {
  const { user } = useAuth();
  const [ads, setAds] = useState([]);
  const [filteredAds, setFilteredAds] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [selectedCampaign, setSelectedCampaign] = useState("all");
  const [loading, setLoading] = useState(true);
  const [pageLoading, setPageLoading] = useState(false);
  const [error, setError] = useState("");

  // =========================================================
  // 💡 קוד דיבוג חדש - לבדיקת מצב המשתמש
  // =========================================================
  console.log("Current User Status:", user ? "LOGGED IN" : "LOGGED OUT");
  console.log("User Token Exists:", user?.token ? "YES" : "NO");
  // =========================================================

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
  };

  // ---- שיתוף ----
  const shareAd = (adId) => {
    alert("שיתוף בקרוב...");
  };

  const publishToFacebook = (ad) => {
    alert("פייסבוק בקרוב...");
  };

  // =========================================================
  // 💡 קוד דיבוג - מצב נתונים
  // =========================================================
  console.log("--- MyAds Debug Data Status ---");
  console.log("Loading Status:", loading ? "TRUE" : "FALSE");
  console.log("Error:", error);
  console.log("Total Ads Loaded (Ads State):", ads.length);
  console.log("Filtered Ads Count:", filteredAds.length);
  if (filteredAds.length > 0) {
    console.log("First Ad ID:", filteredAds[0]._id);
    console.log("First Ad Status:", getStatusText(filteredAds[0].status));
    console.log(
      "First Ad Image Data (Start):",
      filteredAds[0].imageData
        ? filteredAds[0].imageData.substring(0, 50) + "..."
        : "No Image Data"
    );
  }
  console.log("------------------------");

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
  //   התצוגה הראשית
  // -------------------
  return (
    <div className="my-ads-page">
      <div className="container">
        <PageSelectorModal />

        <div className="campaign-filter">
          <label>סינון לפי קמפיין:</label>
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
              <div key={ad._id} className="ad-card">
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
                    <i
                      className={`fas ${
                        ad.status === "pending"
                          ? "fa-clock"
                          : ad.status === "rejected"
                          ? "fa-times-circle"
                          : "fa-lock"
                      }`}
                    ></i>
                    <p>
                      <strong>
                        {ad.status === "pending"
                          ? "ממתין לאישור"
                          : ad.status === "rejected"
                          ? "מודעה נדחתה"
                          : "הורדה נעולה"}
                      </strong>
                    </p>
                    <p>
                      {ad.status === "pending"
                        ? "התמונה תהיה זמינה לאחר אישור"
                        : ad.status === "rejected"
                        ? "המודעה לא אושרה על ידי המנהל"
                        : "התמונה זמינה רק למודעות מאושרות"}
                    </p>
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
                          className="btn btn-download"
                          onClick={() => downloadAd(ad._id)}
                        >
                          <i className="fas fa-download"></i> הורד
                        </button>
                        <button
                          className="btn btn-share"
                          onClick={() => shareAd(ad._id)}
                        >
                          <i className="fas fa-share"></i> שתף
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-locked" disabled>
                          <i className="fas fa-lock"></i> הורדה נעולה
                        </button>
                        <button className="btn btn-locked" disabled>
                          <i className="fas fa-lock"></i> שיתוף נעול
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
