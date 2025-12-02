import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const CACHE_KEY = 'ad_generator_data';
const CACHE_DURATION = 5 * 60 * 1000;
const FETCH_TIMEOUT = 30000; // 30 שניות במקום 10
const MAX_RETRIES = 2;

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

    useEffect(() => {
        if (user?._id) {
            loadMyCompaniesAndCampaigns();
        }
    }, [user]);

    // ✅ פונקציה עם retry logic
    const fetchWithRetry = async (url, options, retries = MAX_RETRIES) => {
        for (let i = 0; i <= retries; i++) {
            try {
                console.log(`🔄 Attempt ${i + 1}/${retries + 1} - Fetching:`, url);
                
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT);
                
                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                console.log('✅ Success on attempt', i + 1);
                return data;
                
            } catch (error) {
                console.warn(`⚠️ Attempt ${i + 1} failed:`, error.message);
                
                if (i === retries) {
                    throw error; // נכשל אחרי כל הניסיונות
                }
                
                // המתן לפני ניסיון נוסף (exponential backoff)
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
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

            // ✅ קריאה עם retry
            const campaignsData = await fetchWithRetry(
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
                console.warn('⚠️ No campaigns found');
                setMyCampaigns([]);
                setMyCompanies([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            
            let errorMessage = 'שגיאה בטעינת קמפיינים';
            
            if (error.name === 'AbortError') {
                errorMessage = 'הבקשה לקחה יותר מדי זמן. נסה שוב.';
            } else if (error.message.includes('Failed to fetch')) {
                errorMessage = 'בעיית תקשורת עם השרת. בדוק את החיבור לאינטרנט.';
            } else {
                errorMessage = `שגיאה: ${error.message}`;
            }
            
            setError(errorMessage);
            setMyCampaigns([]);
            setMyCompanies([]);
        } finally {
            setDataLoading(false);
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
            if (!formData.productService || !formData.keyMessage) {
                alert('אנא מלא את כל השדות הנדרשים');
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
        setGeneratedAd(null); // נקה תוצאה קודמת

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

            // ✅ קריאה עם retry (יצירת מודעה יכולה לקחת זמן)
            const data = await fetchWithRetry(
                `${API_URL}/generate-ad`,
                {
                    method: 'POST',
                    headers: { 'Authorization': `Bearer ${token}` },
                    body: formDataToSend
                },
                1 // רק ניסיון אחד נוסף ליצירת מודעה
            );

            console.log('✅ Ad generated:', data);

            if (data.success) {
                setGeneratedAd(data.ad);
            } else {
                throw new Error(data.error || 'שגיאה ביצירת המודעה');
            }
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
        } finally {
            setLoading(false);
        }
    };

    // ✅ כפתור לנסות שוב
    const handleRetry = () => {
        setError('');
        loadMyCompaniesAndCampaigns();
    };

    // ✅ חזרה ליצירת מודעה חדשה
    const resetWizard = () => {
        setGeneratedAd(null);
        setError('');
        setLoading(false);
        setCurrentStep(1);
    };

    if (!user) {
        return (
            <div style={styles.loadingContainer}>
                <div style={styles.spinner}></div>
                <p style={styles.loadingText}>טוען...</p>
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
                {error && (
                    <div style={styles.errorBanner}>
                        <div>
                            <i className="fas fa-exclamation-circle"></i> {error}
                        </div>
                        {currentStep === 1 && (
                            <button onClick={handleRetry} style={styles.retryButton}>
                                <i className="fas fa-redo"></i> נסה שוב
                            </button>
                        )}
                        {currentStep === 3 && !loading && (
                            <button onClick={resetWizard} style={styles.retryButton}>
                                <i className="fas fa-redo"></i> נסה שוב (חזור לשלב 1)
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
                                    טוען קמפיינים... {retryCount > 0 && `(ניסיון ${retryCount + 1})`}
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

                {/* Step 2 */}
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
                            <div style={styles.formGroup}>
                                <label style={styles.label}>סגנון (Tone of Voice)</label>
                                <select style={styles.select} name="tone" value={formData.tone} onChange={handleInputChange}>
                                    <option value="friendly">ידידותי</option>
                                    <option value="professional">מקצועי</option>
                                    <option value="exciting">מרגש</option>
                                    <option value="casual">קז'ואל</option>
                                    <option value="urgent">דחוף</option>
                                </select>
                            </div>

                            <div style={styles.formGroup}>
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
                                name="imageFile"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                            <small style={styles.hint}>
                                📸 העלה תמונה משלך או שנמצא אחת אוטומטית
                            </small>
                        </div>
                    </div>
                )}

                {/* Step 3 - תצוגת מודעה מתוקנת ומלאה */}
                {currentStep === 3 && (
                    <div style={styles.stepPanel}>
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
                        ) : generatedAd ? (
                            <div style={styles.result}>
                                <span style={styles.successBadge}>✓ המודעה נוצרה בהצלחה!</span>
                                <h2 style={{...styles.sectionTitle, justifyContent: 'center'}}>
                                    המקצועית שלך מוכנה!
                                </h2>
                                
                                <div style={styles.generatedText}>
                                    <strong>טקסט שיווקי:</strong><br /><br />
                                    {generatedAd.text}
                                </div>
                                
                                <div style={styles.imageContainer}>
                                    {/* שימוש ב-finalImageUrl או imageBase64 ולוודא שהתחביר נכון */}
                                    {websiteUrl ? (
                                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={styles.imageLink}>
                                            <img 
                                                src={generatedAd.finalImageUrl || generatedAd.imageBase64} 
                                                alt="Generated Ad" 
                                                style={styles.image}
                                            />
                                        </a>
                                    ) : (
                                        <img 
                                            src={generatedAd.finalImageUrl || generatedAd.imageBase64} 
                                            alt="Generated Ad" 
                                            style={styles.image}
                                        />
                                    )}
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
                                
                                {/* כפתור חזרה ליצירת מודעה חדשה */}
                                <button style={styles.primaryButton} onClick={resetWizard}>
                                    🔄 צור מודעה חדשה
                                </button>
                            </div>
                        ) : (
                            <div style={styles.emptyState}>
                                <div style={styles.emptyIcon}>❌</div>
                                <h3>לא הצלחנו ליצור את המודעה</h3>
                                <p>נסה שוב או בדוק את פרטי הקלט.</p>
                                <button style={styles.primaryButton} onClick={resetWizard}>
                                    🔄 חזור להתחלה
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Actions */}
                <div style={styles.actions}>
                    {currentStep > 1 && currentStep < 3 && (
                        <button style={styles.secondaryButton} onClick={previousStep}>
                            <i className="fas fa-arrow-right"></i> חזור
                        </button>
                    )}
                    <div></div> {/* מפריד לצורך Push-to-sides */}
                    {currentStep < 3 && (
                        <button 
                            style={styles.primaryButton}
                            onClick={nextStep}
                            disabled={dataLoading || (currentStep === 1 && myCampaigns.length === 0)}
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
        padding: '0 20px'
    },
    progressStep: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '10px'
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
        gap: '10px'
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
        gap: '8px'
    },
    stepPanel: {
        marginBottom: '30px'
    },
    sectionTitle: {
        fontSize: '24px',
        color: '#333',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: '25px'
    },
    formGroup: {
        marginBottom: '20px'
    },
    formRow: {
        display: 'flex',
        gap: '20px',
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
    select: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '15px',
        boxSizing: 'border-box',
        appearance: 'none',
        backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left 15px center',
        paddingRight: '40px'
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
    hint: {
        display: 'block',
        marginTop: '5px',
        color: '#888',
        fontSize: '13px'
    },
    campaignInfo: {
        background: '#f8f8ff',
        border: '1px solid #e0e0f0',
        padding: '20px',
        borderRadius: '10px',
        marginTop: '20px'
    },
    loadingContainer: {
        textAlign: 'center',
        padding: '50px 0'
    },
    spinner: {
        border: '4px solid rgba(0, 0, 0, 0.1)',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite',
        margin: '0 auto'
    },
    loadingText: {
        marginTop: '15px',
        color: '#667eea',
        fontSize: '16px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '50px 0',
        border: '2px dashed #ddd',
        borderRadius: '10px',
        color: '#666'
    },
    emptyIcon: {
        fontSize: '40px',
        marginBottom: '10px'
    },
    primaryButton: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        padding: '15px 30px',
        borderRadius: '10px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none'
    },
    secondaryButton: {
        background: '#f0f0f0',
        color: '#333',
        border: '1px solid #ddd',
        padding: '15px 30px',
        borderRadius: '10px',
        fontSize: '18px',
        fontWeight: 'bold',
        cursor: 'pointer',
        transition: 'background 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        paddingTop: '20px'
    },
    // סגנונות חדשים לתצוגת המודעה
    result: {
        textAlign: 'center',
        padding: '20px 0',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px'
    },
    successBadge: {
        background: '#4CAF50',
        color: 'white',
        padding: '8px 15px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        marginBottom: '10px'
    },
    generatedText: {
        textAlign: 'right',
        background: '#f9f9f9',
        border: '1px solid #eee',
        padding: '20px',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '600px',
        lineHeight: '1.6',
        whiteSpace: 'pre-wrap' // לשמירת שבירות שורה
    },
    imageContainer: {
        width: '100%',
        maxWidth: '500px',
        margin: '20px 0',
        borderRadius: '12px',
        overflow: 'hidden',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)'
    },
    image: {
        width: '100%',
        height: 'auto',
        display: 'block'
    },
    imageLink: {
        display: 'block',
        textDecoration: 'none',
        width: '100%'
    },
    websiteLinkBox: {
        background: '#667eea',
        padding: '15px',
        borderRadius: '10px',
        width: '100%',
        maxWidth: '600px',
        marginBottom: '15px'
    },
    websiteLink: {
        color: '#fff',
        fontWeight: 'bold',
        wordBreak: 'break-all',
        textDecoration: 'underline',
        display: 'block'
    },
    infoBox: {
        background: '#fff3cd',
        color: '#856404',
        padding: '15px',
        borderRadius: '8px',
        border: '1px solid #ffeeba',
        width: '100%',
        maxWidth: '600px',
        textAlign: 'right',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px',
        marginBottom: '20px'
    }
};

export default AdGenerator;