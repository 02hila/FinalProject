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
        content: 'גש במהירות לכל הפעולות החשובות: יצירת מודעות, צפייה במודעות קיימות, ניהול קמפיינים ועוד.',
        position: 'top',
        icon: '⚡'
    },
    {
        target: '[data-tour="ad-generator-link"]',
        title: 'מחולל מודעות',
        content: 'לחץ כאן כדי ליצור מודעות חדשות עם הכלי המתקדם שלנו. תוכל להשתמש בבינה מלאכותית ליצירת תוכן מושך.',
        position: 'bottom',
        icon: '🎨'
    },
    {
        target: '[data-tour="header-stats"]',
        title: 'סיכום מהיר',
        content: 'בחלק העליון תמיד תראה את הסטטיסטיקות המרכזיות שלך - מספר המודעות והדירוג הממוצע. הצלחה!',
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
        content: 'השתמש בלשוניות אלו כדי לנווט בין הסקירה הכללית, מודעות ממתינות, הצעות מחיר, קמפיינים וסוכנים.',
        position: 'bottom',
        icon: '📑'
    },
    {
        target: '[data-tour="pending-tab"]',
        title: 'מודעות ממתינות',
        content: 'כאן תראה את כל המודעות שהסוכנים יצרו וממתינות לאישורך. תוכל לאשר או לדחות כל מודעה.',
        position: 'bottom',
        icon: '⏰'
    },
    {
        target: '[data-tour="campaigns-tab"]',
        title: 'ניהול קמפיינים',
        content: 'צור וניהל קמפיינים פרסומיים. הגדר תקציב, קהל יעד ובחר סוכנים לעבודה.',
        position: 'bottom',
        icon: '🎯'
    },
    {
        target: '[data-tour="agents-tab"]',
        title: 'סוכנים זמינים',
        content: 'צפה ברשימת הסוכנים הזמינים במערכת, סנן לפי דירוג והתמחות, ובחר סוכנים לקמפיינים שלך.',
        position: 'bottom',
        icon: '👥'
    },
    {
        target: '[data-tour="stats-overview"]',
        title: 'סקירת נתונים',
        content: 'בסקירה הכללית תוכל לראות את כל הנתונים החשובים במבט אחד: מודעות, הצעות מחיר וסטטוס הקמפיינים. בהצלחה!',
        position: 'top',
        icon: '📈'
    }
];

export default { agentTourSteps, companyTourSteps };
