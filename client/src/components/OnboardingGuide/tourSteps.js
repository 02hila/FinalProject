/**
 * Tour Step Definitions
 *
 * Each step contains:
 * - target: CSS selector for the element to highlight
 * - title: Hebrew title for the step
 * - content: Hebrew description/instruction
 * - position: Tooltip position (top, bottom, left, right)
 * - icon: Emoji icon for the step
 */

// Agent Dashboard Tour Steps
export const agentTourSteps = [
    {
        target: '[data-tour="general-welcome"]',
        title: 'ברוכים הבאים לאתר!',
        content: 'האתר שלנו הוא פלטפורמה מתקדמת לניהול קמפיינים פרסומיים בין חברות לסוכני פרסום. כאן תוכל ליצור מודעות עם AI, לעקוב אחר ביצועים, ולנהל את הפעילות שלך בצורה יעילה.',
        position: 'bottom',
        icon: '🌟'
    },
    {
        target: '[data-tour="welcome-agent"]',
        title: 'ברוכים הבאים למערכת!',
        content: 'ברוכים הבאים למערכת הניהול של סוכני פרסום. האתר מאפשר לך לנהל פרופיל אישי, להשתתף בקמפיינים, ליצור מודעות מתקדמות עם AI, ולעקוב אחר ביצועי הפרסום בקלות וביעילות.',
        position: 'bottom',
        icon: '🎉'
    },
    {
        target: '[data-tour="profile-link"]',
        title: 'עריכת הפרופיל האישי',
        content: 'התחל בעריכת הפרופיל שלך: לחץ על "הפרופיל שלי" והשלם את המידע האישי כדי להתאים את החשבון לצרכיך.',
        position: 'bottom',
        icon: '👤'
    },
    {
        target: '[data-tour="dashboard-overview"]',
        title: 'סקירה כללית של הדשבורד',
        content: 'בדשבורד זה תוכל לראות את הדירוג שלך כסוכן, מספר הקמפיינים הפעילים, כמות המודעות שיצרת, והסטטוס הכללי של הפעילות שלך.',
        position: 'bottom',
        icon: '📊'
    },
    {
        target: '[data-tour="rating-display"]',
        title: 'הדירוג שלך',
        content: 'כאן מוצג הדירוג הנוכחי שלך כסוכן. הדירוג מבוסס על איכות המודעות והשביעות רצון החברות.',
        position: 'bottom',
        icon: '⭐'
    },
    {
        target: '[data-tour="active-campaigns-count"]',
        title: 'מספר הקמפיינים הפעילים',
        content: 'מספר זה מציג כמה קמפיינים פעילים הוקצו לך כרגע.',
        position: 'bottom',
        icon: '📈'
    },
    {
        target: '[data-tour="ads-created-count"]',
        title: 'כמות המודעות שיצרת',
        content: 'כאן תראה את מספר המודעות שיצרת עד כה.',
        position: 'bottom',
        icon: '🖼️'
    },
    {
        target: '[data-tour="rating-explanation"]',
        title: 'הסבר על הדירוג',
        content: 'הדירוג שלך כסוכן מבוסס על ביצועי המודעות והשביעות רצון החברות. ככל שתיצור מודעות טובות יותר ותקבל אישורים, הדירוג שלך יעלה ויפתח הזדמנויות חדשות.',
        position: 'bottom',
        icon: '⭐'
    },

    {
        target: '[data-tour="my-campaigns-link"]',
        title: 'צפייה בקמפיינים שלי',
        content: 'כאן תוכל לראות את כל הקמפיינים שהוקצו לך על ידי חברות.',
        position: 'bottom',
        icon: '📊'
    },
    {
        target: '[data-tour="my-campaigns-link"]',
        title: 'הגשת הצעת מחיר לקמפיין',
        content: 'מלא את פרטי ההצעה והסבר לחברה מדוע אתה מעוניין בשינוי התקציב של הקמפיין.',
        position: 'bottom',
        icon: '📝'
    },
    {
        target: '[data-tour="ad-generator-link"]',
        title: 'גישה למחולל מודעות',
        content: 'לחץ כאן כדי להשתמש במחולל המודעות המתקדם שלנו.',
        position: 'bottom',
        icon: '🎨'
    },
    {
        target: '[data-tour="ad-generator-link"]',
        title: 'יצירת מודעה חדשה',
        content: 'בחר את הקמפיין ומלא את פרטי המודעה שברצונך ליצור. יצירת מודעה ניתנת רק כאשר שויכת לקמפיין על ידי החברה.',
        position: 'bottom',
        icon: '🖼️'
    },
    {
        target: '[data-tour="ad-generator-link"]',
        title: 'שימוש בכלי ה-AI ליצירת מודעה',
        content: 'השתמש בכלי הבינה המלאכותית שלנו כדי ליצור מודעה מקצועית ומתאימה.',
        position: 'bottom',
        icon: '🤖'
    },
    {
        target: '[data-tour="my-ads-link"]',
        title: 'צפייה במודעות שלי',
        content: 'כאן תוכל לראות את כל המודעות שיצרת.',
        position: 'bottom',
        icon: '🖼️'
    },
    {
        target: '[data-tour="my-ads-link"]',
        title: 'מעקב אחר אישור המודעות',
        content: 'עקוב אחר סטטוס האישור של המודעות שלך. ברגע שהחברה מאשרת, תוכל להוריד את המודעה ולשתף אותה.',
        position: 'bottom',
        icon: '✅'
    },
    {
        target: '[data-tour="statistics-link"]',
        title: 'גישה לסטטיסטיקות שלי',
        content: 'לחץ כאן כדי לראות את הסטטיסטיקות והנתונים של המודעות.',
        position: 'bottom',
        icon: '📈'
    },
    {
        target: '[data-tour="statistics-link"]',
        title: 'עוקבים אחר נתוני הפרסומת',
        content: 'צפה בנתוני הביצועים של המודעות שלך, כולל סריקות QR ומידע נוסף.',
        position: 'bottom',
        icon: '📊'
    }
];

