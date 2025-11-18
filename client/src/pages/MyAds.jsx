import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import './MyAds.css';

const CACHE_KEY = 'my_ads_data';
const CACHE_DURATION = 3 * 60 * 1000; // 3 דקות
const API_URL = process.env.REACT_APP_API_URL || 'https://adsmaker.onrender.com/api';

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

    // Facebook states
    const [fbConnected, setFbConnected] = useState(false);
    const [fbPages, setFbPages] = useState([]);
    const [selectedPage, setSelectedPage] = useState(null);
    const [publishingAdId, setPublishingAdId] = useState(null);
    const [showPageSelector, setShowPageSelector] = useState(false);
    const [adToPublish, setAdToPublish] = useState(null);
    const [adStats, setAdStats] = useState({}); // { adId: { likes, comments, shares, postId } }

    // ✅ אתחול Facebook SDK
    useEffect(() => {
        if (typeof window === 'undefined') return;

        window.fbAsyncInit = function() {
            window.FB.init({
                appId: process.env.REACT_APP_FB_APP_ID || '1173091168300518',
                cookie: true,
                xfbml: true,
                version: 'v20.0'
            });

            // בדיקה אם כבר מחובר
            window.FB.getLoginStatus(function(response) {
                if (response.status === 'connected') {
                    setFbConnected(true);
                    loadFacebookPages();
                }
            });
        };

        // טעינת הסקריפט
        if (!document.getElementById('facebook-jssdk')) {
            const js = document.createElement('script');
            js.id = 'facebook-jssdk';
            js.src = 'https://connect.facebook.net/en_US/sdk.js';
            document.body.appendChild(js);
        } else if (window.FB) {
            window.FB.getLoginStatus(function(response) {
                if (response.status === 'connected') {
                    setFbConnected(true);
                    loadFacebookPages();
                }
            });
        }
    }, []);

    // טעינת דפי פייסבוק
    const loadFacebookPages = () => {
        if (!window.FB) return;
        
        window.FB.api('/me/accounts', 'GET', {}, function(response) {
            if (response.data && response.data.length > 0) {
                setFbPages(response.data);
                setSelectedPage(response.data[0]);
            }
        });
    };

    // התחברות לפייסבוק
    const handleFacebookLogin = () => {
        if (!window.FB) {
            alert('Facebook SDK לא נטען. נסה לרענן את הדף.');
            return;
        }

        window.FB.login(
            (response) => {
                if (response.authResponse) {
                    setFbConnected(true);
                    loadFacebookPages();
                } else {
                    alert('ההתחברות לפייסבוק בוטלה');
                }
            },
            {
                scope: "pages_manage_posts,pages_read_engagement,pages_show_list,pages_read_user_content"
            }
        );
    };

    // פרסום מודעה לפייסבוק
    const publishToFacebook = async (ad) => {
        if (!fbConnected) {
            setAdToPublish(ad);
            handleFacebookLogin();
            return;
        }

        if (!selectedPage) {
            setAdToPublish(ad);
            setShowPageSelector(true);
            return;
        }

        setPublishingAdId(ad._id);

        try {
            const token = localStorage.getItem('token');
            
            // שליחה לשרת שיפרסם לפייסבוק
            const response = await fetch(`${API_URL}/facebook/publish`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    pageId: selectedPage.id,
                    pageToken: selectedPage.access_token,
                    message: `${ad.title}\n\n${ad.text}\n\n${ad.callToAction || 'למידע נוסף'}`,
                    // אם יש תמונה - אפשר להוסיף imageUrl
                })
            });

            const data = await response.json();

            if (data.success) {
                alert('✅ המודעה פורסמה בהצלחה לפייסבוק!');
                
                // שמירת ה-postId למעקב
                setAdStats(prev => ({
                    ...prev,
                    [ad._id]: {
                        postId: data.postId,
                        pageToken: selectedPage.access_token,
                        publishedAt: new Date().toISOString(),
                        likes: 0,
                        comments: 0,
                        shares: 0
                    }
                }));

                // שמירה ב-localStorage
                const savedStats = JSON.parse(localStorage.getItem('fb_ad_stats') || '{}');
                savedStats[ad._id] = {
                    postId: data.postId,
                    pageToken: selectedPage.access_token,
                    publishedAt: new Date().toISOString()
                };
                localStorage.setItem('fb_ad_stats', JSON.stringify(savedStats));

            } else {
                alert(`❌ שגיאה בפרסום: ${data.error}`);
            }
        } catch (error) {
            console.error('Error publishing to Facebook:', error);
            alert(`❌ שגיאה: ${error.message}`);
        } finally {
            setPublishingAdId(null);
        }
    };

    // קבלת סטטיסטיקות מפייסבוק
    const fetchAdStats = async (adId) => {
        const savedStats = JSON.parse(localStorage.getItem('fb_ad_stats') || '{}');
        const adData = savedStats[adId] || adStats[adId];
        
        if (!adData || !adData.postId) {
            return null;
        }

        try {
            const token = localStorage.getItem('token');
            
            const response = await fetch(`${API_URL}/facebook/post-stats`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    postId: adData.postId,
                    pageToken: adData.pageToken
                })
            });

            const data = await response.json();

            if (!data.error) {
                setAdStats(prev => ({
                    ...prev,
                    [adId]: {
                        ...prev[adId],
                        ...adData,
                        likes: data.likes,
                        comments: data.comments,
                        shares: data.shares,
                        lastUpdated: new Date().toISOString()
                    }
                }));
                return data;
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
        return null;
    };

    // טעינת סטטיסטיקות שמורות
    useEffect(() => {
        const savedStats = JSON.parse(localStorage.getItem('fb_ad_stats') || '{}');
        if (Object.keys(savedStats).length > 0) {
            setAdStats(savedStats);
        }
    }, []);

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
    }, [user, getToken]);

    const loadMyAds = useCallback(async () => {
        if (!isClient) return;
        
        setLoading(true);
        setError(null);

        try {
            const cachedData = getCachedData();
            if (cachedData) {
                setAllAds(cachedData.ads || []);
                setCampaigns(cachedData.campaigns || []);
                setLoading(false);
                
                fetchAdsWithImages()
                    .then(data => {
                        setAllAds(data.ads);
                        setCampaigns(data.campaigns);
                        setCachedData(data);
                    })
                    .catch(err => console.warn('Background refresh failed:', err));
                
                return;
            }

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
    }, [isClient, getCachedData, fetchAdsWithImages, setCachedData]);

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

    // Modal לבחירת דף פייסבוק
    const PageSelectorModal = () => {
        if (!showPageSelector) return null;

        return (
            <div className="modal-overlay" onClick={() => setShowPageSelector(false)}>
                <div className="modal-content" onClick={e => e.stopPropagation()}>
                    <h3>בחר דף פייסבוק</h3>
                    {fbPages.length === 0 ? (
                        <p>לא נמצאו דפים. וודא שיש לך הרשאות ניהול לדף.</p>
                    ) : (
                        <div className="page-list">
                            {fbPages.map(page => (
                                <button
                                    key={page.id}
                                    className={`page-option ${selectedPage?.id === page.id ? 'selected' : ''}`}
                                    onClick={() => {
                                        setSelectedPage(page);
                                        setShowPageSelector(false);
                                        if (adToPublish) {
                                            publishToFacebook(adToPublish);
                                            setAdToPublish(null);
                                        }
                                    }}
                                >
                                    {page.name}
                                </button>
                            ))}
                        </div>
                    )}
                    <button 
                        className="btn btn-secondary"
                        onClick={() => setShowPageSelector(false)}
                    >
                        ביטול
                    </button>
                </div>
            </div>
        );
    };

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

                {/* Facebook Connection Status */}
                <div className="fb-status-bar">
                    {fbConnected ? (
                        <div className="fb-connected">
                            <i className="fab fa-facebook"></i>
                            <span>מחובר לפייסבוק</span>
                            {selectedPage && <span className="page-name">| {selectedPage.name}</span>}
                            <button 
                                className="btn-link"
                                onClick={() => setShowPageSelector(true)}
                            >
                                החלף דף
                            </button>
                        </div>
                    ) : (
                        <button 
                            className="btn btn-facebook"
                            onClick={handleFacebookLogin}
                        >
                            <i className="fab fa-facebook"></i>
                            התחבר לפייסבוק
                        </button>
                    )}
                </div>

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

                                    {/* Facebook Stats */}
                                    {adStats[ad._id]?.postId && (
                                        <div className="fb-stats">
                                            <div className="stats-header">
                                                <i className="fab fa-facebook"></i>
                                                <span>ביצועים בפייסבוק</span>
                                                <button 
                                                    className="btn-refresh"
                                                    onClick={() => fetchAdStats(ad._id)}
                                                    title="רענן נתונים"
                                                >
                                                    <i className="fas fa-sync-alt"></i>
                                                </button>
                                            </div>
                                            <div className="stats-grid">
                                                <div className="stat-item">
                                                    <i className="fas fa-thumbs-up"></i>
                                                    <span>{adStats[ad._id]?.likes || 0}</span>
                                                    <small>לייקים</small>
                                                </div>
                                                <div className="stat-item">
                                                    <i className="fas fa-comment"></i>
                                                    <span>{adStats[ad._id]?.comments || 0}</span>
                                                    <small>תגובות</small>
                                                </div>
                                                <div className="stat-item">
                                                    <i className="fas fa-share"></i>
                                                    <span>{adStats[ad._id]?.shares || 0}</span>
                                                    <small>שיתופים</small>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
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
                                                {!adStats[ad._id]?.postId ? (
                                                    <button 
                                                        className="btn btn-facebook"
                                                        onClick={() => publishToFacebook(ad)}
                                                        disabled={publishingAdId === ad._id}
                                                    >
                                                        {publishingAdId === ad._id ? (
                                                            <>
                                                                <i className="fas fa-spinner fa-spin"></i> מפרסם...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <i className="fab fa-facebook"></i> פרסם
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button 
                                                        className="btn btn-facebook-published"
                                                        disabled
                                                    >
                                                        <i className="fas fa-check"></i> פורסם
                                                    </button>
                                                )}
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

            <PageSelectorModal />
        </div>
    );
};

export default MyAds;