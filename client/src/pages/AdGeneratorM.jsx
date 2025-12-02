import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';

const CACHE_KEY = 'ad_generator_data';
const CACHE_DURATION = 5 * 60 * 1000;
const FETCH_TIMEOUT = 30000;
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
        imageFile: null,
        imageDescription: '' // ✅ שדה חדש לתיאור התמונה
    });

    const API_URL = 'https://adsmaker.onrender.com/api';
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (user?._id) {
            loadMyCompaniesAndCampaigns();
        }
    }, [user]);

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
                    throw error;
                }
                
                await new Promise(resolve => setTimeout(resolve, 1000 * (i + 1)));
            }
        }
    };

    const loadMyCompaniesAndCampaigns = async () => {
        setDataLoading(true);
        setError('');
        setRetryCount(0);
        
        try {
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

            const campaignsData = await fetchWithRetry(
                `${API_URL}/campaigns/agent/${user._id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            console.log('✅ Campaigns data received:', campaignsData);

            if (campaignsData.success && campaignsData.campaigns) {
                const campaigns = campaignsData.campaigns || [];
                setMyCampaigns(campaigns);
                
                const uniqueCompanies = campaigns.reduce((acc, campaign) => {
                    const company = campaign.companyId;
                    if (company && typeof company === 'object' && !acc.find(c => c._id === company._id)) {
                        acc.push(company);
                    }
                    return acc;
                }, []);
                
                setMyCompanies(uniqueCompanies);

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
            
            // ✅ הוספת תיאור התמונה
            if (formData.imageDescription && formData.imageDescription.trim()) {
                formDataToSend.append('imageDescription', formData.imageDescription.trim());
            }
            
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

    const handleRetry = () => {
        setError('');
        loadMyCompaniesAndCampaigns();
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
                    <h1 style={styles.title}>מחולל המודעות המשופר</h1>
                    <p style={styles.subtitle}>צרו מודעות מקצועיות עם תמונות מותאמות אישית</p>
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

                {error && (
                    <div style={styles.errorBanner}>
                        <div>
                            <i className="fas fa-exclamation-circle"></i> {error}
                        </div>
                        <button onClick={handleRetry} style={styles.retryButton}>
                            <i className="fas fa-redo"></i> נסה שוב
                        </button>
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

                {/* Step 2 - מעודכן עם שדה תיאור תמונה */}
                {currentStep === 2 && (
                    <div style={styles.stepPanel}>
                        <h2 style={styles.sectionTitle}>
                            <i className="fas fa-edit"></i> שלב 2: פרטי המודעה
                        </h2>
                        
                        <div style={styles.formGroup}>
                            <label style={styles.label}>מה המוצר/שירות/מבצע? <span style={styles.required}>*</span></label>
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
                            <label style={styles.label}>מה ההודעה המרכזית? <span style={styles.required}>*</span></label>
                            <textarea
                                style={styles.textarea}
                                name="keyMessage"
                                value={formData.keyMessage}
                                onChange={handleInputChange}
                                placeholder="לדוגמה: הדגשה על טריות, מחיר מיוחד, שירות אישי"
                            />
                        </div>

                        {/* ✅ שדה חדש - תיאור התמונה */}
                        <div style={styles.formGroup}>
                            <label style={styles.label}>
                                <i className="fas fa-image" style={{marginLeft: '8px'}}></i>
                                תאר/י את התמונה שתרצה/י לראות ברקע
                            </label>
                            <textarea
                                style={styles.textarea}
                                name="imageDescription"
                                value={formData.imageDescription}
                                onChange={handleInputChange}
                                placeholder="לדוגמה: תמונה של משפחה שמחה אוכלת ארוחה ביחד, או: תמונה של טכנולוגיה מתקדמת במשרד מודרני"
                                rows="3"
                            />
                            <small style={styles.hint}>
                                💡 תיאור טוב יותר = תמונה מתאימה יותר! תארו בפירוט מה אתם רוצים לראות.
                            </small>
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
                            <label style={styles.label}>או העלה תמונה משלך (אופציונלי)</label>
                            <input
                                style={styles.input}
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                            />
                            <small style={styles.hint}>
                                📸 אם תעלה תמונה משלך, היא תשמש במקום החיפוש האוטומטי
                            </small>
                        </div>
                    </div>
                )}

                {/* Step 3 */}
                {currentStep === 3 && (
                    <div style={styles.stepPanel}>
                        {loading ? (
                            <div style={styles.loadingContainer}>
                                <div style={styles.spinner}></div>
                                <div style={{ marginTop: '20px', textAlign: 'center' }}>
                                    <p style={{...styles.loadingText, fontWeight: 'bold', fontSize: '18px'}}>
                                        🎨 יוצר את המודעה המושלמת שלך...
                                    </p>
                                    <p style={{fontSize: '14px', color: '#666'}}>
                                        מחפש תמונה מתאימה ויוצר עיצוב מקצועי
                                    </p>
                                    <p style={{fontSize: '14px', color: '#666', marginTop: '10px'}}>
                                        זה יכול לקחת 15-30 שניות
                                    </p>
                                    {selectedCampaign?.websiteUrl && (
                                        <p style={{color: '#667eea', fontWeight: 'bold', marginTop: '15px'}}>
                                            🔲 יוצר QR code...
                                        </p>
                                    )}
                                </div>
                            </div>
                        ) : generatedAd ? (
                            <div style={styles.result}>
                                <span style={styles.successBadge}>✓ המודעה נוצרה בהצלחה!</span>
                                <h2 style={{...styles.sectionTitle, justifyContent: 'center'}}>
                                    המודעה המקצועית שלך מוכנה!
                                </h2>
                                
                                <div style={styles.generatedText}>
                                    <strong>טקסט שיווקי:</strong><br /><br />
                                    {generatedAd.text}
                                </div>
                                
                                <div style={styles.imageContainer}>
                                    {websiteUrl ? (
                                        <a href={websiteUrl} target="_blank" rel="noopener noreferrer">
                                            <img 
                                                src={generatedAd.imageData} 
                                                alt="Generated Ad" 
                                                style={styles.image}
                                            />
                                        </a>
                                    ) : (
                                        <img 
                                            src={generatedAd.imageData} 
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
                    <div></div>
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
        minHeight: '100px',
        boxSizing: 'border-box',
        resize: 'vertical'
    },
    select: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '15px',
        boxSizing: 'border-box'
    },
    formRow: {
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '20px'
    },
    hint: {
        display: 'block',
        marginTop: '8px',
        color: '#7f8c8d',
        fontSize: '13px',
        fontStyle: 'italic'
    },
    campaignInfo: {
        background: '#f9f9f9',
        padding: '20px',
        borderRadius: '12px',
        marginTop: '20px'
    },
    emptyState: {
        textAlign: 'center',
        padding: '60px 20px'
    },
    emptyIcon: {
        fontSize: '80px',
        marginBottom: '20px'
    },
    result: {
        textAlign: 'center'
    },
    successBadge: {
        display: 'inline-block',
        background: '#27ae60',
        color: 'white',
        padding: '10px 20px',
        borderRadius: '25px',
        marginBottom: '20px'
    },
    generatedText: {
        background: '#f9f9f9',
        padding: '20px',
        borderRadius: '12px',
        marginBottom: '20px',
        textAlign: 'right'
    },
    imageContainer: {
        marginBottom: '20px'
    },
    image: {
        maxWidth: '100%',
        borderRadius: '10px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.1)'
    },
    websiteLinkBox: {
        marginTop: '20px',
        padding: '20px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        borderRadius: '12px'
    },
    websiteLink: {
        display: 'inline-block',
        padding: '12px 24px',
        background: 'white',
        color: '#667eea',
        fontSize: '16px',
        fontWeight: '600',
        textDecoration: 'none',
        borderRadius: '8px'
    },
    infoBox: {
        background: '#e3f2fd',
        padding: '15px',
        borderRadius: '12px',
        marginTop: '20px',
        color: '#1976d2'
    },
    actions: {
        display: 'flex',
        justifyContent: 'space-between',
        marginTop: '30px'
    },
    primaryButton: {
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white',
        border: 'none',
        padding: '15px 30px',
        borderRadius: '25px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        textDecoration: 'none'
    },
    secondaryButton: {
        background: '#e0e0e0',
        color: '#666',
        border: 'none',
        padding: '15px 30px',
        borderRadius: '25px',
        fontSize: '16px',
        fontWeight: 'bold',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '10px'
    },
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px'
    },
    spinner: {
        width: '50px',
        height: '50px',
        border: '4px solid #f3f3f3',
        borderTop: '4px solid #667eea',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite'
    },
    loadingText: {
        marginTop: '20px',
        color: '#666',
        fontSize: '16px'
    }
};

export default AdGenerator;