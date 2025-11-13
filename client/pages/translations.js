// translations.js - קובץ תרגומים מרכזי
// העתק את זה לקובץ חדש בשם translations.js

const translations = {
    he: {
        // App General
        app_name: "Ads Maker",
        app_subtitle: "AI Marketing Studio",
        
        // Navigation
        main_menu: "תפריט ראשי",
        dashboard: "Dashboard",
        dashboard_desc: "סקירה כללית וניתוחים",
        companies: "חברות",
        companies_desc: "ניהול פרופילים עסקיים",
        campaigns: "קמפיינים",
        campaigns_desc: "קמפיינים פרסומיים",
        ad_generator: "יוצר מודעות",
        ad_generator_desc: "יצירת מודעות מבוססת AI",
        analytics: "ניתוחים",
        analytics_desc: "תובנות ביצועים",
        
        // Settings
        settings: "הגדרות",
        dark_mode: "מצב כהה",
        language: "שפה",
        
        // Dashboard
        marketing_dashboard: "Marketing Dashboard",
        real_time_monitoring: "ניטור קמפיינים ממומנים מבוססי AI בזמן אמת",
        manage_companies: "נהל חברות",
        create_ads: "צור מודעות",
        
        // Stats Cards
        companies_count: "חברות",
        total_campaigns: "קמפיינים סה\"כ",
        active_campaigns: "קמפיינים פעילים",
        generated_ads: "מודעות שנוצרו",
        total_impressions: "סה\"כ חשיפות",
        total_clicks: "סה\"כ קליקים",
        total_spend: "סה\"כ הוצאות",
        ctr: "CTR",
        
        // Chart Section
        performance_by_platform: "ביצועי קמפיינים לפי פלטפורמה",
        campaign_statistics: "סטטיסטיקות קמפיינים",
        chart_coming_soon: "📊 גרף יתווסף בקרוב",
        
        // Quick Actions
        quick_actions: "פעולות מהירות",
        new_company: "חברה חדשה",
        add_business_profile: "הוסף פרופיל עסקי",
        create_campaign: "צור קמפיין",
        start_new_campaign: "התחל קמפיין חדש",
        create_ad: "צור מודעות",
        ai_powered_creation: "יצירה מבוססת AI",
        view_analytics: "צפה בניתוחים",
        performance_insights: "תובנות ביצועים",
        
        // Recent Activity
        recent_activity: "פעילות אחרונה",
        recent_companies: "חברות אחרונות",
        no_recent_activity: "אין פעילות אחרונה",
        no_companies: "אין חברות במערכת",
        campaigns_count: "קמפיינים",
        loading_activity: "טוען פעילות...",
        loading_companies: "טוען חברות...",
        loading_data: "טוען נתונים...",
        error_loading: "שגיאה בטעינת הנתונים",
        ensure_server_running: "אנא וודא שהשרת פועל",
        
        // Companies Page
        company_management: "ניהול חברות",
        manage_business_profiles: "נהל את פרופילי החברות והמותגים שלך",
        add_new_company: "הוסף חברה חדשה",
        company_details: "פרטי חברה",
        select_company_to_view: "בחר חברה כדי לראות את הפרטים",
        no_companies_yet: "אין חברות עדיין",
        
        // Company Form
        company_name: "שם החברה",
        enter_company_name: "הזן שם חברה",
        industry: "תעשייה",
        select_industry: "בחר תעשייה",
        technology: "טכנולוגיה",
        fitness: "כושר",
        restaurant: "מסעדנות",
        fashion: "אופנה",
        real_estate: "נדל\"ן",
        education: "חינוך",
        healthcare: "בריאות",
        other: "אחר",
        description: "תיאור",
        describe_business: "תאר את העסק, המוצרים והשירותים שלך",
        target_demographics: "דמוגרפיית קהל יעד",
        describe_ideal_customers: "תאר את הלקוחות האידיאליים שלך (גיל, תחומי עניין, מיקום וכו')",
        website: "אתר אינטרנט",
        brand_colors: "צבעי מותג",
        preferred_languages: "שפות מועדפות למודעות",
        create_company: "צור חברה",
        edit_company: "ערוך חברה",
        cancel: "ביטול",
        
        // Company Details
        no_description: "אין תיאור",
        not_specified: "לא צוין",
        website_available: "אתר זמין",
        languages_count: "שפות",
        brand_colors_count: "צבעי מותג",
        edit: "עריכה",
        delete: "מחיקה",
        confirm_delete_company: "האם אתה בטוח שברצונך למחוק חברה זו?",
        error_saving_company: "שגיאה בשמירת החברה",
        error_deleting_company: "שגיאה במחיקת החברה",
        
        // Campaigns Page
        campaign_management: "ניהול קמפיינים",
        manage_all_campaigns: "נהל את כל הקמפיינים הפרסומיים שלך במקום אחד",
        new_campaign: "קמפיין חדש",
        select_campaign_to_view: "בחר קמפיין להצגת פרטים",
        click_campaign_for_details: "לחץ על קמפיין מהרשימה כדי לראות את הפרטים המלאים",
        no_campaigns_yet: "אין קמפיינים עדיין",
        
        // Campaign Form
        select_company: "בחר חברה",
        campaign_name: "שם הקמפיין",
        enter_campaign_name: "הזן שם קמפיין",
        campaign_goal: "מטרת הקמפיין",
        brand_awareness: "בניית מודעות למותג",
        lead_generation: "יצירת לידים",
        sales: "מכירות",
        website_traffic: "תעבורה לאתר",
        engagement: "אינטראקציה",
        app_installs: "התקנות אפליקציה",
        budget: "תקציב ($)",
        target_audience: "קהל יעד",
        describe_target_audience: "תאר את קהל היעד שלך",
        geographic_location: "מיקום גיאוגרפי",
        israel: "ישראל",
        age_range: "טווח גילאים",
        interests: "תחומי עניין",
        select_interests: "בחר תחומי עניין",
        food_restaurants: "אוכל ומסעדות",
        technology_interest: "טכנולוגיה",
        sports_fitness: "ספורט ופיטנס",
        beauty_fashion: "יופי ואופנה",
        health_wellness: "בריאות ורווחה",
        travel_tourism: "נסיעות ותיירות",
        family_kids: "משפחה וילדים",
        business_professional: "עסקים ומקצועות",
        recommended_platforms: "פלטפורמות מומלצות",
        
        // Campaign Status
        status: "סטטוס",
        draft: "טיוטה",
        active: "פעיל",
        paused: "מושהה",
        completed: "הושלם",
        
        // Campaign Details
        campaign_info: "פרטי קמפיין",
        platform: "פלטפורמה",
        impressions: "חשיפות",
        clicks: "קליקים",
        creation_date: "תאריך יצירה",
        advertising_platforms: "פלטפורמות פרסום",
        confirm_delete_campaign: "האם אתה בטוח שברצונך למחוק קמפיין זה?",
        error_saving_campaign: "שגיאה בשמירת הקמפיין",
        error_deleting_campaign: "שגיאה במחיקת הקמפיין",
        
        // Ad Generator
        ad_generator_title: "מחולל המודעות",
        create_ai_ads: "צרו מודעות מבוססות AI בכמה צעדים פשוטים",
        
        // Wizard Steps
        step_1_title: "שלב 1: בחירת קמפיין",
        step_2_title: "שלב 2: פרטי המודעה",
        step_3_title: "שלב 3: תצוגה מקדימה ושמירה",
        select_campaign_label: "בחר קמפיין",
        select_campaign_from_list: "בחר חברה מהרשימה",
        select_campaign_optional: "בחר/י קמפיין מהרשימה",
        select_campaign_or_general: "בחר קמפיין (או השאר ריק לקמפיין כללי)",
        next_step: "לשלב הבא",
        previous_step: "לשלב הקודם",
        
        // Ad Form
        product_service: "מה הפרספקטיב? (מוצר/שירות/מבצע)",
        product_example: "לדוגמה: הנחת סופיש 20% על כל הדגים",
        key_message: "מה ההסר המרכזי שחשוב להדגיש?",
        key_message_example: "לדוגמה: הדגשה על טריות, מחיר מיוחד, חווית אישית...",
        tone: "סגנון (Tone of Voice)",
        friendly: "ידידותי",
        professional: "מקצועי",
        exciting: "מרגש",
        casual: "קז'ואל",
        urgent: "דחוף",
        humorous: "הומוריסטי",
        ad_language: "שפת המודעה",
        hebrew: "עברית",
        english: "English",
        arabic: "العربية",
        spanish: "Español",
        french: "Français",
        german: "Deutsch",
        ad_style: "סגנון עיצובי",
        modern_bold: "🎨 מודרני ונועז",
        minimalist: "⚡ מינימליסטי",
        elegant_classy: "✨ אלגנטי ומעודן",
        dark_mysterious: "🌙 כהה ומסתורי",
        upload_image: "העלאת תמונה (אופציונלי)",
        upload_or_auto: "📸 העלה תמונה משלך או שנמצא אחת אוטומטית",
        generate_ad: "יצור מודעה",
        
        // Ad Results
        creating_ad: "יוצר את הקסם...",
        generating_marketing_copy: "מייצר טקסט שיווקי ותמונה מותאמת אישית...",
        ad_created_successfully: "✓ המודעה נוצרה בהצלחה!",
        ad_ready: "🎉 המודעה המקצועית שלך מוכנה!",
        marketing_copy: "טקסט שיווקי:",
        download_ad: "הורד את התמונה",
        create_another_ad: "צור מודעה נוספת",
        error_creating_ad: "שגיאה ביצירת המודעה",
        back_to_edit: "חזור לתיקון הפרטים",
        
        // Common
        required: "*",
        optional: "(אופציונלי)",
        save: "שמור",
        loading: "טוען...",
        error: "שגיאה",
        success: "הצלחה",
        please_select: "אנא בחר",
        search: "חיפוש",
        filter: "סינון",
        sort: "מיון",
        total: "סה\"כ",
        view_details: "צפה בפרטים",
        close: "סגור"
    },
    
    en: {
        // App General
        app_name: "Ads Maker",
        app_subtitle: "AI Marketing Studio",
        
        // Navigation
        main_menu: "Main Menu",
        dashboard: "Dashboard",
        dashboard_desc: "Overview and Analytics",
        companies: "Companies",
        companies_desc: "Business Profile Management",
        campaigns: "Campaigns",
        campaigns_desc: "Advertising Campaigns",
        ad_generator: "Ad Generator",
        ad_generator_desc: "AI-Powered Ad Creation",
        analytics: "Analytics",
        analytics_desc: "Performance Insights",
        
        // Settings
        settings: "Settings",
        dark_mode: "Dark Mode",
        language: "Language",
        
        // Dashboard
        marketing_dashboard: "Marketing Dashboard",
        real_time_monitoring: "Real-time AI-powered advertising campaign monitoring",
        manage_companies: "Manage Companies",
        create_ads: "Create Ads",
        
        // Stats Cards
        companies_count: "Companies",
        total_campaigns: "Total Campaigns",
        active_campaigns: "Active Campaigns",
        generated_ads: "Generated Ads",
        total_impressions: "Total Impressions",
        total_clicks: "Total Clicks",
        total_spend: "Total Spend",
        ctr: "CTR",
        
        // Chart Section
        performance_by_platform: "Campaign Performance by Platform",
        campaign_statistics: "Campaign Statistics",
        chart_coming_soon: "📊 Chart Coming Soon",
        
        // Quick Actions
        quick_actions: "Quick Actions",
        new_company: "New Company",
        add_business_profile: "Add Business Profile",
        create_campaign: "Create Campaign",
        start_new_campaign: "Start New Campaign",
        create_ad: "Create Ads",
        ai_powered_creation: "AI-Powered Creation",
        view_analytics: "View Analytics",
        performance_insights: "Performance Insights",
        
        // Recent Activity
        recent_activity: "Recent Activity",
        recent_companies: "Recent Companies",
        no_recent_activity: "No Recent Activity",
        no_companies: "No Companies in System",
        campaigns_count: "Campaigns",
        loading_activity: "Loading Activity...",
        loading_companies: "Loading Companies...",
        loading_data: "Loading Data...",
        error_loading: "Error Loading Data",
        ensure_server_running: "Please ensure the server is running",
        
        // Companies Page
        company_management: "Company Management",
        manage_business_profiles: "Manage your company and brand profiles",
        add_new_company: "Add New Company",
        company_details: "Company Details",
        select_company_to_view: "Select a company to view details",
        no_companies_yet: "No companies yet",
        
        // Company Form
        company_name: "Company Name",
        enter_company_name: "Enter company name",
        industry: "Industry",
        select_industry: "Select industry",
        technology: "Technology",
        fitness: "Fitness",
        restaurant: "Restaurant",
        fashion: "Fashion",
        real_estate: "Real Estate",
        education: "Education",
        healthcare: "Healthcare",
        other: "Other",
        description: "Description",
        describe_business: "Describe your business, products and services",
        target_demographics: "Target Demographics",
        describe_ideal_customers: "Describe your ideal customers (age, interests, location, etc.)",
        website: "Website",
        brand_colors: "Brand Colors",
        preferred_languages: "Preferred Languages for Ads",
        create_company: "Create Company",
        edit_company: "Edit Company",
        cancel: "Cancel",
        
        // Company Details
        no_description: "No Description",
        not_specified: "Not Specified",
        website_available: "Website Available",
        languages_count: "Languages",
        brand_colors_count: "Brand Colors",
        edit: "Edit",
        delete: "Delete",
        confirm_delete_company: "Are you sure you want to delete this company?",
        error_saving_company: "Error saving company",
        error_deleting_company: "Error deleting company",
        
        // Campaigns Page
        campaign_management: "Campaign Management",
        manage_all_campaigns: "Manage all your advertising campaigns in one place",
        new_campaign: "New Campaign",
        select_campaign_to_view: "Select Campaign to View Details",
        click_campaign_for_details: "Click on a campaign from the list to see full details",
        no_campaigns_yet: "No campaigns yet",
        
        // Campaign Form
        select_company: "Select Company",
        campaign_name: "Campaign Name",
        enter_campaign_name: "Enter campaign name",
        campaign_goal: "Campaign Goal",
        brand_awareness: "Brand Awareness",
        lead_generation: "Lead Generation",
        sales: "Sales",
        website_traffic: "Website Traffic",
        engagement: "Engagement",
        app_installs: "App Installs",
        budget: "Budget ($)",
        target_audience: "Target Audience",
        describe_target_audience: "Describe your target audience",
        geographic_location: "Geographic Location",
        israel: "Israel",
        age_range: "Age Range",
        interests: "Interests",
        select_interests: "Select Interests",
        food_restaurants: "Food & Restaurants",
        technology_interest: "Technology",
        sports_fitness: "Sports & Fitness",
        beauty_fashion: "Beauty & Fashion",
        health_wellness: "Health & Wellness",
        travel_tourism: "Travel & Tourism",
        family_kids: "Family & Kids",
        business_professional: "Business & Professional",
        recommended_platforms: "Recommended Platforms",
        
        // Campaign Status
        status: "Status",
        draft: "Draft",
        active: "Active",
        paused: "Paused",
        completed: "Completed",
        
        // Campaign Details
        campaign_info: "Campaign Information",
        platform: "Platform",
        impressions: "Impressions",
        clicks: "Clicks",
        creation_date: "Creation Date",
        advertising_platforms: "Advertising Platforms",
        confirm_delete_campaign: "Are you sure you want to delete this campaign?",
        error_saving_campaign: "Error saving campaign",
        error_deleting_campaign: "Error deleting campaign",
        
        // Ad Generator
        ad_generator_title: "Ad Generator",
        create_ai_ads: "Create AI-powered ads in a few simple steps",
        
        // Wizard Steps
        step_1_title: "Step 1: Select Campaign",
        step_2_title: "Step 2: Ad Details",
        step_3_title: "Step 3: Preview and Save",
        select_campaign_label: "Select Campaign",
        select_campaign_from_list: "Select company from list",
        select_campaign_optional: "Select Campaign",
        select_campaign_or_general: "Select campaign (or leave empty for general campaign)",
        next_step: "Next Step",
        previous_step: "Previous Step",
        
        // Ad Form
        product_service: "What's the perspective? (Product/Service/Promotion)",
        product_example: "e.g., 20% discount on all fish",
        key_message: "What's the key message to highlight?",
        key_message_example: "e.g., Emphasis on freshness, special price, personal experience...",
        tone: "Tone of Voice",
        friendly: "Friendly",
        professional: "Professional",
        exciting: "Exciting",
        casual: "Casual",
        urgent: "Urgent",
        humorous: "Humorous",
        ad_language: "Ad Language",
        hebrew: "Hebrew",
        english: "English",
        arabic: "Arabic",
        spanish: "Spanish",
        french: "French",
        german: "German",
        ad_style: "Design Style",
        modern_bold: "🎨 Modern & Bold",
        minimalist: "⚡ Minimalist",
        elegant_classy: "✨ Elegant & Classy",
        dark_mysterious: "🌙 Dark & Mysterious",
        upload_image: "Upload Image (Optional)",
        upload_or_auto: "📸 Upload your own image or we'll find one automatically",
        generate_ad: "Generate Ad",
        
        // Ad Results
        creating_ad: "Creating magic...",
        generating_marketing_copy: "Generating marketing copy and custom image...",
        ad_created_successfully: "✓ Ad Created Successfully!",
        ad_ready: "🎉 Your Professional Ad is Ready!",
        marketing_copy: "Marketing Copy:",
        download_ad: "Download Image",
        create_another_ad: "Create Another Ad",
        error_creating_ad: "Error creating ad",
        back_to_edit: "Back to Edit Details",
        
        // Common
        required: "*",
        optional: "(Optional)",
        save: "Save",
        loading: "Loading...",
        error: "Error",
        success: "Success",
        please_select: "Please Select",
        search: "Search",
        filter: "Filter",
        sort: "Sort",
        total: "Total",
        view_details: "View Details",
        close: "Close"
    }
};

