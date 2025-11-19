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

        // שליפת קמפיינים
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
      setFilteredAds(
        ads.filter((ad) => ad.campaignId?._id === selectedCampaign)
      );
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

  // התצוגה בזמן טעינה, שגיאה וכו'
  if (pageLoading) {
    return (
      <div className="my-ads-page loading">
        <p>טוען...</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="my-ads-page loading">
        <p>טוען מודעות...</p>
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
                <img src={ad.imageData} alt="Ad" className="ad-image" />

                <h3>{ad.title}</h3>
                <p>{ad.text}</p>

                <div className="status">
                  <span className={getStatusClass(ad.status)}>
                    {getStatusText(ad.status)}
                  </span>
                </div>

                <div className="actions">
                  <button onClick={() => downloadAd(ad._id)}>הורדה</button>
                  <button onClick={() => shareAd(ad._id)}>שיתוף</button>
                  <button onClick={() => publishToFacebook(ad)}>
                    פייסבוק
                  </button>
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
