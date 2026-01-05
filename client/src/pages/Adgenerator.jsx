import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Link } from 'react-router-dom';
import './AdGeneratorM.css';

const CACHE_KEY = 'ad_generator_data';
const CACHE_DURATION = 5 * 60 * 1000; // 5 דקות

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

    const [formData, setFormData] = useState({
        productService: '',
        keyMessage: '',
        tone: 'friendly',
        language: 'Hebrew',
        adStyle: 'modern',
        imageFile: null
    });

    const API_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
    const token = localStorage.getItem('token');

    useEffect(() => {
        if (user?._id) {
            loadMyCompaniesAndCampaigns();
        }
    }, [user]);

    const loadMyCompaniesAndCampaigns = async () => {
        setDataLoading(true);
        try {
            // ✅ בדוק cache
            const cached = localStorage.getItem(CACHE_KEY);
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_DURATION) {
                    setMyCampaigns(data.campaigns);
                    setMyCompanies(data.companies);
                    setDataLoading(false);
                    return;
                }
            }

            // ✅ FIX: קריאה פשוטה ללא timeout
            const campaignsResponse = await fetch(`${API_URL}/campaigns/agent/${user._id}`, { 
                headers: { 'Authorization': `Bearer ${token}` }
            });
            
            if (!campaignsResponse.ok) {
                console.error('Failed to fetch campaigns:', campaignsResponse.status);
                setMyCampaigns([]);
                setMyCompanies([]);
                setDataLoading(false);
                return;
            }
            
            const campaignsData = await campaignsResponse.json();

            if (campaignsData.success && campaignsData.campaigns) {
                const campaigns = campaignsData.campaigns || [];
                setMyCampaigns(campaigns);
                
                // ✅ חלץ חברות ייחודיות מהקמפיינים בלבד
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
                    data: {
                        campaigns: campaigns,
                        companies: uniqueCompanies
                    },
                    timestamp: Date.now()
                }));
            } else {
                // אין קמפיינים
                setMyCampaigns([]);
                setMyCompanies([]);
            }
            
        } catch (error) {
            console.error('❌ Error loading data:', error);
            // לא להציג alert - רק לוג
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
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setFormData(prev => ({
                ...prev,
                imageFile: file
            }));
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
        if (currentStep > 1) {
            setCurrentStep(currentStep - 1);
        }
    };

    const generateAd = async () => {
        setCurrentStep(3);
        setLoading(true);

        try {
            // ✅ FormData לקבצים
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
            
            if (formData.imageFile) {
                formDataToSend.append('image', formData.imageFile);
            }

            const response = await fetch(`${API_URL}/generate-ad`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formDataToSend
            });

            const data = await response.json();

            if (data.success) {
                setGeneratedAd(data.ad);
            } else {
                throw new Error(data.error || 'שגיאה ביצירת המודעה');
            }
        } catch (error) {
            console.error('Generate ad error:', error);
            alert('שגיאה ביצירת המודעה: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    
    if (!user) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">טוען...</p>
            </div>
        );
    }

    return (
        <div className="ad-generator-container">
            <Link to="/agent-dashboard" className="back-button">
                <i className="fas fa-arrow-right"></i> חזרה לדשבורד
            </Link>

            <div className="wizard-container">
                <div className="wizard-header">
                    <h1 className="wizard-title">מחולל המודעות</h1>
                    <p className="wizard-subtitle">צרו מודעות מבוססות AI בכמה צעדים פשוטים</p>
                </div>

                {/* Progress Steps */}
                <div className="progress-container">
                    <div className="progress-step">
                        <div className={`step-circle ${currentStep >= 1 ? 'active' : ''}`}>
                            <i className="fas fa-cog"></i>
                        </div>
                        <div className={`step-label ${currentStep === 1 ? 'active' : ''}`}>בחר קמפיין</div>
                    </div>
                    
                    <div className="progress-step">
                        <div className={`step-circle ${currentStep >= 2 ? 'active' : ''}`}>
                            <i className="fas fa-file-alt"></i>
                        </div>
                        <div className={`step-label ${currentStep === 2 ? 'active' : ''}`}>פרטי המודעה</div>
                    </div>
                    
                    <div className="progress-step">
                        <div className={`step-circle ${currentStep >= 3 ? 'active' : ''}`}>
                            <i className="fas fa-palette"></i>
                        </div>
                        <div className={`step-label ${currentStep === 3 ? 'active' : ''}`}>תצוגה מקדימה</div>
                    </div>
                </div>

                {/* Step Content */}
                <div className="step-content">
                    {/* Step 1: Select Campaign */}
                    {currentStep === 1 && (
                        <div className="step-panel">
                            {dataLoading ? (
                                <div className="loading-container">
                                    <div className="spinner"></div>
                                    <p className="loading-text">טוען קמפיינים...</p>
                                </div>
                            ) : myCampaigns.length === 0 ? (
                                <div className="empty-state">
                                    <div className="empty-icon">📭</div>
                                    <h3>אין לך קמפיינים פעילים</h3>
                                    <p>פנה למנהל כדי להוסיף אותך לקמפיינים</p>
                                    <Link to="/my-campaigns" className="btn btn-primary">
                                        לקמפיינים שלי
                                    </Link>
                                </div>
                            ) : (
                                <>
                                    <h2 className="section-title">
                                        <i className="fas fa-bullhorn"></i> שלב 1: בחירת קמפיין
                                    </h2>
                                    
                                    <div className="form-group">
                                        <label>בחירת חברה <span className="required">*</span></label>
                                        <select 
                                            value={selectedCompany?._id || ''} 
                                            onChange={(e) => handleCompanyChange(e.target.value)}
                                            required
                                        >
                                            <option value="">בחר חברה</option>
                                            {myCompanies.map(company => (
                                                <option key={company._id} value={company._id}>
                                                    {company.companyName || company.fullName}
                                                </option>
                                            ))}
                                        </select>
                                    </div>

                                    <div className="form-group">
                                        <label>בחר/י קמפיין <span className="required">*</span></label>
                                        <select 
                                            value={selectedCampaign?._id || ''} 
                                            onChange={(e) => handleCampaignChange(e.target.value)}
                                            disabled={!selectedCompany}
                                            required
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
                                        <div className="campaign-info">
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
                            )}
                        </div>
                    )}

                    {/* Step 2: Ad Details */}
                    {currentStep === 2 && (
                        <div className="step-panel">
                            <h2 className="section-title">
                                <i className="fas fa-edit"></i> שלב 2: פרטי המודעה
                            </h2>
                            
                            <div className="form-group">
                                <label>מה המוצר/שירות/מבצע?</label>
                                <input
                                    type="text"
                                    name="productService"
                                    value={formData.productService}
                                    onChange={handleInputChange}
                                    placeholder="לדוגמה: הנחה של 20% על כל הדגמים"
                                />
                            </div>

                            <div className="form-group">
                                <label>מה ההודעה המרכזית שחשוב להדגיש?</label>
                                <textarea
                                    name="keyMessage"
                                    value={formData.keyMessage}
                                    onChange={handleInputChange}
                                    placeholder="לדוגמה: הדגשה על טריות, מחיר מיוחד, שירות אישי"
                                />
                            </div>

                            <div className="form-row">
                                <div className="form-group">
                                    <label>סגנון (Tone of Voice)</label>
                                    <select name="tone" value={formData.tone} onChange={handleInputChange}>
                                        <option value="friendly">ידידותי</option>
                                        <option value="professional">מקצועי</option>
                                        <option value="exciting">מרגש</option>
                                        <option value="casual">קז'ואל</option>
                                        <option value="urgent">דחוף</option>
                                    </select>
                                </div>

                                <div className="form-group">
                                    <label>שפת המודעה</label>
                                    <select name="language" value={formData.language} onChange={handleInputChange}>
                                        <option value="Hebrew">עברית</option>
                                        <option value="English">English</option>
                                        <option value="Arabic">العربية</option>
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label>סגנון עיצובי</label>
                                <select name="adStyle" value={formData.adStyle} onChange={handleInputChange}>
                                    <option value="modern">🎨 מודרני ונועז</option>
                                    <option value="minimal">⚡ מינימליסטי</option>
                                    <option value="elegant">✨ אלגנטי ומעודן</option>
                                    <option value="dark">🌙 כהה ומסתורי</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>העלאת תמונה (אופציונלי)</label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{ padding: '10px' }}
                                />
                                <small style={{ color: '#7f8c8d', display: 'block', marginTop: '8px' }}>
                                    📸 העלה תמונה משלך או שנמצא אחת אוטומטית
                                </small>
                            </div>
                        </div>
                    )}

                    {/* Step 3: Result */}
                    {currentStep === 3 && (
                        <div className="step-panel">
                            {loading ? (
                                <div className="loading-container">
                                    <div className="spinner"></div>
                                    <p className="loading-text">יוצר את הקסם...</p>
                                </div>
                            ) : generatedAd ? (
                                <div className="result-container">
                                    <span className="success-badge">✓ המודעה נוצרה בהצלחה!</span>
                                    <h2 className="section-title" style={{ justifyContent: 'center', marginTop: '20px' }}>
                                        המודעה המקצועית שלך מוכנה!
                                    </h2>
                                    
                                    <div className="generated-text">
                                        <strong>טקסט שיווקי:</strong><br /><br />
                                        {generatedAd.text}
                                    </div>
                                    
                                    <div className="canvas-container">
                                        <img src={generatedAd.imageData} alt="Generated Ad" style={{ maxWidth: '100%', borderRadius: '10px' }} />
                                    </div>
                                    
                                    <div className="info-box">
                                        <i className="fas fa-info-circle"></i>
                                        <strong>המודעה נשמרה במערכת!</strong><br />
                                        המודעה נשלחה לאישור החברה. לאחר האישור תוכל להוריד ולשתף אותה.
                                    </div>
                                </div>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* Wizard Actions */}
                <div className="wizard-actions">
                    <button 
                        className="btn btn-secondary" 
                        onClick={previousStep}
                        style={{ display: currentStep > 1 && currentStep < 3 ? 'inline-flex' : 'none' }}
                    >
                        <i className="fas fa-arrow-right"></i> חזור
                    </button>
                    <div></div>
                    <button 
                        className="btn btn-primary" 
                        onClick={nextStep}
                        disabled={dataLoading || (currentStep === 1 && myCampaigns.length === 0)}
                        style={{ display: currentStep < 3 ? 'inline-flex' : 'none' }}
                    >
                        {currentStep === 2 ? (
                            <>
                                <i className="fas fa-magic"></i> צור מודעה
                            </>
                        ) : (
                            <>
                                לשלב הבא <i className="fas fa-arrow-left"></i>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AdGenerator;