// Company Dashboard Tour Steps
export const companyTourSteps = [
    {
        target: '[data-tour="general-welcome"]',
        title: 'ברוכים הבאים לאתר!',
        content: 'האתר שלנו הוא פלטפורמה מתקדמת לניהול קמפיינים פרסומיים בין חברות לסוכני פרסום. כאן תוכל לנהל קמפיינים, לאשר מודעות ולעקוב אחר ביצועים.',
        position: 'bottom',
        icon: '🌟'
    },
    {
        target: '[data-tour="welcome-card"]',
        title: 'ברוך הבא לדשבורד החברה!',
        content: 'זהו מרכז הניהול של החברה שלך. כאן תוכל לנהל קמפיינים, לאשר מודעות ולעקוב אחר ביצועים.',
        position: 'bottom',
        icon: '🏢'
    },
    {
        target: '[data-tour="tabs-navigation"]',
        title: 'ניווט בלשוניות',
        content: 'השתמש בלשוניות אלו כדי לנווט בין החלקים השונים של הדשבורד. כל לשונית מכילה פונקציונליות שונה. בואו נעבור עליהן אחת אחת.',
        position: 'bottom',
        icon: '📑'
    },
    {
        target: '[data-tour="stats-overview"]',
        title: 'סקירה כללית',
        content: 'בלשונית זו תראה את כל הנתונים החשובים במבט אחד: מספר המודעות המאושרות, הממתינות והנדחות, וכן הצעות מחיר וסוכנים זמינים.',
        position: 'bottom',
        icon: '📊'
    },
    {
        target: '[data-tour="approved-ads-count"]',
        title: 'מספר המודעות המאושרות',
        content: 'כאן מוצג מספר המודעות שאושרו על ידך.',
        position: 'bottom',
        icon: '✅'
    },
    {
        target: '[data-tour="pending-ads-count"]',
        title: 'מספר המודעות הממתינות',
        content: 'מספר זה מציג כמה מודעות ממתינות לאישורך.',
        position: 'bottom',
        icon: '⏳'
    },
    {
        target: '[data-tour="rejected-ads-count"]',
        title: 'מספר המודעות הנדחות',
        content: 'כאן תראה את מספר המודעות שנדחו.',
        position: 'bottom',
        icon: '❌'
    },
    {
        target: '[data-tour="price-proposals-count"]',
        title: 'מספר הצעות המחיר',
        content: 'מספר הצעות המחיר הממתינות לטיפולך.',
        position: 'bottom',
        icon: '💰'
    },
    {
        target: '[data-tour="available-agents-count"]',
        title: 'מספר הסוכנים הזמינים',
        content: 'כאן מוצג מספר הסוכנים הזמינים במערכת.',
        position: 'bottom',
        icon: '👥'
    },
    {
        target: '[data-tour="qr-stats-tab"]',
        title: 'סטטיסטיקות QR',
        content: 'צפה בסטטיסטיקות של קודי QR במודעות שלך. כאן תוכל לראות כמה פעמים כל קוד נסרק ולעקוב אחרי האפקטיביות של המודעות.',
        position: 'bottom',
        icon: '📱'
    },
    {
        target: '[data-tour="pending-tab"]',
        title: 'מודעות ממתינות',
        content: 'כאן תראה את כל המודעות שהסוכנים יצרו וממתינות לאישורך. תוכל לאשר או לדחות כל מודעה, ולתת משוב לסוכן.',
        position: 'bottom',
        icon: '⏰'
    },
    {
        target: '[data-tour="proposals-tab"]',
        title: 'הצעות מחיר',
        content: 'כאן תראה הצעות מחיר מסוכנים שמבקשים לשנות את התקציב של קמפיין. תוכל לאשר או לדחות כל הצעה.',
        position: 'bottom',
        icon: '💰'
    },
    {
        target: '[data-tour="campaigns-tab"]',
        title: 'ניהול קמפיינים',
        content: 'צור ונהל קמפיינים פרסומיים. הגדר שם לקמפיין, תיאור, קהל יעד, תקציב ובחר סוכנים שיעבדו עליו.',
        position: 'bottom',
        icon: '🎯'
    },
    {
        target: '[data-tour="agents-tab"]',
        title: 'סוכנים זמינים',
        content: 'צפה ברשימת כל הסוכנים הזמינים במערכת. סנן לפי דירוג, התמחות או חפש לפי שם. בחר סוכנים מתאימים לקמפיינים שלך.',
        position: 'bottom',
        icon: '👥'
    },
    {
        target: '[data-tour="profile-tab"]',
        title: 'הפרופיל שלי',
        content: 'ערוך את פרטי החברה שלך, עדכן את הלוגו, פרטי התקשרות ומידע נוסף שיוצג לסוכנים.',
        position: 'bottom',
        icon: '👤'
    },
    {
        target: '[data-tour="history-tab"]',
        title: 'היסטוריה',
        content: 'צפה בהיסטוריית כל המודעות והקמפיינים שלך. כאן תוכל לראות מודעות שאושרו ונדחו בעבר. בהצלחה!',
        position: 'bottom',
        icon: '📜'
    }
];

export default { agentTourSteps, companyTourSteps };
