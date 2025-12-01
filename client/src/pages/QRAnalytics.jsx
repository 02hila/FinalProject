// client/src/pages/QRAnalytics.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getOverviewAnalytics, getCampaignAnalytics, getTopQRs } from '../services/qrService';
import './QRAnalytics.css';

const QRAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [topQRs, setTopQRs] = useState([]);
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      // טעינת נתונים מקבילית
      const [overviewData, campaignsData, topQRsData] = await Promise.all([
        getOverviewAnalytics(token),
        getCampaignAnalytics(token),
        getTopQRs(5, token)
      ]);

      if (overviewData.success) {
        setOverview(overviewData.overview);
      }

      if (campaignsData.success) {
        setCampaigns(campaignsData.campaigns);
      }

      if (topQRsData.success) {
        setTopQRs(topQRsData.topQRs);
      }

    } catch (err) {
      console.error('❌ Error loading analytics:', err);
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="qr-analytics-page">
        <div className="loading-container">
          <div className="spinner"></div>
          <p>טוען סטטיסטיקות...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="qr-analytics-page">
      <button className="back-button" onClick={() => navigate('/agent-dashboard')}>
        <i className="fas fa-arrow-right"></i> חזרה לדשבורד
      </button>

      <div className="analytics-container">
        <div className="analytics-header">
          <h1>
            <i className="fas fa-chart-line"></i> סטטיסטיקות QR
          </h1>
          <p>מעקב אחר סריקות ה-QR שלך</p>
        </div>

        {error && (
          <div className="error-banner">
            <i className="fas fa-exclamation-circle"></i> {error}
          </div>
        )}

        {/* סקירה כללית */}
        {overview && (
          <div className="stats-grid">
            <div className="stat-card stat-primary">
              <div className="stat-icon">
                <i className="fas fa-qrcode"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{overview.totalQRs}</div>
                <div className="stat-label">סה"כ QR קודים</div>
              </div>
            </div>

            <div className="stat-card stat-success">
              <div className="stat-icon">
                <i className="fas fa-eye"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{overview.totalScans}</div>
                <div className="stat-label">סה"כ סריקות</div>
              </div>
            </div>

            <div className="stat-card stat-info">
              <div className="stat-icon">
                <i className="fas fa-calendar-day"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{overview.todayScans}</div>
                <div className="stat-label">סריקות היום</div>
              </div>
            </div>

            <div className="stat-card stat-warning">
              <div className="stat-icon">
                <i className="fas fa-chart-bar"></i>
              </div>
              <div className="stat-content">
                <div className="stat-value">{overview.averageScansPerQR}</div>
                <div className="stat-label">ממוצע לכל QR</div>
              </div>
            </div>
          </div>
        )}

        {/* סטטיסטיקות נוספות */}
        {overview && (
          <div className="additional-stats">
            <div className="stat-item">
              <i className="fas fa-calendar-week"></i>
              <span>סריקות השבוע:</span>
              <strong>{overview.weekScans}</strong>
            </div>
            <div className="stat-item">
              <i className="fas fa-calendar-alt"></i>
              <span>סריקות החודש:</span>
              <strong>{overview.monthScans}</strong>
            </div>
            <div className="stat-item">
              <i className="fas fa-check-circle"></i>
              <span>QR פעילים:</span>
              <strong>{overview.activeQRs}</strong>
            </div>
          </div>
        )}

        <div className="analytics-sections">
          {/* QR מובילים */}
          {topQRs.length > 0 && (
            <div className="analytics-section">
              <h2>
                <i className="fas fa-trophy"></i> ה-QR המצליחים ביותר
              </h2>
              <div className="top-qrs-list">
                {topQRs.map((qr, index) => (
                  <div key={qr.uniqueId} className="top-qr-item">
                    <div className="qr-rank">#{index + 1}</div>
                    <div className="qr-info">
                      <h4>{qr.adTitle || 'ללא כותרת'}</h4>
                      <p className="qr-campaign">{qr.campaignTitle}</p>
                      <a 
                        href={qr.shortUrl} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="qr-link"
                      >
                        {qr.shortUrl}
                      </a>
                    </div>
                    <div className="qr-scans">
                      <div className="scans-number">{qr.totalScans}</div>
                      <div className="scans-label">סריקות</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* סטטיסטיקות לפי קמפיינים */}
          {campaigns.length > 0 && (
            <div className="analytics-section">
              <h2>
                <i className="fas fa-bullhorn"></i> סטטיסטיקות לפי קמפיין
              </h2>
              <div className="campaigns-list">
                {campaigns.map((campaign) => (
                  <div key={campaign.campaignId} className="campaign-card">
                    <div className="campaign-header">
                      <h3>{campaign.campaignTitle}</h3>
                      <div className="campaign-badge">
                        {campaign.totalQRs} QR קודים
                      </div>
                    </div>
                    <div className="campaign-stats">
                      <div className="campaign-stat">
                        <i className="fas fa-eye"></i>
                        <span>{campaign.totalScans} סריקות</span>
                      </div>
                      <div className="campaign-stat">
                        <i className="fas fa-chart-line"></i>
                        <span>
                          {campaign.totalQRs > 0 
                            ? (campaign.totalScans / campaign.totalQRs).toFixed(1)
                            : 0
                          } ממוצע
                        </span>
                      </div>
                    </div>
                    {campaign.qrs && campaign.qrs.length > 0 && (
                      <div className="campaign-qrs">
                        <details>
                          <summary>הצג {campaign.qrs.length} QR קודים</summary>
                          <ul>
                            {campaign.qrs.map(qr => (
                              <li key={qr.uniqueId}>
                                <span>{qr.adTitle}</span>
                                <span className="qr-scans-small">{qr.scans} סריקות</span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* מצב ריק */}
        {overview && overview.totalQRs === 0 && (
          <div className="empty-state">
            <div className="empty-icon">
              <i className="fas fa-qrcode"></i>
            </div>
            <h3>עדיין אין QR קודים</h3>
            <p>צור מודעה חדשה עם קישור לאתר כדי לקבל QR אוטומטית</p>
            <button 
              className="btn-primary"
              onClick={() => navigate('/ad-generator')}
            >
              <i className="fas fa-plus"></i> צור מודעה חדשה
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRAnalytics;