import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const CACHE_KEY = 'ad_generator_data';
const CACHE_DURATION = 5 * 60 * 1000; // 5 דקות
const FETCH_TIMEOUT = 30000; // 30 שניות
const MAX_RETRIES = 2; // סה"כ 3 ניסיונות (ניסיון מקורי + 2 חוזרים)

const AdGenerator = () => {
    const { user } = useAuth();
    const [currentStep, setCurrentStep] = useState(1);
    const [myCompanies, setMyCompanies] = useState([]);
    const [myCampaigns, setMyCampaigns] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [selectedCompany, setSelectedCompany] = useState(null);
    const [selectedCampaign, setSelectedCampaign] = useState(null);
    const [loading, setLoading] = useState(false);
    const [generatedAd, setGeneratedAd] = useState(null);
    const [error, setError] = useState('');
    const [retryCount, setRetryCount] = useState(0);

    const [formData, setFormData] = useState({
        productService: '',
        keyMessage: '',
        tone: 'friendly',
        language: 'Hebrew',
        adStyle: 'modern',
        imageFile: null
    });

    const API_URL = 'https://adsmaker.onrender.com/api';
    const token = localStorage.getItem('token');

    // Effect לטעינת נתונים ראשונית
    useEffect(() => {
        if (user?._id) {
            loadMyCompaniesAndCampaigns();
        }
    }, [user]);
// 🔍 Debug: עקוב אחרי שינויים ב-generatedAd
useEffect(() => {
    console.log('🔔 generatedAd changed:', generatedAd);
    if (generatedAd) {
        console.log('✅ Ad is ready to display!');
        console.log('   - Text:', generatedAd.text ? '✓' : '✗');
        console.log('   - Image:', (generatedAd.imageUrl || generatedAd.finalImageUrl || generatedAd.imageBase64) ? '✓' : '✗');
        console.log('   - imageUrl:', generatedAd.imageUrl ? 'exists' : 'missing');
    }
}, [generatedAd]);
// 🔍 Debug: עקוב אחרי שינויים ב-loading
useEffect(() => {
    console.log('🔄 loading changed:', loading);
}, [loading]);

// 🔍 Debug: עקוב אחרי שינויים ב-currentStep
useEffect(() => {
    console.log('📍 currentStep changed:', currentStep);
}, [currentStep]);
    // ✅ פונקציה כללית עם retry logic
    const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
        for (let i = 0; i <= retries; i++) {
            try {
                if (url.includes('/campaigns/agent')) {
                    setRetryCount(i);
                }
                console.log(`🔄 Attempt ${i + 1}/${retries + 1} - Fetching:`, url);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    // זורק שגיאה עם קוד סטטוס לטיפול בבלוק ה-catch
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('✅ Success on attempt', i + 1);
                setRetryCount(0); // איפוס מונה ניסיונות מוצלח
                return data;
                
            } catch (error) {
                console.warn(`⚠️ Attempt ${i + 1} failed:`, error.message);
                
                if (i === retries) {
                    throw error; // נכשל אחרי כל הניסיונות
                }
                
                // המתן לפני ניסיון נוסף (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1) + Math.random() * 500));
            }
        }
    };

    const loadMyCompaniesAndCampaigns = async () => {
        setDataLoading(true);
        setError('');
        setRetryCount(0);
        
        try {
            // ✅ בדיקת cache
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    console.log('💾 Using cached data');
                    setMyCampaigns(data.campaigns);
                    setMyCompanies(data.companies);
                    setDataLoading(false);
                    return;
                }
            }

            console.log('🔍 Fetching campaigns for agent:', user._id);

            // ✅ קריאה עם retry לטיפול ב-404 או שגיאות שרת
            const campaignsData = await fetchWithRetry(
                // ✅ ה-URL הנכון ל-API
                `${API_URL}/campaigns/agent/${user._id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            console.log('✅ Campaigns data received:', campaignsData);

            if (campaignsData.success && campaignsData.campaigns) {
                const campaigns = campaignsData.campaigns || [];
                setMyCampaigns(campaigns);
                
                // ✅ חלץ חברות ייחודיות
                const uniqueCompanies = campaigns.reduce((acc, campaign) => {
                    const company = campaign.companyId;
                    // ודא שזה אובייקט ולא רק ID מחרוזתי, ושהחברה עדיין לא ברשימה
                    if (company && typeof company === 'object' && !acc.find(c => c._id === company._id)) {
                        acc.push(company);
                    }
                    return acc;
                }, []);
                
                setMyCompanies(uniqueCompanies);

                // ✅ שמור ב-cache
                localStorage.setItem(CACHE_KEY, JSON.stringify({
                    data: { campaigns, companies: uniqueCompanies },
                    timestamp: Date.now()
                }));
                
                console.log(`✅ Loaded ${campaigns.length} campaigns, ${uniqueCompanies.length} companies`);
            } else {
                console.warn('⚠️ No campaigns found or success: false');
                setMyCampaigns([]);
                setMyCompanies([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            
            let errorMessage = 'שגיאה כללית בטעינת קמפיינים. ';
            
            if (error.name === 'AbortError') {
                errorMessage = 'הבקשה לקחה יותר מדי זמן (Timeout). נסה שוב.';
            } else if (error.message.includes('404')) {
                // ✅ טיפול מפורש בשגיאת 404
                errorMessage = 'שגיאת 404: השרת לא מצא את הקמפיינים שלך. בדוק הגדרות API או פנה למנהל.';
            } else if (error.message.includes('401')) {
                errorMessage = 'אימות נכשל (401). אנא התחבר מחדש.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'בעיית רשת/חיבור. בדוק את החיבור לאינטרנט.';
            } else {
                errorMessage = `שגיאה: ${error.message}`;
            }
            
            setError(errorMessage);
            setMyCampaigns([]);
            setMyCompanies([]);
        } finally {
            setDataLoading(false);
            setRetryCount(0);
        }
    };

    const handleCompanyChange = (companyId) => {
        const company = myCompanies.find(c => c._id === companyId);
        setSelectedCompany(company);
        setSelectedCampaign(null);
    };

    const handleCampaignChange = (campaignId) => {
        const campaign = myCampaigns.find(c => c._id === campaignId);
        setSelectedCampaign(campaign);
        
        if (campaign) {
            autoFillFields(campaign);
        }
    };

    const autoFillFields = (campaign) => {
        setFormData(prev => ({
            ...prev,
            productService: campaign.description || prev.productService,
            // מילוי שדה הודעה מרכזית משדות קמפיין
            keyMessage: `${campaign.title} - ${campaign.description || ''}`,
        }));
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({ ...prev, imageFile: file }));
        }
    };

    const nextStep = () => {
        if (currentStep === 1) {
            if (!selectedCompany || !selectedCampaign) {
                alert('אנא בחר חברה וקמפיין');
                return;
            }
            setCurrentStep(2);
        } else if (currentStep === 2) {
            // הוספת בדיקה קטנה יותר לפני שליחה
            if (!formData.productService || !formData.keyMessage) {
                alert('אנא מלא את כל השדות הנדרשים (מוצר/שירות והודעה מרכזית)');
                return;
            }
            generateAd();
        }
    };

    const previousStep = () => {
        if (currentStep > 1) setCurrentStep(currentStep - 1);
    };
const generateAd = async () => {
    setCurrentStep(3);
    setLoading(true);
    setError('');
    setGeneratedAd(null); // 🔴 נקה קודם

    try {
        const formDataToSend = new FormData();
        
        formDataToSend.append('businessName', selectedCompany.companyName || selectedCompany.fullName);
        formDataToSend.append('productService', formData.productService);
        formDataToSend.append('targetAudience', selectedCampaign.targetAudience || selectedCompany.targetDemographics || '');
        formDataToSend.append('keyMessage', formData.keyMessage);
        formDataToSend.append('tone', formData.tone);
        formDataToSend.append('adStyle', formData.adStyle);
        formDataToSend.append('language', formData.language);
        formDataToSend.append('companyId', selectedCompany._id);
        formDataToSend.append('campaignId', selectedCampaign._id);
        formDataToSend.append('agentId', user._id || user.id);
        formDataToSend.append('websiteUrl', selectedCampaign.websiteUrl || '');
        
        if (formData.imageFile) {
            formDataToSend.append('image', formData.imageFile);
        }

        console.log('🎨 Generating ad...');

        const data = await fetchWithRetry(
            `${API_URL}/generate-ad`,
            {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: formDataToSend
            },
            1
        );

        console.log('✅ Ad generated:', data);
        console.log('📦 Full response structure:', JSON.stringify(data, null, 2));

        // ✅ חלץ את המודעה מהתגובה
        // ✅ חלץ את המודעה מהתגובה
let adData = null;

if (data.success && data.adData) {
    console.log('✅ Found ad in data.adData');
    adData = data.adData;
} else if (data.success && data.ad) {
    console.log('✅ Found ad in data.ad');
    adData = data.ad;
} else if (data.adData) {
    console.log('✅ Found adData without success flag');
    adData = data.adData;
} else if (data.ad) {
    console.log('✅ Found ad without success flag');
    adData = data.ad;
} else if (data.success) {
    console.log('✅ Using full response as ad');
    adData = data;
} else {
    console.error('❌ No valid ad data found in response');
    throw new Error(data.error || data.message || 'שגיאה ביצירת המודעה');
}

console.log('💾 adData extracted:', adData);
console.log('📝 Text:', adData.text);
console.log('🖼️ Image:', adData.imageUrl || adData.finalImageUrl || adData.imageBase64);
        console.log('💾 Setting ad data:', adData);

// 🟢 עדכן את ה-state
setGeneratedAd(adData);

// ✅ עצור טעינה אחרי 200ms (זמן שמאפשר ל-React לרנדר)
setTimeout(() => {
    setLoading(false);
    console.log('✅ Loading stopped. Component should re-render now.');
}, 200); // 🔴 שינוי מ-100 ל-200ms
        
    } catch (error) {
        console.error('❌ Generate ad error:', error);
        
        let errorMessage = 'שגיאה ביצירת המודעה';
        
        if (error.name === 'AbortError') {
            errorMessage = 'יצירת המודעה לקחה יותר מדי זמן. נסה שוב.';
        } else {
            errorMessage = error.message;
        }
        
        setError(errorMessage);
        alert(errorMessage);
        setLoading(false); // 🔴 גם בשגיאה, עצור טעינה
    }
};

    // ✅ כפתור לנסות שוב
    const handleRetry = () => {
        setError('');
        // מפעיל מחדש את הטעינה מ-loadMyCompaniesAndCampaigns
        loadMyCompaniesAndCampaigns(); 
    };

    if (!user) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>טוען משתמש...</p>
            </div>
        );
    }

    const websiteUrl = generatedAd?.websiteUrl || selectedCampaign?.websiteUrl || '';

    return (
        <div style={styles.container}>
            <Link to="/agent-dashboard" style={styles.backButton}>
                <i className="fas fa-arrow-right"></i> חזרה לדשבורד
            </Link>

            <div style={styles.wizard}>
                <div style={styles.header}>
                    <h1 style={styles.title}>מחולל המודעות</h1>
                    <p style={styles.subtitle}>צרו מודעות מבוססות AI בכמה צעדים פשוטים</p>
                </div>

                {/* Progress Bar */}
                <div style={styles.progressContainer}>
                    {[1, 2, 3].map((step) => (
                        <div key={step} style={styles.progressStep}>
                            <div style={{
                                ...styles.stepCircle,
                                ...(currentStep >= step ? styles.stepCircleActive : {})
                            }}>
                                {step}
                            </div>
                            <div style={styles.stepLabel}>
                                {step === 1 && 'בחר קמפיין'}
                                {step === 2 && 'פרטי המודעה'}
                                {step === 3 && 'תצוגה מקדימה'}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Error Banner עם כפתור retry */}
                {error && (currentStep < 3 || (currentStep === 3 && !loading)) && (
                    <div style={styles.errorBanner}>
                        <div>
                            <i className="fas fa-exclamation-circle"></i> {error}
                        </div>
                        {/* הצגת כפתור Retry רק בשלב 1 (טעינת נתונים) */}
                        {currentStep === 1 && ( 
                            <button onClick={handleRetry} style={styles.retryButton}>
                                <i className="fas fa-redo"></i> נסה שוב
                            </button>
                        )}
                    </div>
                )}

                {/* Step 1 */}
                {currentStep === 1 && (
                    <div style={styles.stepPanel}>
                        {dataLoading ? (
                            <div style={styles.loadingContainer}>
                                <div style={styles.spinner}></div>
                                <p style={styles.loadingText}>
                                    טוען קמפיינים... 
                                    {retryCount > 0 && `(ניסיון חוזר ${retryCount + 1}/${MAX_RETRIES + 1})`}
                                </p>
                                <p style={{fontSize: '13px', color: '#999', marginTop: '10px'}}>
                                    הטעינה הראשונה יכולה לקחת עד 30 שניות
                                </p>
                            </div>
                        ) : myCampaigns.length === 0 && !error ? (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>📭</div>
                                <h3>אין לך קמפיינים פעילים</h3>
                                <p>פנה למנהל כדי להוסיף אותך לקמפיינים</p>
                                <Link to="/my-campaigns" style={styles.primaryButton}>
                                    לקמפיינים שלי
                                </Link>
                            </div>
                        ) : myCampaigns.length > 0 ? (
                            <>
                                <h2 style={styles.sectionTitle}>
                                    <i className="fas fa-bullhorn"></i> שלב 1: בחירת קמפיין
                                </h2>
                                
                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        בחירת חברה <span style={styles.required}>*</span>
                                    </label>
                                    <select 
                                        style={styles.select}
                                        value={selectedCompany?._id || ''} 
                                        onChange={(e) => handleCompanyChange(e.target.value)}
                                    >
                                        <option value="">בחר חברה</option>
                                        {myCompanies.map(company => (
                                            <option key={company._id} value={company._id}>
                                                {company.companyName || company.fullName}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                <div style={styles.formGroup}>
                                    <label style={styles.label}>
                                        בחר/י קמפיין <span style={styles.required}>*</span>
                                    </label>
                                    <select 
                                        style={styles.select}
                                        value={selectedCampaign?._id || ''} 
                                        onChange={(e) => handleCampaignChange(e.target.value)}
                                        disabled={!selectedCompany}
                                    >
                                        <option value="">בחר קמפיין</option>
                                        {myCampaigns
                                            .filter(c => {
                                                const campaignCompanyId = c.companyId?._id || c.companyId;
                                                return campaignCompanyId === selectedCompany?._id;
                                            })
                                            .map(campaign => (
                                                <option key={campaign._id} value={campaign._id}>
                                                    {campaign.title}
                                                </option>
                                            ))
                                        }
                                    </select>
                                </div>

                                {selectedCampaign && (
                                    <div style={styles.campaignInfo}>
                                        <h4>📊 פרטי הקמפיין:</h4>
                                        <p><strong>תיאור:</strong> {selectedCampaign.description || 'אין תיאור'}</p>
                                        <p><strong>קהל יעד:</strong> {selectedCampaign.targetAudience || 'לא צוין'}</p>
                                        <p><strong>תקציב:</strong> ₪{(selectedCampaign.budget || 0).toLocaleString()}</p>
                                        {selectedCampaign.websiteUrl && (
                                            <p><strong>אתר:</strong> {selectedCampaign.websiteUrl}</p>
                                        )}
                                    </div>
                                )}
                            </>
                        ) : null}
                    </div>
                )}

                {/* Step 2 - פרטי המודעה */}
                {currentStep === 2 && (
                    <div style={styles.stepPanel}>
                        <h2 style={styles.sectionTitle}>
                            <i className="fas fa-edit"></i> שלב 2: פרטי המודעה
                        </h2>
                        
                        <div style={styles.formGroup}>
                            <label style={styles.label}>מה המוצר/שירות/מבצע?</label>
                            <input
                                style={styles.input}
                                type="text"
                                name="productService"
                                value={formData.productService}
                                onChange={handleInputChange}
                                placeholder="לדוגמה: הנחה של 20% על כל הדגמים"
                            />
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>מה ההודעה המרכזית שחשוב להדגיש?</label>
                            <textarea
                                style={styles.textarea}
                                name="keyMessage"
                                value={formData.keyMessage}
                                onChange={handleInputChange}
                                placeholder="לדוגמה: הדגשה על טריות, מחיר מיוחד, שירות אישי"
                            />
                        </div>

                        <div style={styles.formRow}>
                            <div style={{...styles.formGroup, flex: 1}}>
                                <label style={styles.label}>סגנון (Tone of Voice)</label>
                                <select style={styles.select} name="tone" value={formData.tone} onChange={handleInputChange}>
                                    <option value="friendly">ידידותי</option>
                                    <option value="professional">מקצועי</option>
                                    <option value="exciting">מרגש</option>
                                    <option value="casual">קז'ואל</option>
                                    <option value="urgent">דחוף</option>
                                </select>
                            </div>

                            <div style={{...styles.formGroup, flex: 1}}>
                                <label style={styles.label}>שפת המודעה</label>
                                <select style={styles.select} name="language" value={formData.language} onChange={handleInputChange}>
                                    <option value="Hebrew">עברית</option>
                                    <option value="English">English</option>
                                    <option value="Arabic">العربية</option>
                                </select>
                            </div>
                        </div>
                        
                        <div style={styles.formGroup}>
                            <label style={styles.label}>סגנון עיצובי</label>
                            <select style={styles.select} name="adStyle" value={formData.adStyle} onChange={handleInputChange}>
                                <option value="modern">🎨 מודרני ונועז</option>
                                <option value="minimal">⚡ מינימליסטי</option>
                                <option value="elegant">✨ אלגנטי ומעודן</option>
                                <option value="dark">🌙 כהה ומסתורי</option>
                            </select>
                        </div>

                        <div style={styles.formGroup}>
                            <label style={styles.label}>העלאת תמונה (אופציונלי)</label>
                            <input
                                style={styles.input}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                            <small style={styles.hint}>
                                📸 העלה תמונה משלך או שנמצא אחת אוטומטית
                            </small>
                        </div>
                    </div>
                )}

                {/* Step 3 - תצוגה מקדימה ותוצאות */}
 {/* Step 3 - תצוגה מקדימה ותוצאות */}
{currentStep === 3 && (
    <div style={styles.stepPanel}>
        {console.log('🎬 Step 3 Render:', { loading, error, hasAd: !!generatedAd })}
        
        {loading ? (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                    <p style={{...styles.loadingText, fontWeight: 'bold', fontSize: '18px'}}>
                        🎨 יוצר את המודעה שלך...
                    </p>
                    <p style={{fontSize: '14px', color: '#666'}}>
                        זה יכול לקחת 10-30 שניות
                    </p>
                    {selectedCampaign?.websiteUrl && (
                        <p style={{color: '#667eea', fontWeight: 'bold', marginTop: '15px'}}>
                            ⏳ יוצר QR code...
                        </p>
                    )}
                </div>
            </div>
        ) : error && !generatedAd ? (
            <div style={styles.errorState}>
                <div style={styles.errorIcon}>❌</div>
                <h3 style={{color: '#c33', marginBottom: '10px'}}>שגיאה ביצירת המודעה</h3>
                <p style={{color: '#666', marginBottom: '20px'}}>{error}</p>
                <button 
                    style={styles.primaryButton} 
                    onClick={() => {
                        setError('');
                        setCurrentStep(2);
                    }}
                >
                    <i className="fas fa-redo"></i> נסה שוב
                </button>
            </div>
        ) : generatedAd ? (
                            <div style={styles.result}>
                                <span style={styles.successBadge}>✓ המודעה נוצרה בהצלחה!</span>
                                <h2 style={{...styles.sectionTitle, justifyContent: 'center'}}>
                                    המודעה המקצועית שלך מוכנה!
                                </h2>
                                
                                <div style={styles.generatedText}>
    <strong>טקסט שיווקי:</strong><br /><br />
    {generatedAd.text || generatedAd.adData?.text || 'לא נמצא טקסט'}
</div>
// הוספה לקומפוננט AdGenerator - בתוך Step 3

// מקום: אחרי כותרת "מודעה שלך מוכנה!" ולפני preview של המודעה

{/* 🆔 תצוגת מזהה ייחודי */}

{generatedAd?.uniqueId && (

  <div className="ad-unique-id-badge">

    <div className="id-label">

      <i className="fas fa-fingerprint"></i>

      <span>מזהה פרסומת:</span>

    </div>

    <div className="id-value">

      {generatedAd.uniqueId}

    </div>

    <button 

      className="copy-id-btn"

      onClick={() => {

        navigator.clipboard.writeText(generatedAd.uniqueId);

        // הצג הודעה קצרה

        const btn = event.target;

        const originalText = btn.innerHTML;

        btn.innerHTML = '<i class="fas fa-check"></i> הועתק!';

        setTimeout(() => {

          btn.innerHTML = originalText;

        }, 2000);

      }}

      title="העתק מזהה"

    >

      <i className="fas fa-copy"></i>

    </button>

  </div>

)}

{/* CSS להוספה ל-AdGenerator.css או בתוך <style> tag */}

<style jsx>{`

  .ad-unique-id-badge {

    display: flex;

    align-items: center;

    justify-content: center;

    gap: 12px;

    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);

    padding: 12px 24px;

    border-radius: 12px;

    margin: 20px auto;

    max-width: 400px;

    box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);

  }

  .id-label {

    display: flex;

    align-items: center;

    gap: 8px;

    color: rgba(255, 255, 255, 0.9);

    font-size: 14px;

    font-weight: 500;

  }

  .id-label i {

    font-size: 18px;

  }

  .id-value {

    background: rgba(255, 255, 255, 0.2);

    padding: 6px 16px;

    border-radius: 8px;

    color: white;

    font-family: 'Courier New', monospace;

    font-size: 18px;

    font-weight: bold;

    letter-spacing: 2px;

    border: 2px solid rgba(255, 255, 255, 0.3);

  }

  .copy-id-btn {

    background: rgba(255, 255, 255, 0.2);

    border: 1px solid rgba(255, 255, 255, 0.3);

    color: white;

    padding: 8px 12px;

    border-radius: 8px;

    cursor: pointer;

    transition: all 0.3s ease;

    font-size: 14px;

  }

  .copy-id-btn:hover {

    background: rgba(255, 255, 255, 0.3);

    transform: scale(1.05);

  }

  .copy-id-btn:active {

    transform: scale(0.95);

  }

  .copy-id-btn i {

    margin-left: 5px;

  }

