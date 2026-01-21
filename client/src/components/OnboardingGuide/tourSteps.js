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
        target: '[data-tour="welcome-card"]',
        title: 'ברוך הבא לדשבורד!',
        content: 'זהו הדשבורד האישי שלך. כאן תוכל לנהל את כל הפעילות שלך במערכת, לראות סטטיסטיקות ולגשת לכל הכלים.',
        position: 'bottom',
        icon: '👋'
    },
    {
        target: '[data-tour="stats-grid"]',
        title: 'הסטטיסטיקות שלך',
        content: 'כאן מוצגים הנתונים החשובים: מודעות שאושרו, ממתינות לאישור, נדחו וסך הכל. הנתונים מתעדכנים אוטומטית.',
        position: 'top',
        icon: '📊'
    },
    {
        target: '[data-tour="quick-actions"]',
        title: 'פעולות מהירות',
        content: 'כאן תמצא את כל הפעולות החשובות במקום אחד: יצירת מודעות, צפייה במודעות קיימות, ניהול קמפיינים, סטטיסטיקות והפרופיל שלך.',
        position: 'top',
        icon: '⚡'
    },
    {
        target: '[data-tour="ad-generator-link"]',
        title: 'מחולל מודעות',
        content: 'לחץ כאן כדי ליצור מודעות חדשות עם הכלי המתקדם שלנו. אם חברה בחרה אותך לקמפיין, תוכל להשתמש במחולל המודעות כדי ליצור עבורה תוכן מושך ומקצועי.',
        position: 'bottom',
        icon: '🎨'
    },
    {
        target: '[data-tour="my-ads-link"]',
        title: 'המודעות שלי',
        content: 'כאן תוכל לצפות בכל המודעות שיצרת, לעקוב אחר הסטטוס שלהן (מאושרות, ממתינות, נדחו) ולערוך אותן במידת הצורך.',
        position: 'bottom',
        icon: '🖼️'
    },
    {
        target: '[data-tour="my-campaigns-link"]',
        title: 'הקמפיינים שלי',
        content: 'צפה בכל הקמפיינים שחברות הקצו לך. כאן תוכל לראות את פרטי הקמפיין, התקציב וההנחיות מהחברה.',
        position: 'bottom',
        icon: '📊'
    },
    {
        target: '[data-tour="header-stats"]',
        title: 'סיכום מהיר',
        content: 'בחלק העליון תמיד תראה את הסטטיסטיקות המרכזיות שלך - מספר המודעות והדירוג הממוצע. בהצלחה!',
        position: 'bottom',
        icon: '🌟'
    }
];

// Company Dashboard Tour Steps
export const companyTourSteps = [
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
        content: 'השתמש בלשוניות אלו כדי לנווט בין החלקים השונים של הדשבורד. כל לשונית מכילה פונקציונליות שונה.',
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
        target: '[data-tour="pending-tab"]',
        title: 'מודעות ממתינות',
        content: 'כאן תראה את כל המודעות שהסוכנים יצרו וממתינות לאישורך. תוכל לאשר או לדחות כל מודעה, ולתת משוב לסוכן.',
        position: 'bottom',
        icon: '⏰'
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
        target: '[data-tour="history-tab"]',
        title: 'היסטוריה',
        content: 'צפה בהיסטוריית כל המודעות והקמפיינים שלך. כאן תוכל לראות מודעות שאושרו ונדחו בעבר. בהצלחה!',
        position: 'bottom',
        icon: '📜'
    }
];

export default { agentTourSteps, companyTourSteps };