// Language System Functions
function applyLanguage(lang) {
    const elements = document.querySelectorAll('[data-translate]');
    elements.forEach(element => {
        const key = element.getAttribute('data-translate');
        if (translations[lang] && translations[lang][key]) {
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.placeholder = translations[lang][key];
            } else {
                element.textContent = translations[lang][key];
            }
        }
    });
    
    // Update direction
    if (lang === 'he' || lang === 'ar') {
        document.documentElement.setAttribute('dir', 'rtl');
        document.body.style.direction = 'rtl';
    } else {
        document.documentElement.setAttribute('dir', 'ltr');
        document.body.style.direction = 'ltr';
    }
}

function changeLanguage(lang) {
    localStorage.setItem('language', lang);
    applyLanguage(lang);
}

function loadPreferences() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    const savedLang = localStorage.getItem('language') || 'he';
    
    // Apply theme
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('themeToggle');
        if (toggle) {
            toggle.classList.add('active');
            const icon = document.querySelector('.theme-icon');
            if (icon) {
                icon.classList.remove('fa-moon');
                icon.classList.add('fa-sun');
            }
        }
    }
    
    // Apply language
    const langSelect = document.getElementById('languageSelect');
    if (langSelect) {
        langSelect.value = savedLang;
    }
    applyLanguage(savedLang);
}

function toggleTheme() {
    const body = document.body;
    const toggle = document.getElementById('themeToggle');
    const icon = document.querySelector('.theme-icon');
    
    body.classList.toggle('dark-mode');
    toggle.classList.toggle('active');
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
        if (icon) {
            icon.classList.remove('fa-moon');
            icon.classList.add('fa-sun');
        }
    } else {
        localStorage.setItem('theme', 'light');
        if (icon) {
            icon.classList.remove('fa-sun');
            icon.classList.add('fa-moon');
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    loadPreferences();
});