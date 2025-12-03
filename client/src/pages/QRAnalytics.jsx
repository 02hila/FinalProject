import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './QRAnalytics.css'; // נניח ש-QRAnalytics.css מגדיר את כיווניות הטקסט הכללית כ-rtl

const QRAnalytics = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [overview, setOverview] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [topQRs, setTopQRs] = useState([]);
  const [timeline, setTimeline] = useState([]);
  const [realtimeData, setRealtimeData] = useState([]);
  const [error, setError] = useState('');
  const [selectedTimeRange, setSelectedTimeRange] = useState(30);

  const token = localStorage.getItem('token');

  useEffect(() => {
    loadAnalytics();
    // רענון אוטומטי כל 30 שניות
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const baseUrl = 'https://adsmaker.onrender.com/api/analytics';
      const headers = { 'Authorization': `Bearer ${token}` };

      // טעינת נתונים מקבילית
      const [overviewRes, campaignsRes, topQRsRes, timelineRes, realtimeRes] = await Promise.all([
        fetch(`${baseUrl}/overview`, { headers }),
        fetch(`${baseUrl}/campaigns`, { headers }),
        fetch(`${baseUrl}/top-qrs?limit=5`, { headers }),
        fetch(`${baseUrl}/timeline?days=${selectedTimeRange}`, { headers }),
        fetch(`${baseUrl}/realtime`, { headers })
      ]);

      const [overviewData, campaignsData, topQRsData, timelineData, realtimeDataRes] = await Promise.all([
        overviewRes.json(),
        campaignsRes.json(),
        topQRsRes.json(),
        timelineRes.json(),
        realtimeRes.json()
      ]);

      if (overviewData.success) setOverview(overviewData.overview);
      if (campaignsData.success) setCampaigns(campaignsData.campaigns);
      if (topQRsData.success) setTopQRs(topQRsData.topQRs);
      if (timelineData.success) setTimeline(timelineData.timeline);
      if (realtimeDataRes.success) setRealtimeData(realtimeDataRes.recentScans);

    } catch (err) {
      console.error('❌ Error loading analytics:', err);
      setError(err.message || 'שגיאה בטעינת נתונים');
    } finally {
      setLoading(false);
    }
  };

  // צבעים לגרפים
  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

  if (loading && !overview) {
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
          <p>מעקב אחר סריקות ה-QR שלך בזמן אמת</p>
          {loading && <div className="live-indicator"><span></span> מעדכן...</div>}
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

        {/* גרף ציר זמן */}
        {timeline.length > 0 && (
          <div className="analytics-section chart-section">
            <div className="section-header">
              <h2>
                <i className="fas fa-chart-line"></i> מגמת סריקות לאורך זמן
              </h2>
              <div className="time-range-selector">
                <button 
                  className={selectedTimeRange === 7 ? 'active' : ''} 
                  onClick={() => setSelectedTimeRange(7)}
                >
                  7 ימים
                </button>
                <button 
                  className={selectedTimeRange === 30 ? 'active' : ''} 
                  onClick={() => setSelectedTimeRange(30)}
                >
                  30 ימים
                </button>
                <button 
                  className={selectedTimeRange === 90 ? 'active' : ''} 
                  onClick={() => setSelectedTimeRange(90)}
                >
                  90 ימים
                </button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fill: '#666', fontSize: 12 }}
                  tickFormatter={(date) => {
                    const d = new Date(date);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                />
                <YAxis tick={{ fill: '#666', fontSize: 12 }} />
                <Tooltip 
                  contentStyle={{ 
                    background: 'white', 
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    direction: 'rtl'
                  }}
                  labelFormatter={(date) => {
                    const d = new Date(date);
                    return d.toLocaleDateString('he-IL');
                  }}
                />
                <Legend wrapperStyle={{ direction: 'rtl' }} />
                <Line 
                  type="monotone" 
                  dataKey="scans" 
                  stroke="#667eea" 
                  strokeWidth={3}
                  dot={{ fill: '#667eea', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="סריקות"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="analytics-grid">
          {/* גרף עוגה - התפלגות לפי קמפיינים - קוד מתוקן */}
          {campaigns.length > 0 && (
            <div className="analytics-section chart-section">
              <h2>
                <i className="fas fa-chart-pie"></i> התפלגות סריקות לפי קמפיין
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={campaigns}
                    dataKey="totalScans"
                    nameKey="campaignTitle"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    fill="#8884d8"
                    // הצגת אחוזים בלבד בתוך הפלחים (כדי להימנע מבעיות RTL)
                    label={({ percent }) => (percent > 0.05 ? `${(percent * 100).toFixed(0)}%` : '')} 
                    labelLine={false} // הסתרת הקוים
                  >
                    {campaigns.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  {/* הוספת מקרא כדי להציג את שם הקמפיין (עם יישור RTL) */}
                  <Legend 
                    wrapperStyle={{ direction: 'rtl', paddingRight: '20px' }}
                    layout="vertical"
                    align="right" // כדי שהמקרא יופיע מימין לגרף העוגה
                    verticalAlign="middle"
                  />
                  <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px' }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* גרף עמודות - Top QRs */}
          {topQRs.length > 0 && (
            <div className="analytics-section chart-section">
              <h2>
                <i className="fas fa-trophy"></i> 5 ה-QR המובילים
              </h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={topQRs} layout="vertical"> {/* שינוי ל-vertical כדי לשפר RTL */}
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="adTitle" 
                    tick={{ fill: '#666', fontSize: 11, direction: 'rtl' }} // ניתן להוסיף direction: 'rtl' לתיקון נוסף
                    width={100} // הגדלת רוחב כדי להתאים לכיתוב בעברית
                  />
                  <Tooltip contentStyle={{ direction: 'rtl', borderRadius: '8px' }} />
                  <Bar dataKey="totalScans" fill="#667eea" name="סריקות" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
{/* ... שאר הקוד נשאר כפי שהיה ... */}
        {/* פעילות אחרונה בזמן אמת */}
        {realtimeData.length > 0 && (
          <div className="analytics-section">
            <h2>
              <i className="fas fa-clock"></i> פעילות אחרונה (24 שעות)
            </h2>
            <div className="realtime-list">
              {realtimeData.map((scan, index) => (
                <div key={scan.uniqueId} className="realtime-item">
                  <div className="realtime-icon">
                    <i className="fas fa-qrcode"></i>
                  </div>
                  <div className="realtime-info">
                    <h4>{scan.adTitle}</h4>
                    <p>{scan.campaignTitle}</p>
                    <span className="realtime-time">
                      <i className="fas fa-clock"></i>
                      {new Date(scan.lastScannedAt).toLocaleString('he-IL')}
                    </span>
                  </div>
                  <div className="realtime-scans">
                    <span className="scan-count">{scan.scans}</span>
                    <span className="scan-label">סריקות</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* סטטיסטיקות קמפיינים */}
        {campaigns.length > 0 && (
          <div className="analytics-section">
            <h2>
              <i className="fas fa-bullhorn"></i> סטטיסטיקות מפורטות לפי קמפיין
            </h2>
            <div className="campaigns-list">
              {campaigns.map((campaign, index) => (
                <div key={campaign.campaignId} className="campaign-card">
                  <div 
                    className="campaign-color-bar" 
                    style={{ background: COLORS[index % COLORS.length] }}
                  ></div>
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