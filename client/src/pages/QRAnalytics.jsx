/**
 * QRAnalytics - Agent Statistics Dashboard
 *
 * Displays comprehensive QR scan analytics for agents including:
 * - Overview statistics (total QRs, scans, daily/weekly/monthly metrics)
 * - Scan timeline chart with configurable time ranges
 * - Campaign distribution pie chart
 * - Top 5 performing ads with vertical bar chart (matching company style)
 * - Real-time activity feed
 * - Detailed campaign breakdown with QR code lists
 *
 * Data is filtered by the signed-in agent's ID through the backend API.
 * Auto-refreshes every 30 seconds to show live updates.
 */
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LabelList } from 'recharts';
import './QRAnalytics.css';

const QRAnalytics = () => {
  // Get the current authenticated user from context
  const { user } = useAuth();
  const navigate = useNavigate();

  // ============================================
  // State Management
  // ============================================

  // Loading state - shows spinner while fetching data
  const [loading, setLoading] = useState(true);

  // Overview statistics: total QRs, scans, daily/weekly/monthly counts
  const [overview, setOverview] = useState(null);

  // Campaign breakdown with scan counts per campaign
  const [campaigns, setCampaigns] = useState([]);

  // Top performing ads sorted by scan count (limited to 5)
  const [topQRs, setTopQRs] = useState([]);

  // Timeline data for the line chart showing scans over time
  const [timeline, setTimeline] = useState([]);

  // Recent scan activity from the last 24 hours
  const [realtimeData, setRealtimeData] = useState([]);

  // Error message to display if API calls fail
  const [error, setError] = useState('');

  // Selected time range for timeline chart (7, 30, or 90 days)
  const [selectedTimeRange, setSelectedTimeRange] = useState(30);

  // JWT token for authenticating API requests
  const token = localStorage.getItem('token');

  // Initialize analytics data and set up auto-refresh every 30 seconds
  useEffect(() => {
    loadAnalytics();
    const interval = setInterval(loadAnalytics, 30000);
    return () => clearInterval(interval);
  }, [selectedTimeRange]);

  /**
   * Fetches all analytics data from the backend API.
   * Makes parallel requests for overview, campaigns, top QRs, timeline, and realtime data.
   * Enriches the data with display-friendly fields like formatted ad IDs and titles.
   */
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
      
      if (topQRsData.success && topQRsData.topQRs) {
        const enrichedTopQRs = topQRsData.topQRs.map((qr, index) => {
          const adId = qr.adUniqueId || `AD${String(index + 1).padStart(3, '0')}`;
          
          let displayTitle;
          if (qr.adTitle && 
              qr.adTitle.trim() !== '' && 
              qr.adTitle !== 'ללא כותרת' &&
              qr.adTitle.toLowerCase() !== 'ללא כותרת') {
            displayTitle = qr.adTitle;
          } else {
            displayTitle = adId;
          }
          
          return {
            ...qr,
            displayTitle,
            displayAdId: adId
          };
        });
        console.log('Top QRs enriched:', enrichedTopQRs);
        setTopQRs(enrichedTopQRs);
      }
      
      if (timelineData.success) setTimeline(timelineData.timeline);
      
      if (realtimeDataRes.success && realtimeDataRes.recentScans) {
        const enrichedRealtime = realtimeDataRes.recentScans.map((scan, index) => {
          const adId = scan.adUniqueId || `AD${String(index + 1).padStart(3, '0')}`;
          
          let displayTitle;
          if (scan.adTitle && 
              scan.adTitle.trim() !== '' && 
              scan.adTitle !== 'ללא כותרת' &&
              scan.adTitle.toLowerCase() !== 'ללא כותרת') {
            displayTitle = scan.adTitle;
          } else {
            displayTitle = adId;
          }
          
          return {
            ...scan,
            displayTitle,
            displayAdId: adId,
            displayCampaign: scan.campaignTitle || 'ללא שם קמפיין'
          };
        });
        console.log('Realtime data enriched:', enrichedRealtime);
        setRealtimeData(enrichedRealtime);
      }

    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  // ============================================
  // Chart Configuration
  // ============================================

  // Color palette used across all charts for visual consistency.
  // These colors are applied to pie chart slices, bar chart bars,
  // and campaign cards to create a cohesive design.
  const COLORS = ['#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b', '#fa709a'];

  /**
   * Renders percentage labels inside pie chart slices.
   * Only displays label if the slice represents at least 3% to avoid clutter.
   */
  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }) => {
    if (percent * 100 < 3) return null;
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


  // Custom tooltip for pie chart showing campaign name and scan count
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

  // Custom tooltip for bar chart displaying ad details including title, ID, campaign, and scans
  const CustomBarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      const title = data.displayTitle || data.adTitle || 'Unnamed Ad';
      const adId = data.displayAdId || data.adUniqueId || 'N/A';
      
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
          <p style={{ margin: '3px 0', color: '#667eea', fontSize: '13px', fontFamily: 'monospace', fontWeight: 'bold' }}>
            <i className="fas fa-fingerprint" style={{ marginLeft: '5px' }}></i>
            מזהה: {adId}
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

          {/* Top 5 Ads - Card-based display matching company statistics style */}
          {topQRs.length > 0 && (
            <div className="analytics-section chart-section top5-section">
              <h2>
                <i className="fas fa-trophy"></i> 5 המודעות המובילות שלי
              </h2>
              <p className="section-subtitle">המודעות עם הביצועים הטובים ביותר מבין כל המודעות שלך</p>

              {/* Card-based Top 5 Layout - Matching company statistics style */}
              <div className="top5-cards-grid">
                {topQRs.slice(0, 5).map((qr, index) => {
                  const adId = qr.displayAdId || qr.adUniqueId || `AD${String(index + 1).padStart(3, '0')}`;
                  const title = qr.displayTitle || qr.adTitle || 'ללא שם';
                  const scans = qr.totalScans || 0;
                  const campaign = qr.campaignTitle || 'ללא קמפיין';
                  const rankColors = ['#667eea', '#764ba2', '#9b59b6', '#3498db', '#1abc9c'];
                  const rankIcons = ['🥇', '🥈', '🥉', '4️⃣', '5️⃣'];

                  return (
                    <div key={index} className="top5-ad-card" style={{ '--rank-color': rankColors[index] }}>
                      {/* Rank Badge */}
                      <div className="top5-rank-badge" style={{ background: rankColors[index] }}>
                        <span className="rank-icon">{rankIcons[index]}</span>
                        <span className="rank-number">#{index + 1}</span>
                      </div>

                      {/* Card Content */}
                      <div className="top5-card-content">
                        <div className="top5-card-header">
                          <h3 className="top5-ad-title">{title}</h3>
                          <span className="top5-ad-id">{adId}</span>
                        </div>

                        {/* Scans Display - Large number like company stats */}
                        <div className="top5-scans-display">
                          <div className="top5-scans-icon">
                            <i className="fas fa-eye"></i>
                          </div>
                          <div className="top5-scans-value">{scans.toLocaleString()}</div>
                          <div className="top5-scans-label">סריקות</div>
                        </div>

                        {/* Campaign Info */}
                        <div className="top5-campaign-info">
                          <i className="fas fa-bullhorn"></i>
                          <span>{campaign}</span>
                        </div>
                      </div>

                      {/* Color indicator bar at top - matching company style */}
                      <div className="top5-color-bar" style={{ background: rankColors[index] }}></div>
                    </div>
                  );
                })}
              </div>

              {/* Summary Bar Chart - Compact visual comparison */}
              <div className="top5-summary-chart">
                <h4><i className="fas fa-chart-bar"></i> השוואה ויזואלית</h4>
                <div className="top5-bars-container">
                  {topQRs.slice(0, 5).map((qr, index) => {
                    const maxScans = Math.max(...topQRs.slice(0, 5).map(q => q.totalScans || 0));
                    const scans = qr.totalScans || 0;
                    const percentage = maxScans > 0 ? (scans / maxScans) * 100 : 0;
                    const adId = qr.displayAdId || qr.adUniqueId || `AD${String(index + 1).padStart(3, '0')}`;
                    const rankColors = ['#667eea', '#764ba2', '#9b59b6', '#3498db', '#1abc9c'];

                    return (
                      <div key={index} className="top5-bar-row">
                        <span className="top5-bar-label">{adId}</span>
                        <div className="top5-bar-track">
                          <div
                            className="top5-bar-fill"
                            style={{
                              width: `${percentage}%`,
                              background: `linear-gradient(90deg, ${rankColors[index]} 0%, ${rankColors[index]}99 100%)`
                            }}
                          >
                            <span className="top5-bar-value">{scans.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
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
                <div key={scan.displayAdId || `scan-${index}`} className="realtime-item">
                  <div className="realtime-icon">
                    <i className="fas fa-ad"></i>
                  </div>
                  <div className="realtime-info">
                    <h4>{scan.displayTitle}</h4>
                    <p style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <span style={{ 
                        display: 'inline-flex',
                        alignItems: 'center',
                        background: '#667eea',
                        color: 'white',
                        padding: '3px 10px',
                        borderRadius: '5px',
                        fontSize: '12px',
                        fontFamily: 'monospace',
                        fontWeight: 'bold'
                      }}>
                        <i className="fas fa-fingerprint" style={{ marginLeft: '5px', fontSize: '11px' }}></i>
                        {scan.displayAdId}
                      </span>
                      <span style={{ color: '#888', display: 'flex', alignItems: 'center' }}>
                        <i className="fas fa-bullhorn" style={{ marginLeft: '5px', fontSize: '12px' }}></i>
                        {scan.displayCampaign}
                      </span>
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
                              <span>
                                {(qr.adTitle && qr.adTitle !== 'ללא כותרת') ? qr.adTitle : (qr.adUniqueId || 'N/A')}
                                {qr.adUniqueId && (
                                  <span style={{ 
                                    marginRight: '8px', 
                                    color: '#667eea', 
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    fontWeight: 'bold'
                                  }}>
                                    [{qr.adUniqueId}]
                                  </span>
                                )}
                              </span>
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