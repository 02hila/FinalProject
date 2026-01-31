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
    const [adLiked, setAdLiked] = useState(null); // null = not rated, true = liked, false = disliked
    const [adSaveData, setAdSaveData] = useState(null); // Store ad data to save when liked

    // Manual editing with data persistence
    const [originalAdData, setOriginalAdData] = useState(null); // Store original generated values
    const [editedTitle, setEditedTitle] = useState('');
    const [editedText, setEditedText] = useState('');
    const [isEditingTitle, setIsEditingTitle] = useState(false);
    const [isEditingText, setIsEditingText] = useState(false);

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

    //  Debug: עקוב אחרי שינויים ב-generatedAd
    useEffect(() => {
        console.log('🔔 generatedAd changed:', generatedAd);
        if (generatedAd) {
            console.log('✅ Ad is ready to display!');
            console.log('   - Text:', generatedAd.text ? '✓' : '✗');
            console.log('   - Image:', (generatedAd.imageUrl || generatedAd.finalImageUrl || generatedAd.imageBase64) ? '✓' : '✗');
            console.log('   - imageUrl:', generatedAd.imageUrl ? 'exists' : 'missing');
        }
    }, [generatedAd]);
    
    //  Debug: עקוב אחרי שינויים ב-loading
    useEffect(() => {
        console.log('🔄 loading changed:', loading);
    }, [loading]);

    // Debug: עקוב אחרי שינויים ב-currentStep
    useEffect(() => {
        console.log('📍 currentStep changed:', currentStep);
    }, [currentStep]);
    
    // פונקציה כללית עם retry logic
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
            // בדיקת cache
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

            // קריאה עם retry לטיפול ב-404 או שגיאות שרת
            const campaignsData = await fetchWithRetry(
                // ✅ ה-URL הנכון ל-API
                `${API_URL}/campaigns/agent/${user._id}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );

            console.log('✅ Campaigns data received:', campaignsData);

            if (campaignsData.success && campaignsData.campaigns) {
                const campaigns = campaignsData.campaigns || [];
                setMyCampaigns(campaigns);
                
                //  חלץ חברות ייחודיות
                const uniqueCompanies = campaigns.reduce((acc, campaign) => {
                    const company = campaign.companyId;
                    // ודא שזה אובייקט ולא רק ID מחרוזתי, ושהחברה עדיין לא ברשימה
                    if (company && typeof company === 'object' && !acc.find(c => c._id === company._id)) {
                        acc.push(company);
                    }
                    return acc;
                }, []);
                
                setMyCompanies(uniqueCompanies);

                // שמור ב-cache
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
    
    const handleLikeAd = async () => {
        if (!adSaveData) {
            console.error('❌ No save data available');
            alert('שגיאה: אין נתונים לשמירה');
            return;
        }

        // Always use the current edited values (they are initialized with original values when ad is generated)
        // This ensures any user edits are captured
        const finalTitle = editedTitle.trim();
        const finalText = editedText.trim();

        // Validate that we have content
        if (!finalTitle) {
            alert('נא להזין כותרת למודעה');
            return;
        }
        if (!finalText) {
            alert('נא להזין טקסט למודעה');
            return;
        }

        console.log('📝 Saving ad with values:', {
            originalTitle: originalAdData?.title,
            currentEditedTitle: editedTitle,
            finalTitleToSave: finalTitle,
            titleChanged: finalTitle !== originalAdData?.title
        });

        // Create the complete save data object with edited values
        const updatedSaveData = {
            uniqueId: adSaveData.uniqueId,
            title: finalTitle,  // Use edited title
            text: finalText,    // Use edited text
            callToAction: adSaveData.callToAction,
            imageData: adSaveData.imageData,
            companyId: adSaveData.companyId,
            campaignId: adSaveData.campaignId,
            agentId: adSaveData.agentId,
            qrCode: adSaveData.qrCode,
            websiteUrl: adSaveData.websiteUrl,
            metadata: adSaveData.metadata
        };

        console.log('📤 Sending to server - Title:', updatedSaveData.title);

        try {
            // Save the ad to database
            const response = await fetch(`${API_URL}/pending-ads/save-approved`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(updatedSaveData)
            });

            const data = await response.json();

            if (data.success) {
                setAdLiked(true);
                console.log('✅ Ad saved successfully!');
                console.log('✅ Title saved as:', finalTitle);
                console.log('✅ Text saved as:', finalText.substring(0, 50) + '...');
            } else {
                throw new Error(data.error || 'שגיאה בשמירת המודעה');
            }
        } catch (error) {
            console.error('❌ Error saving ad:', error);
            alert('שגיאה בשמירת המודעה: ' + error.message);
        }
    };

    // Determine text direction based on language
    const getTextDirection = () => {
        return formData.language === 'Hebrew' || formData.language === 'Arabic' ? 'rtl' : 'ltr';
    };

    const handleDislikeAd = () => {
        setAdLiked(false);
        // Don't save anything - just mark as disliked
        setAdSaveData(null);
        console.log('❌ Ad disliked - not saving to database');
    };

    const handleRegenerateAd = () => {
        setGeneratedAd(null);
        setAdLiked(null);
        setAdSaveData(null);
        setOriginalAdData(null);
        setEditedTitle('');
        setEditedText('');
        setIsEditingTitle(false);
        setIsEditingText(false);
        setError('');
        generateAd();
    };

    const generateAd = async () => {
        setCurrentStep(3);
        setLoading(true);
        setError('');
        setGeneratedAd(null);
        setAdLiked(null);
        setAdSaveData(null); 

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

            // חלץ את המודעה מהתגובה
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

            // Store save data for when user approves
            setAdSaveData(data.saveData || null);
            setAdLiked(null); // Reset like/dislike state

            // Store original generated data for persistence
            setOriginalAdData({
                title: adData.title || '',
                text: adData.text || '',
                imageUrl: adData.imageUrl || adData.finalImageUrl || adData.imageBase64 || '',
                colors: adData.colors || null,
                language: formData.language // Store language for RTL/LTR handling
            });

            // Initialize edited values with original
            setEditedTitle(adData.title || '');
            setEditedText(adData.text || '');
            setIsEditingTitle(false);
            setIsEditingText(false);

            //  עדכן את ה-state
            setGeneratedAd(adData);

            //  עצור טעינה אחרי 200ms (זמן שמאפשר ל-React לרנדר)
            setTimeout(() => {
                setLoading(false);
                console.log('✅ Loading stopped. Component should re-render now.');
            }, 200); 
            
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
            setLoading(false); 
        }
    };

    //  כפתור לנסות שוב
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
                                            <p style={{wordBreak: 'break-all', overflowWrap: 'break-word'}}>
                                                <strong>אתר:</strong> {selectedCampaign.websiteUrl}
                                            </p>
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
                                <h2>המודעה המקצועית שלך מוכנה!</h2>
                                <p style={{ color: '#666', fontSize: '14px', marginBottom: '20px' }}>
                                    💡 לחץ על הכותרת או הטקסט כדי לערוך
                                </p>

                                {/* id תצוגת מזהה ייחודי - שימוש ב-style */}
                                {generatedAd?.uniqueId && (
                                    <div style={styles.adUniqueIdBadge}>
                                        <div style={styles.idLabel}>
                                            <i className="fas fa-fingerprint"></i>
                                            <span>מזהה פרסומת:</span>
                                        </div>
                                        <div style={styles.idValue}>
                                            {generatedAd.uniqueId}
                                        </div>
                                        <button
                                            style={styles.copyIdBtn}
                                            onClick={(event) => {
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

                                {/* Editable Title Section */}
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>
                                        <i className="fas fa-heading" style={{ marginLeft: '8px' }}></i>
                                        כותרת:
                                    </label>
                                    {isEditingTitle ? (
                                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                            <input
                                                type="text"
                                                value={editedTitle}
                                                onChange={(e) => setEditedTitle(e.target.value)}
                                                onBlur={() => {
                                                    setIsEditingTitle(false);
                                                    if (!editedTitle.trim()) setEditedTitle(originalAdData?.title || '');
                                                }}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') {
                                                        setIsEditingTitle(false);
                                                        if (!editedTitle.trim()) setEditedTitle(originalAdData?.title || '');
                                                    }
                                                }}
                                                style={{ ...styles.input, direction: getTextDirection(), textAlign: getTextDirection() === 'rtl' ? 'right' : 'left' }}
                                                autoFocus
                                                placeholder={originalAdData?.title || 'הזן כותרת'}
                                                dir={getTextDirection()}
                                            />
                                            <button
                                                style={{ ...styles.secondaryButton, padding: '10px 15px' }}
                                                onClick={() => {
                                                    setEditedTitle(originalAdData?.title || '');
                                                    setIsEditingTitle(false);
                                                }}
                                                title="חזור לכותרת המקורית"
                                            >
                                                <i className="fas fa-undo"></i>
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => setIsEditingTitle(true)}
                                            style={{
                                                ...styles.generatedText,
                                                cursor: 'pointer',
                                                border: '2px dashed #ddd',
                                                transition: 'border-color 0.3s',
                                                fontSize: '20px',
                                                fontWeight: 'bold',
                                                marginBottom: 0,
                                                direction: getTextDirection(),
                                                textAlign: getTextDirection() === 'rtl' ? 'right' : 'left'
                                            }}
                                            dir={getTextDirection()}
                                            onMouseEnter={(e) => e.target.style.borderColor = '#667eea'}
                                            onMouseLeave={(e) => e.target.style.borderColor = '#ddd'}
                                        >
                                            {editedTitle || originalAdData?.title || generatedAd.title || 'לחץ לעריכה'}
                                            <i className="fas fa-edit" style={{ marginRight: getTextDirection() === 'rtl' ? '10px' : '0', marginLeft: getTextDirection() === 'ltr' ? '10px' : '0', color: '#667eea', fontSize: '14px' }}></i>
                                        </div>
                                    )}
                                </div>

                                {/* Editable Body Text Section - with increased spacing */}
                                <div style={{ marginBottom: '25px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: '#444' }}>
                                        <i className="fas fa-align-right" style={{ marginLeft: '8px' }}></i>
                                        טקסט המודעה:
                                    </label>
                                    {isEditingText ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                            <textarea
                                                value={editedText}
                                                onChange={(e) => setEditedText(e.target.value)}
                                                onBlur={() => {
                                                    setIsEditingText(false);
                                                    if (!editedText.trim()) setEditedText(originalAdData?.text || '');
                                                }}
                                                style={{ ...styles.textarea, minHeight: '120px', direction: getTextDirection(), textAlign: getTextDirection() === 'rtl' ? 'right' : 'left' }}
                                                autoFocus
                                                placeholder={originalAdData?.text || 'הזן טקסט'}
                                                dir={getTextDirection()}
                                            />
                                            <button
                                                style={{ ...styles.secondaryButton, padding: '10px 15px', alignSelf: 'flex-end' }}
                                                onClick={() => {
                                                    setEditedText(originalAdData?.text || '');
                                                    setIsEditingText(false);
                                                }}
                                                title="חזור לטקסט המקורי"
                                            >
                                                <i className="fas fa-undo"></i> חזור לטקסט המקורי
                                            </button>
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => setIsEditingText(true)}
                                            style={{
                                                ...styles.generatedText,
                                                cursor: 'pointer',
                                                border: '2px dashed #ddd',
                                                transition: 'border-color 0.3s',
                                                marginBottom: 0,
                                                minHeight: '80px',
                                                direction: getTextDirection(),
                                                textAlign: getTextDirection() === 'rtl' ? 'right' : 'left'
                                            }}
                                            dir={getTextDirection()}
                                            onMouseEnter={(e) => e.target.style.borderColor = '#667eea'}
                                            onMouseLeave={(e) => e.target.style.borderColor = '#ddd'}
                                        >
                                            {editedText || originalAdData?.text || generatedAd.text || generatedAd.adData?.text || 'לא נמצא טקסט למודעה.'}
                                            <i className="fas fa-edit" style={{ marginRight: getTextDirection() === 'rtl' ? '10px' : '0', marginLeft: getTextDirection() === 'ltr' ? '10px' : '0', color: '#667eea', fontSize: '14px' }}></i>
                                        </div>
                                    )}
                                </div>

                                {/* תמונת המודעה */}
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
                                                    // כדי למנוע שגיאת רנדור קריטית, הסתר תמונה שבורה
                                                    e.target.style.display = 'none'; 
                                                    e.target.parentElement.innerHTML = '<div style="padding:40px;color:red;text-align:center;"><i class="fas fa-exclamation-triangle" style="font-size:48px;margin-bottom:15px;"></i><p>שגיאה בטעינת התמונה</p></div>';
                                                }}
                                            />
                                        );
                                        
                                        return websiteUrl ? (
                                            <a href={websiteUrl} target="_blank" rel="noopener noreferrer" style={{display: 'block'}}>
                                                {ImageTag}
                                            </a>
                                        ) : ImageTag;
                                    })()}
                                </div>
                                
                                {websiteUrl && (
                                    <div style={styles.websiteLinkBox}>
                                        <a 
                                        href={websiteUrl} 
                                        target="_blank" 
                                        rel="noopener noreferrer" 
                                        style={styles.websiteButton}
                                    >
                                        🌐 לאתר החברה
                                        </a>
                                    </div>
                                )}
                                
                                {/* Like/Dislike buttons */}
                                {adLiked === null ? (
                                    <div style={styles.likeDislikeContainer}>
                                        <p style={{marginBottom: '15px', fontSize: '16px', fontWeight: 'bold', color: '#333'}}>
                                            האם המודעה מתאימה לך?
                                        </p>
                                        <div style={styles.likeDislikeButtons}>
                                            <button 
                                                style={{...styles.likeButton, ...styles.actionButton}}
                                                onClick={handleLikeAd}
                                            >
                                                <i className="fas fa-thumbs-up"></i> אהבתי
                                            </button>
                                            <button 
                                                style={{...styles.dislikeButton, ...styles.actionButton}}
                                                onClick={handleDislikeAd}
                                            >
                                                <i className="fas fa-thumbs-down"></i> לא אהבתי
                                            </button>
                                        </div>
                                    </div>
                                ) : adLiked ? (
                                    <div style={styles.infoBox}>
                                        <i className="fas fa-check-circle"></i>
                                        <strong>המודעה נשמרה במערכת!</strong><br />
                                        המודעה נשלחה לאישור החברה. לאחר האישור תוכל להוריד ולשתף אותה.
                                    </div>
                                ) : (
                                    <div style={styles.errorState}>
                                        <p style={{marginBottom: '15px', color: '#666'}}>המודעה לא נשמרה. תוכל ליצור מודעה חדשה.</p>
                                    </div>
                                )}
                            </div>
                        ) : null}
                    </div>
                )}

                {/* Actions */}
                <div style={styles.actions}>
                    {currentStep > 1 && currentStep < 3 && (
                        <button style={styles.secondaryButton} onClick={previousStep}>
                            <i className="fas fa-arrow-right"></i> חזרה
                        </button>
                    )}
                    {currentStep < 3 && (
                        <button style={styles.primaryButton} onClick={nextStep} disabled={dataLoading}>
                            {currentStep === 1 ? 'המשך לפרטי המודעה' : 'צור מודעה'} <i className="fas fa-arrow-left"></i>
                        </button>
                    )}
                    {currentStep === 3 && (
                        <>
                            {adLiked === false && (
                                <button style={styles.primaryButton} onClick={handleRegenerateAd} disabled={loading}>
                                    <i className="fas fa-redo"></i> צור מודעה חדשה
                                </button>
                            )}
                            {adLiked !== false && (
                                <button style={styles.secondaryButton} onClick={() => setCurrentStep(2)} disabled={loading}>
                                    <i className="fas fa-arrow-right"></i> ערוך מחדש
                                </button>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};



const styles = {
    container: {
        maxWidth: '1000px',
        margin: '50px auto',
        padding: '20px',
        fontFamily: 'Arial, sans-serif',
        direction: 'rtl',
        textAlign: 'right',
    },
    backButton: {
        display: 'inline-block',
        marginBottom: '20px',
        color: '#667eea',
        textDecoration: 'none',
        fontWeight: 'bold',
    },
    wizard: {
        background: '#fff',
        borderRadius: '16px',
        boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
        padding: '30px',
    },
    header: {
        borderBottom: '1px solid #eee',
        paddingBottom: '20px',
        marginBottom: '20px',
    },
    title: {
        color: '#333',
        marginBottom: '5px',
    },
    subtitle: {
        color: '#777',
        fontSize: '16px',
    },
    progressContainer: {
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: '40px',
        position: 'relative',
    },
    progressStep: {
        flex: 1,
        textAlign: 'center',
        position: 'relative',
    },
    stepCircle: {
        width: '40px',
        height: '40px',
        borderRadius: '50%',
        background: '#ccc',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 8px',
        fontWeight: 'bold',
        transition: 'background 0.3s',
        zIndex: 10,
        position: 'relative',
    },
    stepCircleActive: {
        background: '#667eea',
        boxShadow: '0 0 0 5px rgba(102, 126, 234, 0.4)',
    },
    stepLabel: {
        fontSize: '14px',
        color: '#555',
    },
    stepPanel: {
        padding: '20px 0',
    },
    sectionTitle: {
        color: '#667eea',
        borderRight: '4px solid #667eea',
        paddingRight: '10px',
        marginBottom: '30px',
    },
    formGroup: {
        marginBottom: '20px',
    },
    formRow: {
        display: 'flex',
        gap: '20px',
    },
    label: {
        display: 'block',
        marginBottom: '8px',
        fontWeight: 'bold',
        color: '#444',
    },
    required: {
        color: 'red',
        marginRight: '3px',
    },
    select: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        backgroundColor: '#f9f9f9',
        appearance: 'none',
        paddingLeft: '30px', // למקום לחץ
        backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'currentColor\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'left 10px center',
        backgroundSize: '16px',
        boxSizing: 'border-box',
    },
    input: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        boxSizing: 'border-box',
    },
    textarea: {
        width: '100%',
        padding: '12px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        fontSize: '16px',
        fontFamily: 'Arial, sans-serif',
        minHeight: '100px',
        resize: 'vertical',
        boxSizing: 'border-box',
    },
    hint: {
        display: 'block',
        marginTop: '5px',
        color: '#888',
        fontSize: '13px',
    },
    campaignInfo: {
        padding: '20px',
        background: '#f8f8ff',
        border: '1px solid #e0e0f8',
        borderRadius: '10px',
        marginTop: '20px',
        color: '#444',
    },
    // Actions styles
    actions: {
        borderTop: '1px solid #eee',
        paddingTop: '20px',
        marginTop: '30px',
        display: 'flex',
        justifyContent: 'space-between',
    },
    primaryButton: {
        backgroundColor: '#667eea',
        color: 'white',
        padding: '12px 25px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'background-color 0.3s, transform 0.1s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
    },
    secondaryButton: {
        backgroundColor: '#f0f0f0',
        color: '#444',
        padding: '12px 25px',
        borderRadius: '8px',
        border: '1px solid #ddd',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'background-color 0.3s, transform 0.1s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        textDecoration: 'none',
    },
    // Loading/Error styles
    loadingContainer: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '200px',
    },
    spinner: {
        border: '5px solid #f3f3f3',
        borderTop: '5px solid #667eea',
        borderRadius: '50%',
        width: '40px',
        height: '40px',
        animation: 'spin 1s linear infinite',
    },
    loadingText: {
        marginTop: '15px',
        color: '#667eea',
        fontSize: '16px',
    },
    '@keyframes spin': {
        from: { transform: 'rotate(0deg)' },
        to: { transform: 'rotate(360deg)' },
    },
    errorBanner: {
        backgroundColor: '#ffe0e0',
        color: '#c33',
        padding: '15px',
        borderRadius: '8px',
        marginBottom: '20px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        border: '1px solid #f0a0a0',
    },
    retryButton: {
        backgroundColor: '#c33',
        color: 'white',
        padding: '8px 15px',
        borderRadius: '6px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'flex',
        alignItems: 'center',
        gap: '5px',
    },
    emptyState: {
        textAlign: 'center',
        padding: '50px 20px',
        border: '2px dashed #ddd',
        borderRadius: '15px',
        marginTop: '20px',
    },
    emptyIcon: {
        fontSize: '50px',
        marginBottom: '15px',
    },
    // Result/Step 3 styles
    result: {
        textAlign: 'center',
        padding: '20px',
    },
    successBadge: {
        backgroundColor: '#4CAF50',
        color: 'white',
        padding: '5px 15px',
        borderRadius: '20px',
        fontSize: '14px',
        fontWeight: 'bold',
        display: 'inline-block',
        marginBottom: '20px',
    },
    generatedText: {
        background: '#f8f8f8',
        padding: '20px',
        borderRadius: '10px',
        border: '1px solid #eee',
        whiteSpace: 'pre-wrap',
        textAlign: 'center',
        fontSize: '18px',
        marginBottom: '20px',
        color: '#333',
    },
    imageContainer: {
        margin: '20px auto',
        maxWidth: '450px',
        borderRadius: '15px',
        overflow: 'hidden',
        boxShadow: '0 8px 25px rgba(0,0,0,0.2)',
        backgroundColor: '#fff',
        border: '1px solid #ddd',
    },
    image: {
        width: '100%',
        height: 'auto',
        display: 'block',
    },
    websiteLinkBox: {
        backgroundColor: '#667eea',
        padding: '10px 20px',
        borderRadius: '10px',
        marginTop: '20px',
        maxWidth: '450px',
        margin: '20px auto',
    },
    websiteLink: {
        color: 'white',
        textDecoration: 'underline',
        fontWeight: 'bold',
        wordBreak: 'break-all',
    },
    infoBox: {
        background: '#e6f7ff',
        color: '#005580',
        padding: '15px',
        borderRadius: '10px',
        border: '1px solid #b3e0ff',
        marginTop: '30px',
        textAlign: 'right',
    },
    errorState: {
        textAlign: 'center',
        padding: '50px 20px',
        border: '2px solid #f0a0a0',
        borderRadius: '15px',
        backgroundColor: '#fff7f7',
    },
    errorIcon: {
        fontSize: '50px',
        color: '#c33',
        marginBottom: '15px',
    },
    
    // --- סגנונות חדשים עבור תג המזהה הייחודי (Unique ID Badge) ---
    adUniqueIdBadge: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        padding: '12px 24px',
        borderRadius: '12px',
        margin: '20px auto',
        maxWidth: '400px',
        boxShadow: '0 4px 12px rgba(102, 126, 234, 0.3)',
    },
    idLabel: {
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: '14px',
        fontWeight: '500',
    },
    idValue: {
        background: 'rgba(255, 255, 255, 0.2)',
        padding: '6px 16px',
        borderRadius: '8px',
        color: 'white',
        fontFamily: "'Courier New', monospace",
        fontSize: '18px',
        fontWeight: 'bold',
        letterSpacing: '2px',
        border: '2px solid rgba(255, 255, 255, 0.3)',
    },
    copyIdBtn: {
        background: 'rgba(255, 255, 255, 0.2)',
        border: '1px solid rgba(255, 255, 255, 0.3)',
        color: 'white',
        padding: '8px 12px',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.3s ease',
        fontSize: '14px',
        // אין אפשרות להגדיר hover ב-inline styles, נשתמש ב-onClick ל-feedback
    },
    // Like/Dislike styles
    likeDislikeContainer: {
        marginTop: '30px',
        padding: '20px',
        background: '#f8f9fa',
        borderRadius: '10px',
        textAlign: 'center',
    },
    likeDislikeButtons: {
        display: 'flex',
        gap: '15px',
        justifyContent: 'center',
    },
    actionButton: {
        padding: '12px 30px',
        borderRadius: '8px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '16px',
        fontWeight: 'bold',
        transition: 'all 0.3s',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
    },
    likeButton: {
        backgroundColor: '#4CAF50',
        color: 'white',
    },
    websiteButton: {
    display: 'inline-block',
    backgroundColor: 'white',
    color: '#667eea',
    padding: '12px 30px',
    borderRadius: '25px',
    textDecoration: 'none',
    fontWeight: 'bold',
    fontSize: '16px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
    transition: 'all 0.3s ease',
},
    dislikeButton: {
        backgroundColor: '#f44336',
        color: 'white',
    },
    // הפונקציות הקטנות והמיוחדות של ה-copyIdBtn:hover הועברו ללוגיקת ה-onClick
};

export default AdGenerator;