import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyAds.css';

const CACHE_KEY = 'my_ads_data';
const CACHE_DURATION = 3 * 60 * 1000; // 3 דקות

const MyAds = () => {
    const navigate = useNavigate();
    const { user } = useAuth();
    const [allAds, setAllAds] = useState([]);
    const [filteredAds, setFilteredAds] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedCampaign, setSelectedCampaign] = useState('all');
    const [isClient, setIsClient] = useState(false);

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

    // ✅ הבטחת תאימות SSR
    useEffect(() => {
        setIsClient(true);
    }, []);

    const getToken = useCallback(() => {
        if (typeof window === 'undefined') return null;
        return localStorage.getItem('token');
    }, []);

    const getCachedData = useCallback(() => {
        if (typeof window === 'undefined' || !localStorage) return null;
        
        try {
            const cached = localStorage.getItem(CACHE_KEY);
            if (!cached) return null;

            const { data, timestamp } = JSON.parse(cached);
            if (Date.now() - timestamp < CACHE_DURATION) {
                return data;
            }
            // מחק cache ישן
            localStorage.removeItem(CACHE_KEY);
        } catch (e) {
            console.warn('Cache parse failed:', e);
            localStorage.removeItem(CACHE_KEY);
        }
        return null;
    }, []);

    const setCachedData = useCallback((data) => {
        if (typeof window === 'undefined' || !localStorage) return;
        
        try {
            // שמור ללא תמונות כדי לחסוך מקום
            const adsForCache = data.ads.map(({ imageData, ...rest }) => rest);
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                data: { 
                    ads: adsForCache,
                    campaigns: data.campaigns 
                },
                timestamp: Date.now()
            }));
        } catch (cacheError) {
            console.warn('Cache save failed:', cacheError);
        }
    }, []);

    const fetchAdsWithImages = useCallback(async () => {
        const token = getToken();
        if (!token) {
            throw new Error('No authentication token');
        }

        if (!user?._id && !user?.id) {
            throw new Error('User not loaded');
        }

        const agentId = user._id || user.id;

        const [campaignsResponse, adsResponse] = await Promise.all([
            fetch(`${API_URL}/campaigns/agent/${agentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            }),
            fetch(`${API_URL}/pending-ads?agentId=${agentId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
        ]);

        if (!campaignsResponse.ok) {
            const error = await campaignsResponse.json();
            throw new Error(error.message || 'Failed to fetch campaigns');
        }

        if (!adsResponse.ok) {
            const error = await adsResponse.json();
            throw new Error(error.message || 'Failed to fetch ads');
        }

        const [campaignsData, adsData] = await Promise.all([
            campaignsResponse.json(),
            adsResponse.json()
        ]);

        const ads = Array.isArray(adsData.ads) ? adsData.ads : [];
        const campaignsArray = Array.isArray(campaignsData.campaigns) ? campaignsData.campaigns : [];

        return { ads, campaigns: campaignsArray };
    }, [user, API_URL, getToken]);

    const loadMyAds = useCallback(async () => {
        if (!isClient) return;
        
        setLoading(true);
        setError(null);

        try {
            // בדוק cache קודם
            const cachedData = getCachedData();
            if (cachedData) {
                setAllAds(cachedData.ads || []);
                setCampaigns(cachedData.campaigns || []);
                setLoading(false);
                
                // טען תמונות ברקע
                fetchAdsWithImages()
                    .then(data => {
                        setAllAds(data.ads);
                        setCampaigns(data.campaigns);
                        setCachedData(data);
                    })
                    .catch(err => console.warn('Background refresh failed:', err));
                
                return;
            }

            // אין cache - טען הכל
            const data = await fetchAdsWithImages();
            setAllAds(data.ads);
            setCampaigns(data.campaigns);
            setCachedData(data);

        } catch (error) {
            console.error('Error loading ads:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [isClient, user, getCachedData, fetchAdsWithImages, setCachedData]);

    // ✅ בדיקת אימות והפניה
    useEffect(() => {
        if (!isClient) return;

        const token = getToken();
        if (!token) {
            alert('נדרש להתחבר תחילה');
            navigate('/login');
            return;
        }
        
        if (user) {
            loadMyAds();
        }
    }, [isClient, user, navigate, loadMyAds, getToken]);

    // ✅ סינון מודעות
    useEffect(() => {
        if (selectedCampaign === 'all') {
            setFilteredAds(allAds);
        } else {
            setFilteredAds(allAds.filter(ad => 
                (ad.campaignId?._id || ad.campaignId) === selectedCampaign
            ));
        }
    }, [selectedCampaign, allAds]);

    const downloadAd = async (adId) => {
        const token = getToken();
        if (!token) {
            alert('❌ נדרש להתחבר מחדש');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/pending-ads/${adId}/download`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                const data = await response.json();
                alert('🔒 ' + (data.error || 'שגיאה בהורדה'));
                return;
            }

            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `ad-${adId}.png`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);

            alert('✅ התמונה הורדה בהצלחה!');
        } catch (error) {
            console.error('Error downloading ad:', error);
            alert('❌ שגיאה בהורדת התמונה: ' + error.message);
        }
    };

    const shareAd = (adId) => {
        const ad = allAds.find(a => a._id === adId);
        if (!ad) return;

        const url = `${window.location.origin}/ad/${adId}`;

        if (navigator.share) {
            navigator.share({
                title: ad.title || 'מודעה',
                text: ad.text || '',
                url: url
            }).catch(err => {
                if (err.name !== 'AbortError') {
                    console.error('Error sharing:', err);
                    fallbackCopy(url);
                }
            });
        } else {
            fallbackCopy(url);
        }
    };

    const fallbackCopy = (url) => {
        if (navigator.clipboard) {
            navigator.clipboard.writeText(url)
                .then(() => alert('✅ הקישור הועתק ללוח!'))
                .catch(() => alert('❌ שגיאה בהעתקה'));
        } else {
            alert('❌ דפדפן לא תומך בהעתקה אוטומטית');
        }
    };

    const getStatusText = (status) => {
        const statusMap = {
            'pending': '⏳ ממתין לאישור',
            'approved': '✅ מאושר',
            'rejected': '❌ נדחה'
        };
        return statusMap[status] || status;
    };

    const getStatusClass = (status) => {
        return `status-badge status-${status}`;
    };

    const getCampaignTitle = (ad) => {
        if (typeof ad.campaignId === 'string') {
            const campaign = campaigns.find(c => c._id === ad.campaignId);
            return campaign?.title || 'לא צוין';
        }
        return ad.campaignId?.title || 'לא צוין';
    };

    // ✅ אם לא בצד לקוח עדיין - הצג loader
    if (!isClient) {
        return (
            <div className="my-ads-page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>טוען...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="my-ads-page">
                <div className="container">
                    <div className="loading">
                        <div className="spinner"></div>
                        <p>טוען מודעות...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="my-ads-page">
                <div className="container">
                    <div className="empty-state">
                        <i className="fas fa-exclamation-triangle"></i>
                        <h3>שגיאה בטעינת המודעות</h3>
                        <p>{error}</p>
                        <button 
                            className="btn btn-primary" 
                            onClick={() => loadMyAds()}
                            style={{ marginTop: '20px' }}
                        >
                            נסה שוב
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="my-ads-page">
            <div className="container">
                <button className="back-button" onClick={() => navigate('/agent-dashboard')}>
                    <i className="fas fa-arrow-right"></i>
                    חזרה לדשבורד
                </button>

                <h1 className="page-title">
                    <i className="fas fa-images"></i>
                    המודעות שלי
                </h1>

                <div className="filters">
                    <div className="filter-group">
                        <label>סנן לפי קמפיין:</label>
                        <select 
                            value={selectedCampaign}
                            onChange={(e) => setSelectedCampaign(e.target.value)}
                        >
                            <option value="all">כל הקמפיינים ({allAds.length})</option>
                            {campaigns.map(campaign => (
                                <option key={campaign._id} value={campaign._id}>
                                    {campaign.title}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {filteredAds.length === 0 ? (
                    <div className="empty-state">
                        <i className="fas fa-paint-brush"></i>
                        <h3>
                            {selectedCampaign === 'all' 
                                ? 'עדיין לא יצרת מודעות' 
                                : 'אין מודעות בקמפיין זה'
                            }
                        </h3>
                        <p>המודעות שיצרת יופיעו כאן</p>
                    </div>
                ) : (
                    <div className="ads-grid">
                        {filteredAds.map(ad => (
                            <div key={ad._id} className="ad-card">
                                {ad.status === 'approved' && ad.imageData ? (
                                    <img 
                                        src={ad.imageData} 
                                        alt={ad.title || 'מודעה'} 
                                        className="ad-image"
                                        loading="lazy"
                                    />
                                ) : (
                                    <div className="ad-image-locked">
                                        <i className={`fas ${
                                            ad.status === 'pending' ? 'fa-clock' : 
                                            ad.status === 'rejected' ? 'fa-times-circle' : 
                                            'fa-lock'
                                        }`}></i>
                                        <p><strong>
                                            {ad.status === 'pending' ? 'ממתין לאישור' : 
                                             ad.status === 'rejected' ? 'מודעה נדחתה' :
                                             'הורדה נעולה'}
                                        </strong></p>
                                        <p>
                                            {ad.status === 'pending' 
                                                ? 'התמונה תהיה זמינה לאחר אישור'
                                                : ad.status === 'rejected'
                                                ? 'המודעה לא אושרה על ידי המנהל'
                                                : 'התמונה זמינה רק למודעות מאושרות'
                                            }
                                        </p>
                                    </div>
                                )}
                                
                                <div className="ad-content">
                                    <div className="ad-title">{ad.title || 'ללא כותרת'}</div>
                                    <div className="ad-text">{ad.text || 'ללא טקסט'}</div>
                                    
                                    <div className="ad-meta">
                                        <span className={getStatusClass(ad.status)}>
                                            {getStatusText(ad.status)}
                                        </span>
                                        <div><strong>קמפיין:</strong> {getCampaignTitle(ad)}</div>
                                        <div><strong>תאריך יצירה:</strong> {
                                            new Date(ad.createdAt).toLocaleDateString('he-IL')
                                        }</div>
                                    </div>
                                    
                                    <div className="ad-actions">
                                        {ad.status === 'approved' ? (
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
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default MyAds;