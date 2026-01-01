import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ConfirmRedirect.css';

const ConfirmRedirect = () => {
  const { adId } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const fetchAd = async () => {
      try {
        //  קריאה ל-API ציבורי לקבלת פרטי המודעה
        const res = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${adId}/public`);        
        if (!res.ok) throw new Error('לא נמצאה מודעה');
        
        const data = await res.json();
        
        if (data.success && data.ad) {
          setAd(data.ad);
        } else {
          throw new Error('לא נמצאה מודעה');
        }
      } catch (err) {
        console.error('❌ Error fetching ad:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (adId) {
      fetchAd();
    }
  }, [adId]);

  
  useEffect(() => {
    if (ad && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (ad && countdown === 0) {
      // הפניה אוטומטית אחרי 5 שניות
      handleOpenWebsite(true);
    }
  }, [ad, countdown]);

  const handleOpenWebsite = async (autoRedirect = false) => {
    try {
      //  שליחת בקשה לספירת הקליק (אנליטיקס)
await fetch(`https://adsmaker.onrender.com/api/pending-ads/click/${adId}`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Error logging click:', err);
    }

    //  הפניה לאתר החברה
    const targetUrl = ad?.campaignId?.websiteUrl || ad?.websiteUrl;
    
    if (targetUrl) {
      window.location.href = targetUrl;
    } else {
      alert('לא נמצא קישור לאתר');
    }
  };

  const handleCancel = () => {
    navigate(-1); // חזרה לעמוד הקודם
  };

  if (loading) {
    return (
      <div className="confirm-redirect-page">
        <div className="confirm-redirect-container">
          <div className="loading-spinner"></div>
          <p>טוען מידע...</p>
        </div>
      </div>
    );
  }

  if (error || !ad) {
    return (
      <div className="confirm-redirect-page">
        <div className="confirm-redirect-container error-container">
          <div className="error-icon">❌</div>
          <h2>שגיאה</h2>
          <p>{error || 'המודעה לא נמצאה'}</p>
          <button className="btn-back" onClick={() => navigate('/')}>
            חזרה לדף הבית
          </button>
        </div>
      </div>
    );
  }

  const targetUrl = ad?.campaignId?.websiteUrl || ad?.websiteUrl || '';

  return (
    <div className="confirm-redirect-page">
      <div className="confirm-redirect-container">
        
        {/* לוגו / כותרת */}
        <div className="redirect-header">
          <h1>🎯 Ads-Maker</h1>
          <p className="subtitle">מערכת ניהול פרסום חכמה</p>
        </div>

        {/* תמונת המודעה */}
        {ad.imageData && (
          <div className="ad-preview">
            <img src={ad.imageData} alt={ad.title || 'מודעה'} />
            <div className="ad-badge">מודעה ממומנת</div>
          </div>
        )}

        {/* פרטי המודעה */}
        <div className="ad-info">
          <h2>{ad.title || ad.campaignId?.title || 'מודעה'}</h2>
          {ad.text && <p className="ad-text">{ad.text}</p>}
          
          {/* מידע על החברה */}
          {ad.companyId && (
            <div className="company-info">
              <i className="fas fa-building"></i>
              <span>{ad.companyId.companyName || ad.companyId.fullName}</span>
            </div>
          )}
        </div>

        {/* הודעת אישור */}
        <div className="confirm-message">
          <div className="redirect-icon">
            <i className="fas fa-external-link-alt"></i>
          </div>
          <p className="main-message">אתה עומד לעבור לאתר חיצוני</p>
          {targetUrl && (
            <div className="target-url-box">
              <i className="fas fa-link"></i>
              <span className="target-url">{targetUrl}</span>
            </div>
          )}
        </div>

        {/* טיימר */}
        <div className="countdown-timer">
          <div className="timer-circle">
            <span className="timer-number">{countdown}</span>
          </div>
          <p>הפניה אוטומטית בעוד {countdown} שניות...</p>
        </div>

        {/* כפתורי פעולה */}
        <div className="confirm-actions">
          <button className="btn-confirm" onClick={() => handleOpenWebsite(false)}>
            <i className="fas fa-arrow-left"></i>
            המשך לאתר עכשיו
          </button>
          <button className="btn-cancel" onClick={handleCancel}>
            <i className="fas fa-times"></i>
            ביטול
          </button>
        </div>

        {/* מידע נוסף */}
        <div className="safety-info">
          <i className="fas fa-shield-alt"></i>
          <p>האתר בטוח ומאומת על ידי Ads-Maker</p>
        </div>

        {/* פוטר */}
        <div className="powered-by">
          <span>Powered by <strong>Ads-Maker</strong></span>
          <span className="separator">•</span>
          <span>מערכת פרסום מתקדמת</span>
        </div>

      </div>
    </div>
  );
};

export default ConfirmRedirect;