`}</style>
                                
                                <div style={styles.imageContainer}>
    {(() => {
        const imageUrl = generatedAd.imageUrl || 
                        generatedAd.finalImageUrl || 
                        generatedAd.imageBase64;
        
        console.log('🖼️ Rendering image. URL:', imageUrl ? 'exists (length: ' + imageUrl.length + ')' : 'MISSING');
        
        if (!imageUrl) {
            return (
                <div style={{padding: '40px', textAlign: 'center', color: '#999'}}>
                    <i className="fas fa-image" style={{fontSize: '48px', marginBottom: '15px'}}></i>
                    <p>לא נמצאה תמונה למודעה</p>
                </div>
            );
        }
        
        const ImageTag = (
            <img 
                src={imageUrl} 
                alt="Generated Ad" 
                style={styles.image}
                onLoad={() => console.log('✅ Image loaded successfully!')}
                onError={(e) => {
                    console.error('❌ Image failed to load!');
                    console.error('URL type:', typeof imageUrl);
                    console.error('URL preview:', imageUrl.substring(0, 100));
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div style="padding:40px;color:red;text-align:center;"><i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:15px;"></i><p>שגיאה בטעינת התמונה</p></div>';
                }}
            />
        );
        
        return websiteUrl ? (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                {ImageTag}
            </a>
        ) : ImageTag;
    })()}
</div>
                                
                                {websiteUrl && (
                                    <div style={styles.websiteLinkBox}>
                                        <p style={{color: 'white', margin: '0 0 10px 0'}}>
                                            🔗 קישור לאתר החברה
                                        </p>
                                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={styles.websiteLink}>
                                            {websiteUrl}
                                        </a>
                                    </div>
                                )}
                                
                                <div style={styles.infoBox}>
                                    <i className="fas fa-info-circle"></i>
                                    <strong>המודעה נשמרה במערכת!</strong><br />
                                    המודעה נשלחה לאישור החברה. לאחר האישור תוכל להוריד ולשתף אותה.
                                </div>
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Actions */}
                <div style={styles.actions}>
                    {currentStep > 1 && currentStep < 3 && (
                        <button style={styles.secondaryButton} onClick={previousStep}>
                            <i className="fas fa-arrow-right"></i> חזור
                        </button>
                    )}
                    {/* Placeholder for center alignment */}
                    <div style={currentStep === 1 ? {width: '100%'} : {}}></div> 
                    {currentStep < 3 && (
                        <button 
                            style={styles.primaryButton}
                            onClick={nextStep}
                            disabled={dataLoading || (currentStep === 1 && (!selectedCompany || !selectedCampaign || myCampaigns.length === 0))}
                        >
                            {currentStep === 2 ? (
                                <><i className="fas fa-magic"></i> צור מודעה</>
                            ) : (
                                <>לשלב הבא <i className="fas fa-arrow-left"></i></>
                            )}
                        </button>
                    )}
                </div>
            </div>

            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes pulse {
                    0% { transform: scale(1); opacity: 1; }
                    50% { transform: scale(1.05); opacity: 0.7; }
                    100% { transform: scale(1); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

// Inline Styles (אותם סגנונות כמו בגרסה הקודמת + הוספות)
const styles = {
    container: {
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        direction: 'rtl'
    },
    backButton: {
        display: 'inline-flex',
        alignItems: 'center',
        gap: '10px',
        background: 'white',
        color: '#667eea',
        padding: '12px 24px',
        borderRadius: '25px',
        textDecoration: 'none',
        fontWeight: 'bold',
        marginBottom: '20px',
        boxShadow: '0 4px 15px rgba(0,0,0,0.1)'
    },
    wizard: {
        maxWidth: '900px',
        margin: '0 auto',
        background: 'white',
        borderRadius: '20px',
        padding: '40px',
        boxShadow: '0 10px 40px rgba(0,0,0,0.2)'
    },
    header: {
        textAlign: 'center',
        marginBottom: '40px'
    },
    title: {
        fontSize: '32px',
        color: '#333',
        margin: '0 0 10px 0'
    },
    subtitle: {
        fontSize: '16px',
        color: '#666',
        margin: 0
    },
    progressContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '40px',
        padding: '0 20px',
        position: 'relative'
    },
    progressStep: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        zIndex: 1
    },
    stepCircle: {
        width: '50px',
        height: '50px',
        borderRadius: '50%',
        background: '#e0e0e0',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '20px',
        fontWeight: 'bold',
        color: '#999'
    },
    stepCircleActive: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
    },
    stepLabel: {
        fontSize: '14px',
        color: '#666'
    },
    errorBanner: {
        background: '#fee',
        color: '#c33',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px',
        border: '1px solid #fbb'
    },
    retryButton: {
        background: '#c33',
        color: 'white',
        border: 'none',
        padding: '8px 16px',
        borderRadius: '8px',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'background 0.3s'
    },
    stepPanel: {
        marginBottom: '30px',
        minHeight: '350px', // כדי למנוע קפיצות תוכן
        paddingTop: '20px'
    },
    sectionTitle: {
        fontSize: '24px',
        color: '#333',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '25px',
        borderBottom: '2px solid #f0f0f0',
        paddingBottom: '10px'
    },
    formGroup: {
        marginBottom: '20px'
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        color: '#333',
        fontWeight: '600'
    },
    required: {
        color: 'red'
    },
    input: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '15px',
        boxSizing: 'border-box'
    },
    textarea: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '15px',
        boxSizing: 'border-box',
        minHeight: '100px',
        resize: 'vertical'
    },
    select: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '15px',
        boxSizing: 'border-box',
        appearance: 'none',
        backgroundColor: 'white'
    },
    hint: {
        display: 'block',
        marginTop: '5px',
        fontSize: '13px',
        color: '#999'
    },
    formRow: {
        display: 'flex',
        gap: '20px',
        marginBottom: '20px'
    },
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '30px',
        borderTop: '1px solid #eee',
        paddingTop: '20px'
    },
    primaryButton: {
        background: 'linear-gradient(90deg, #667eea, #764ba2)',
        color: 'white',
        border: 'none',
        padding: '12px 30px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '18px',
        fontWeight: 'bold',
        transition: 'opacity 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    secondaryButton: {
        background: '#f0f0f0',
        color: '#333',
        border: '1px solid #ddd',
        padding: '12px 30px',
        borderRadius: '10px',
        cursor: 'pointer',
        fontSize: '18px',
        fontWeight: 'bold',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '300px'
    },
    spinner: {
        border: '8px solid #f3f3f3',
        borderTop: '8px solid #667eea',
        borderRadius: '50%',
        width: '60px',
        height: '60px',
        animation: 'spin 1.5s linear infinite'
    },
    loadingText: {
        fontSize: '16px',
        color: '#667eea',
        marginTop: '20px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '50px 20px',
        backgroundColor: '#f9f9f9',
        borderRadius: '15px',
        border: '1px dashed #ddd'
    },
    emptyIcon: {
        fontSize: '40px',
        marginBottom: '15px'
    },
    campaignInfo: {
        backgroundColor: '#f5f7fa',
        borderRight: '5px solid #667eea',
        padding: '15px',
        borderRadius: '8px',
        marginTop: '20px',
        lineHeight: '1.6'
    },
    result: {
        textAlign: 'center'
    },
    successBadge: {
        display: 'inline-block',
        backgroundColor: '#4CAF50',
        color: 'white',
        padding: '8px 20px',
        borderRadius: '20px',
        marginBottom: '20px',
        fontWeight: 'bold',
        animation: 'pulse 1s infinite'
    },
    generatedText: {
        textAlign: 'right',
        backgroundColor: '#f5f7fa',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #eee',
        marginBottom: '20px',
        lineHeight: '1.8',
        whiteSpace: 'pre-wrap'
    },
    imageContainer: {
        marginBottom: '20px',
        border: '1px solid #ddd',
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 10px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        margin: '20px auto'
    },
    image: {
        width: '100%',
        height: 'auto',
        display: 'block'
    },
    websiteLinkBox: {
        backgroundColor: '#333',
        padding: '15px',
        borderRadius: '10px',
        marginBottom: '20px',
        maxWidth: '500px',
        margin: '0 auto 20px'
    },
    websiteLink: {
        color: '#764ba2',
        fontWeight: 'bold',
        textDecoration: 'none',
        backgroundColor: 'white',
        padding: '5px 10px',
        borderRadius: '5px',
        display: 'block',
        marginTop: '10px',
        overflow: 'hidden',
        textOverflow: 'ellipsis'
    },
    infoBox: {
        backgroundColor: '#e6f7ff',
        color: '#00557c',
        padding: '15px',
        borderRadius: '10px',
        border: '1px solid #b3e6ff',
        textAlign: 'center',
        lineHeight: '1.5',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px',
        maxWidth: '500px',
        margin: '0 auto'
    },
    errorState: {
        textAlign: 'center',
        padding: '60px 20px',
        background: '#fee',
        borderRadius: '15px',
        border: '2px dashed #c33'
    },
    errorIcon: {
        fontSize: '60px',
        marginBottom: '20px'
    }
};

export default AdGenerator;