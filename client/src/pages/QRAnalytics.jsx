import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './QRAnalytics.css';

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
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  const loadAnalytics = async () => {
    setLoading(true);
    setError('');

    try {
      const baseUrl = 'https://adsmaker.onrender.com/api/analytics';
      const headers = { 'Authorization': `Bearer ${token}` };

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

  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

  // ✅ תיקון #1: פונקציה משופרת להצגת אחוזים בתרשים העוגה
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    // הצג רק אם האחוז גדול מ-3%
    if (percent * 100 < 3) return null;

    // מיקום התווית באמצע הפלח (לא על הקצה)
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180));
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180));

    return (
      <text 
        x={x} 
        y={y} 
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        style={{ 
          fontSize: '18px', 
          fontWeight: 'bold',
          textShadow: '2px 2px 4px rgba(0,0,0,0.6)',
          pointerEvents: 'none'
        }}
      >
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  // ✅ תיקון #2: Tooltip מותאם אישית עם שם הקמפיין
  const CustomPieTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '10px',
          direction: 'rtl',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '5px' }}>
            {payload[0].name}
          </p>
          <p style={{ margin: 0, color: '#667eea' }}>
            {payload[0].value.toLocaleString()} סריקות
          </p>
        </div>
      );
    }
    return null;
  };

  // ✅ תיקון #3: Tooltip מותאם אישית לגרף העמודות
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const title = data.adTitle && data.adTitle.trim() !== '' 
        ? data.adTitle 
        : `QR מקמפיין: ${data.campaignTitle || 'ללא שם'}`;
      
      return (
        <div style={{
          background: 'white',
          border: '1px solid #ddd',
          borderRadius: '8px',
          padding: '12px',
          direction: 'rtl',
          boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
          minWidth: '200px'
        }}>
          <p style={{ margin: 0, fontWeight: 'bold', marginBottom: '5px', fontSize: '14px' }}>
            {title}
          </p>
          {data.campaignTitle && (
            <p style={{ margin: '3px 0', color: '#888', fontSize: '12px' }}>
              <i className="fas fa-bullhorn" style={{ marginLeft: '5px' }}></i>
              {data.campaignTitle}
            </p>
          )}
          <p style={{ margin: '5px 0 0 0', color: '#667eea', fontWeight: 'bold', fontSize: '15px' }}>
            <i className="fas fa-eye" style={{ marginLeft: '5px' }}></i>
            {payload[0].value.toLocaleString()} סריקות
          </p>
        </div>
      );
    }
    return null;
  };

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
          {/* ✅ תרשים עוגה מתוקן - אחוזים ברורים */}
          {campaigns.length > 0 && (
            <div className="analytics-section chart-section">
              <h2>
                <i className="fas fa-chart-pie"></i> התפלגות סריקות לפי קמפיין
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <PieChart>
                  <Pie
                    data={campaigns}
                    dataKey="totalScans"
                    nameKey="campaignTitle"
                    cx="50%"
                    cy="50%"
                    outerRadius={110}
                    innerRadius={0}
                    fill="#8884d8"
                    label={renderCustomizedLabel}
                    labelLine={false}
                  >
                    {campaigns.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomPieTooltip />} />
                  <Legend 
                    wrapperStyle={{ direction: 'rtl', paddingTop: '10px' }}
                    layout="horizontal"
                    align="center"
                    verticalAlign="bottom"
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* ✅ גרף עמודות מתוקן - עם כותרות נכונות */}
          {topQRs.length > 0 && (
            <div className="analytics-section chart-section">
              <h2>
                <i className="fas fa-trophy"></i> 5 ה-QR המובילים
              </h2>
              <ResponsiveContainer width="100%" height={350}>
                <BarChart data={topQRs} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis 
                    type="number" 
                    tick={{ fill: '#666', fontSize: 12 }}
                  />
                  <YAxis 
                    type="category"
                    dataKey="adTitle"
                    tick={{ fill: '#666', fontSize: 12 }}
                    width={150}
                    tickFormatter={(value) => {
                      if (!value || value.trim() === '') {
                        return 'QR ללא כותרת';
                      }
                      return value.length > 20 ? value.substring(0, 20) + '...' : value;
                    }}
                  />
                  <Tooltip content={<CustomBarTooltip />} />
                  <Bar 
                    dataKey="totalScans" 
                    fill="#667eea" 
                    name="סריקות" 
                    radius={[0, 8, 8, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {realtimeData.length > 0 && (
          <div className="analytics-section">
            <h2>
              <i className="fas fa-clock"></i> פעילות אחרונה (24 שעות)
            </h2>
            <div className="realtime-list">
              {realtimeData.map((scan, index) => (
                <div key={scan.uniqueId || index} className="realtime-item">
                  <div className="realtime-icon">
                    <i className="fas fa-qrcode"></i>
                  </div>
                  <div className="realtime-info">
                    <h4>
                      {scan.adTitle && scan.adTitle.trim() !== '' 
                        ? scan.adTitle 
                        : `QR #${index + 1} - ${scan.campaignTitle || 'ללא קמפיין'}`
                      }
                    </h4>
                    <p>
                      <i className="fas fa-bullhorn" style={{ marginLeft: '5px', fontSize: '12px' }}></i>
                      {scan.campaignTitle || 'ללא שם קמפיין'}
                    </p>
                    <span className="realtime-time">
                      <i className="fas fa-clock"></i>
                      {new Date(scan.lastScannedAt).toLocaleString('he-IL', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
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