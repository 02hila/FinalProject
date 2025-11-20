import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import './ConfirmRedirect.css';

const ConfirmRedirect = () => {
  const { adId } = useParams();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchAd = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads/public/${adId}`);
        if (!res.ok) throw new Error('לא נמצאה מודעה');
        const data = await res.json();
        setAd(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (adId) fetchAd();
  }, [adId]);

  const handleOpenWebsite = async () => {
    try {
      // שליחת בקשה לספירת הקליק
      await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads/click/${adId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Error logging click:', err);
    }

    // הפניה לאתר החברה
    const targetUrl = ad?.campaignId?.websiteUrl || ad?.websiteUrl;
    if (targetUrl) {
      window.location.href = targetUrl;
    } else {
      alert('לא נמצא קישור לאתר');
    }
  };

  const handleCancel = () => {
    window.history.back();
  };

  if (loading) {
    return (
      <div className="confirm-redirect-page">
        <div className="confirm-redirect-container">
          <div className="loading-spinner"></div>
          <p>טוען...</p>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="confirm-redirect-page">
        <div className="confirm-redirect-container">
          <div className="error-icon">❌</div>
          <h2>שגיאה</h2>
          <p>{error || 'המודעה לא נמצאה'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="confirm-redirect-page">
      <div className="confirm-redirect-container">
        {/* תמונת המודעה */}
        {ad.imageData && (
          <div className="ad-preview">
            <img src={ad.imageData} alt={ad.title || 'מודעה'} />
          </div>
        )}

        {/* פרטי המודעה */}
        <div className="ad-info">
          <h2>{ad.title || 'מודעה'}</h2>
          {ad.text && <p className="ad-text">{ad.text}</p>}
        </div>

        {/* הודעת אישור */}
        <div className="confirm-message">
          <p>אתה עומד לעבור לאתר חיצוני</p>
          <p className="target-url">{ad?.campaignId?.websiteUrl || ad?.websiteUrl || 'אתר החברה'}</p>
        </div>

        {/* כפתורי פעולה */}
        <div className="confirm-actions">
          <button className="btn-confirm" onClick={handleOpenWebsite}>
            <i className="fas fa-external-link-alt"></i>
            פתח את האתר
          </button>
          <button className="btn-cancel" onClick={handleCancel}>
            ביטול
          </button>
        </div>

        {/* פוטר */}
        <div className="powered-by">
          <span>Powered by Ads-Maker</span>
        </div>
      </div>
    </div>
  );
};

export default ConfirmRedirect;