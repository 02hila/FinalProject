/**
 * ConfirmRedirect.jsx
 *
 * Interstitial page shown when a user scans a QR code or clicks a shared
 * ad link. Displays a preview of the ad and a countdown timer before
 * automatically redirecting to the company's external website.
 *
 * Route: /ad/:adId
 * Access: Public -- no authentication required. The ad data is fetched
 *         from a public API endpoint.
 * API:
 *   - GET  /api/pending-ads/:adId/public  -- fetches ad details for preview.
 *   - POST /api/pending-ads/click/:adId   -- logs the click for analytics.
 * Context: None.
 *
 * The page features a 5-second countdown that auto-redirects the user.
 * Users can also click "continue now" or "cancel" to control navigation.
 */

import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './ConfirmRedirect.css';

/**
 * ConfirmRedirect component.
 *
 * Fetches public ad data on mount, displays a preview (image, title,
 * company info), and runs a countdown. When the countdown reaches zero
 * or the user clicks the confirm button, a click event is logged and
 * the browser is redirected to the target website URL.
 *
 * @returns {JSX.Element} The redirect confirmation page.
 */
const ConfirmRedirect = () => {
  const { adId } = useParams();
  const navigate = useNavigate();
  const [ad, setAd] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(5);

  /** Fetch public ad details when the component mounts or adId changes. */
  useEffect(() => {
    const fetchAd = async () => {
      try {
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

  /**
   * Countdown timer effect. Decrements every second once the ad is loaded.
   * Triggers automatic redirect when countdown reaches zero.
   */
  useEffect(() => {
    if (ad && countdown > 0) {
      const timer = setTimeout(() => {
        setCountdown(countdown - 1);
      }, 1000);

      return () => clearTimeout(timer);
    } else if (ad && countdown === 0) {
      handleOpenWebsite(true);
    }
  }, [ad, countdown]);

  /**
   * Logs a click event to the analytics API and then redirects the
   * browser to the campaign's target website URL.
   *
   * @param {boolean} autoRedirect - Whether this was triggered automatically.
   */
  const handleOpenWebsite = async (autoRedirect = false) => {
    try {
      // Log the click for analytics tracking
await fetch(`https://adsmaker.onrender.com/api/pending-ads/click/${adId}`, {        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (err) {
      console.error('Error logging click:', err);
    }

    // Determine the redirect target from the ad's campaign or direct URL
    const targetUrl = ad?.campaignId?.websiteUrl || ad?.websiteUrl;

    if (targetUrl) {
      window.location.href = targetUrl;
    } else {
      alert('לא נמצא קישור לאתר');
    }
  };

  /** Navigates back to the previous page in the browser history. */
  const handleCancel = () => {
    navigate(-1);
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

        {/* Logo / Title */}
        <div className="redirect-header">
          <h1>🎯 Ads-Maker</h1>
          <p className="subtitle">מערכת ניהול פרסום חכמה</p>
        </div>

        {/* Ad image preview */}
        {ad.imageData && (
          <div className="ad-preview">
            <img src={ad.imageData} alt={ad.title || 'מודעה'} />
            <div className="ad-badge">מודעה ממומנת</div>
          </div>
        )}

        {/* Ad details */}
        <div className="ad-info">
          <h2>{ad.title || ad.campaignId?.title || 'מודעה'}</h2>
          {ad.text && <p className="ad-text">{ad.text}</p>}

          {/* Company attribution */}
          {ad.companyId && (
            <div className="company-info">
              <i className="fas fa-building"></i>
              <span>{ad.companyId.companyName || ad.companyId.fullName}</span>
            </div>
          )}
        </div>

        {/* Confirmation message with target URL */}
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

        {/* Countdown timer display */}
        <div className="countdown-timer">
          <div className="timer-circle">
            <span className="timer-number">{countdown}</span>
          </div>
          <p>הפניה אוטומטית בעוד {countdown} שניות...</p>
        </div>

        {/* Action buttons */}
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

        {/* Safety notice */}
        <div className="safety-info">
          <i className="fas fa-shield-alt"></i>
          <p>האתר בטוח ומאומת על ידי Ads-Maker</p>
        </div>

        {/* Footer */}
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
