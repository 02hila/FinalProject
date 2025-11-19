import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

// הסרנו את הייבוא: import PageSelectorModal from "./PageSelectorModal";
// הסרנו את הייבוא: import "./MyAds.css"; 

// הוספת סימולציה ל-AuthContext אם לא קיימת
const useAuth = () => ({ user: { token: "fake-token" } });

// רכיב PageSelectorModal משולב ישירות (סימולציה)
const PageSelectorModal = () => {
    // רכיב פשוט לצורך הדגמה, ניתן להרחיב אותו בעתיד
    return (
        <div style={{ paddingBottom: '20px', textAlign: 'center' }}>
            {/* כאן יהיה רכיב בחירת הדף בפועל */}
        </div>
    );
};


const MyAds = () => {
    // השתמשתי בסימולציה, החזר ל-useAuth המקורי אם אתה עובד בסביבה מלאה
    const { user } = useAuth(); 
    const navigate = useNavigate();
    const [ads, setAds] = useState([]);
    const [filteredAds, setFilteredAds] = useState([]);
    const [campaigns, setCampaigns] = useState([]);
    const [selectedCampaign, setSelectedCampaign] = useState("all");
    const [loading, setLoading] = useState(false); // שינוי ל-false לצורך סימולציה
    const [error, setError] = useState("");

    // --- נתונים מדומים לצורך הצגה ---
    const mockAds = [
        { _id: "1", title: "קמפיין סתיו 2024", text: "מודעת מכירות מבריקה וחדשנית.", status: 'approved', createdAt: new Date(Date.now() - 86400000).toISOString(), campaignId: { _id: "c1", title: "קמפיין סתיו" }, imageData: "https://placehold.co/400x220/4a90e2/ffffff?text=Ad+Image+1" },
        { _id: "2", title: "השקת מוצר חדש", text: "מודעה שתשנה את חוקי המשחק.", status: 'pending', createdAt: new Date(Date.now() - 172800000).toISOString(), campaignId: { _id: "c2", title: "מוצר חדש" }, imageData: null },
        { _id: "3", title: "אירוע בלעדי לחברי מועדון", text: "הזדמנות שלא תחזור שוב!", status: 'rejected', createdAt: new Date(Date.now() - 259200000).toISOString(), campaignId: { _id: "c1", title: "קמפיין סתיו" }, imageData: null },
        { _id: "4", title: "מבצע סוף עונה", text: "כל הפריטים עד 50% הנחה!", status: 'approved', createdAt: new Date().toISOString(), campaignId: { _id: "c2", title: "מוצר חדש" }, imageData: "https://placehold.co/400x220/5cb85c/ffffff?text=Ad+Image+4" },
    ];
    // ------------------------------------

    // ---- שליפת נתונים (סימולציה) ----
    useEffect(() => {
        setLoading(true);
        // סימולציה של שליפת נתונים מהשרת
        setTimeout(() => {
            setAds(mockAds);
            setFilteredAds(mockAds);
            const uniqueCampaigns = [...new Set(mockAds.map(ad => ad.campaignId?.title))].filter(Boolean);
            setCampaigns(mockAds.map(ad => ad.campaignId).filter(Boolean).filter((c, i, a) => a.findIndex(t => (t._id === c._id)) === i));

            setLoading(false);
        }, 500);
    }, []);

    // ---- סינון ----
    useEffect(() => {
        if (selectedCampaign === "all") {
            setFilteredAds(ads);
        } else {
            setFilteredAds(ads.filter(ad => ad.campaignId?._id === selectedCampaign));
        }
    }, [selectedCampaign, ads]);

    // ---- פונקציות עזר ----
    const getStatusData = (status) => {
        switch(status) {
            case 'approved': return { class: 'status-approved', text: 'מאושר' };
            case 'rejected': return { class: 'status-rejected', text: 'נדחה' };
            default: return { class: 'status-pending', text: 'ממתין' };
        }
    };

    const handleCardClick = (ad) => {
        // סימולציה של פתיחת תצוגה מלאה
        console.log(`לחיצה על כרטיס: פותח תצוגה מלאה עבור מודעה ID: ${ad._id}`);
        // כאן ניתן להפעיל פונקציה לפתיחת Modal או לניווט לעמוד פרטים
        // navigate(`/ad/${ad._id}`);
    };

    const downloadAd = (adId) => {
         // לוגיקת הורדה: מניעת הפצה לא מאושרת
        const ad = ads.find(a => a._id === adId);
        if (ad.status !== 'approved') {
            // הוחלף alert() ב-console.log בהתאם להנחיות
            console.log("לא ניתן להוריד מודעה לפני אישור");
            return;
        }

        // בפועל, פה היית מבצע קריאת API לקבלת Blob ופותח הורדה
        console.log(`הורדת מודעה ID: ${adId}`);
        // הקוד הישן שלך להורדה:
        /*
        try {
           const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/ads/download/${adId}`, {
               headers: { Authorization: `Bearer ${user?.token}` }
           });
           const blob = await res.blob();
           const url = window.URL.createObjectURL(blob);
           const a = document.createElement('a');
           a.href = url; a.download = `ad-${adId}.png`; a.click();
        } catch(e) { console.error(e); }
        */
    };

    const shareAd = (adId) => { 
        console.log(`שיתוף מודעה ID: ${adId}`);
        // הוחלף alert() ב-console.log בהתאם להנחיות
        console.log("פונקציית שיתוף תופעל בקרוב"); 
    };

    if (loading) return <div className="my-ads-page"><p>טוען...</p></div>;
    if (error) return <div className="my-ads-page"><p>שגיאה: {error}</p></div>;

    return (
        <div className="my-ads-page">
            <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css" />
            <style jsx>{`
                /* MyAds.css - הגרסה הסופית והמתוקנת */

                .my-ads-page {
                    background-color: #f8f9fa; /* רקע אפור בהיר לכל העמוד */
                    min-height: 100vh;
                    padding: 20px;
                    direction: rtl;
                    font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                }

                .container {
                    max-width: 1400px;
                    margin: 60px auto 0;
                }

                /* --- כפתור חזרה --- */
                .back-button {
                    position: fixed;
                    top: 20px;
                    right: 20px;
                    background: white;
                    border: 1px solid #e0e0e0;
                    padding: 10px 20px;
                    border-radius: 50px;
                    cursor: pointer;
                    font-weight: 600;
                    color: #333;
                    z-index: 1000;
                    box-shadow: 0 2px 5px rgba(0,0,0,0.05);
                    display: flex;
                    align-items: center;
                    /* סדר הפריטים מתאים לעברית (כפתור מימין לשמאל) */
                    gap: 8px;
                    font-size: 14px;
                }

                .back-button:hover {
                    background-color: #f0f0f0;
                }

                /* --- פילטר --- */
                .campaign-filter {
                    background: white;
                    padding: 15px 20px;
                    border-radius: 8px;
                    margin-bottom: 25px;
                    display: flex;
                    align-items: center;
                    gap: 15px;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                    border: 1px solid #eef0f2;
                }

                .campaign-filter label {
                    font-weight: 600;
                    color: #2d3748;
                }

                .campaign-filter select {
                    padding: 8px 12px;
                    border-radius: 6px;
                    border: 1px solid #ddd;
                    font-size: 14px;
                    background-color: #fff;
                    cursor: pointer;
                    outline: none;
                    min-width: 150px;
                }

                /* --- הגריד (3 עמודות) --- */
                .ads-grid {
                    display: grid;
                    grid-template-columns: repeat(3, 1fr); /* בדיוק 3 עמודות כמו בתמונה */
                    gap: 25px;
                    padding-bottom: 40px;
                }

                /* --- הכרטיס עצמו --- */
                .myads-item {
                    background: white;
                    border-radius: 12px;
                    overflow: hidden;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.06);
                    border: 1px solid #eaeaea;
                    display: flex;
                    flex-direction: column;
                    height: 100%;
                    transition: transform 0.2s, box-shadow 0.2s;
                    cursor: pointer; /* הוספת סמן עכבר לכל הכרטיס */
                }

                .myads-item:hover {
                    transform: translateY(-3px);
                    box-shadow: 0 8px 20px rgba(0,0,0,0.1);
                }

                /* --- חלק עליון: תמונה או מנעול --- */
                .ad-image-wrapper {
                    height: 220px; /* גובה קבוע לתמונה - קריטי! */
                    width: 100%;
                    background-color: #f3f4f6;
                    position: relative;
                    flex-shrink: 0;
                }

                .ad-image {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    display: block;
                }

                .ad-image-locked {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    color: #a0aec0;
                    background-color: #f1f5f9;
                    text-align: center;
                }

                .ad-image-locked i {
                    font-size: 48px;
                    margin-bottom: 10px;
                    color: #cbd5e0;
                }

                /* --- חלק תחתון: תוכן לבן --- */
                .ad-content {
                    padding: 15px;
                    display: flex;
                    flex-direction: column;
                    flex-grow: 1;
                    background: white;
                }

                .ad-title {
                    font-size: 17px; /* הוגדל מעט */
                    font-weight: 700;
                    color: #2d3748;
                    margin: 0 0 8px 0;
                    line-height: 1.4;
                }

                .ad-text {
                    font-size: 13px;
                    color: #718096;
                    margin-bottom: 15px;
                    line-height: 1.5;
                    /* מגביל ל-2 שורות */
                    display: -webkit-box;
                    -webkit-line-clamp: 2;
                    -webkit-box-orient: vertical;
                    overflow: hidden;
                }

                /* באדג'ים ומידע */
                .ad-meta-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: auto;
                    margin-bottom: 15px;
                    font-size: 12px;
                    color: #a0aec0;
                    border-top: 1px solid #f7fafc;
                    padding-top: 10px;
                }

                .status-badge {
                    padding: 3px 10px; /* הוגדל מעט */
                    border-radius: 4px;
                    font-weight: bold;
                    font-size: 12px; /* הוגדל מעט */
                }
                .status-approved { background: #def7ec; color: #03543f; } /* ירוק */
                .status-pending { background: #fff8e1; color: #b45309; } /* כתום */
                .status-rejected { background: #fde8e8; color: #9b1c1c; } /* אדום */

                /* --- כפתורים --- */
                .ad-actions {
                    display: flex;
                    gap: 10px;
                }

                .btn {
                    flex: 1;
                    border: none;
                    border-radius: 6px;
                    padding: 10px 0; /* פדינג מוגדל לנראות טובה יותר */
                    font-size: 14px; /* פונט מוגדל לנראות טובה יותר */
                    font-weight: 600;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 6px;
                    color: white;
                    transition: background-color 0.2s, box-shadow 0.2s;
                }

                .btn:hover { 
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                    opacity: 1;
                }

                .btn-share { background-color: #5cb85c; } /* ירוק */
                .btn-share:hover { background-color: #4cae4c; }

                .btn-download { background-color: #4a90e2; } /* כחול */
                .btn-download:hover { background-color: #3f7acb; }

                .btn-locked { background-color: #e2e8f0; color: #a0aec0; cursor: not-allowed; }

                /* רספונסיביות */
                @media (max-width: 1100px) {
                    .ads-grid { grid-template-columns: repeat(2, 1fr); }
                }
                @media (max-width: 700px) {
                    .ads-grid { grid-template-columns: 1fr; }
                    /* מוודא שהכפתורים ממלאים את הרוחב המלא בפריסת עמודה אחת */
                    .btn { padding: 12px 0; font-size: 16px; }
                }
            `}</style>

            {/* כפתור חזרה */}
            <button className="back-button" onClick={() => navigate("/dashboard")}>
                {/* שינוי האייקון ל-fa-arrow-right כדי להתאים לכיוון RTL */}
                חזרה לדשבורד <i className="fas fa-arrow-right"></i> 
            </button>

            <div className="container">
                {/* PageSelectorModal משולב */}
                <PageSelectorModal />

                <div className="campaign-filter">
                    <label>סנן לפי קמפיין:</label>
                    <select value={selectedCampaign} onChange={(e) => setSelectedCampaign(e.target.value)}>
                        <option value="all">כל הקמפיינים</option>
                        {campaigns.map(c => <option key={c._id} value={c._id}>{c.title}</option>)}
                    </select>
                </div>

                <div className="ads-grid">
                    {filteredAds.length === 0 ? (
                        <p style={{ gridColumn: '1/-1', textAlign: 'center', color: '#888', padding: '50px 0' }}>אין מודעות להצגה תחת סינון זה.</p>
                    ) : (
                        filteredAds.map((ad) => {
                            const statusInfo = getStatusData(ad.status);
                            const isApproved = ad.status === 'approved';
                            
                            // מניעת הפעלת הקליק על הכרטיס אם לחצו על אחד מהכפתורים
                            const handleActionClick = (e, action) => {
                                e.stopPropagation(); // מונע את הפעלת ה-handleCardClick
                                action(ad._id);
                            };

                            return (
                                <div key={ad._id} 
                                     className="myads-item"
                                     onClick={() => handleCardClick(ad)}> 
                                    
                                    {/* 1. אזור התמונה (למעלה) */}
                                    <div className="ad-image-wrapper">
                                        {isApproved && ad.imageData ? (
                                            <img src={ad.imageData} alt={ad.title} className="ad-image" loading="lazy" />
                                        ) : (
                                            <div className="ad-image-locked">
                                                <i className="fas fa-lock"></i>
                                                <div style={{fontWeight: 'bold', fontSize: '14px'}}>הורדה נעולה</div>
                                                <div style={{fontSize: '12px', marginTop: '4px'}}>התמונה תהיה זמינה לאחר אישור</div>
                                            </div>
                                        )}
                                    </div>

                                    {/* 2. אזור התוכן הלבן (למטה) */}
                                    <div className="ad-content">
                                        <h3 className="ad-title">{ad.title || "ללא כותרת"}</h3>
                                        <p className="ad-text">{ad.text || "אין טקסט למודעה זו..."}</p>
                                        
                                        <div className="ad-meta-row">
                                            <span className={`status-badge ${statusInfo.class}`}>
                                                {statusInfo.text}
                                                {isApproved && <i className="fas fa-check" style={{marginRight:'4px'}}></i>}
                                            </span>
                                            <span>{new Date(ad.createdAt).toLocaleDateString('he-IL')}</span>
                                            <span style={{fontWeight: '600'}}>{ad.campaignId?.title}</span>
                                        </div>

                                        {/* כפתורי הפעולה - תמיד גלויים */}
                                        <div className="ad-actions">
                                            {isApproved ? (
                                                <>
                                                    <button className="btn btn-share" onClick={(e) => handleActionClick(e, shareAd)}>
                                                        <i className="fas fa-share"></i> שתף
                                                    </button>
                                                    <button className="btn btn-download" onClick={(e) => handleActionClick(e, downloadAd)}>
                                                        <i className="fas fa-download"></i> הורד
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button className="btn btn-locked" onClick={(e) => e.stopPropagation()} disabled>
                                                        <i className="fas fa-share"></i> שתף
                                                    </button>
                                                    <button className="btn btn-locked" onClick={(e) => e.stopPropagation()} disabled>
                                                        <i className="fas fa-download"></i> הורד
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default MyAds;