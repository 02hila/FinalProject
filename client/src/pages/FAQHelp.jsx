/**
 * FAQHelp.jsx
 *
 * FAQ & Help page for the Ads-Maker platform.
 * Provides frequently asked questions and a step-by-step workflow guide
 * to help users understand how to use the platform effectively.
 *
 * Route: /faq
 * Access: Public -- no authentication required.
 */

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './FAQHelp.css';

/**
 * FAQ data organized by category
 */
const faqData = {
  general: {
    title: 'שאלות כלליות',
    icon: '📋',
    questions: [
      {
        q: 'מהי מערכת Ads-Maker?',
        a: 'Ads-Maker היא פלטפורמה מתקדמת ליצירת וניהול מודעות פרסום. המערכת מחברת בין חברות המעוניינות לפרסם את מוצריהן לבין סוכנים מקצועיים שיוצרים עבורן מודעות איכותיות בעזרת בינה מלאכותית.'
      },
      {
        q: 'מי יכול להשתמש במערכת?',
        a: 'המערכת מיועדת לשני סוגי משתמשים: חברות שרוצות לפרסם את המוצרים שלהן, וסוכנים שרוצים ליצור מודעות ולהרוויח מהעבודה שלהם. כל אחד יכול להירשם ולבחור את סוג החשבון המתאים לו.'
      },
      {
        q: 'האם השימוש במערכת בחינם?',
        a: 'ההרשמה למערכת היא בחינם. חברות משלמות עבור מודעות שאושרו, והסוכנים מקבלים תשלום על העבודה שלהם. המחירים נקבעים בהתאם לקמפיין ולהצעות המחיר.'
      },
      {
        q: 'איך אני יכול ליצור קשר עם התמיכה?',
        a: 'ניתן ליצור קשר עם צוות התמיכה שלנו דרך טופס יצירת הקשר בדף הבית, או לשלוח מייל ישירות. אנחנו משתדלים לענות תוך 24 שעות.'
      }
    ]
  },
  company: {
    title: 'שאלות לחברות',
    icon: '🏢',
    questions: [
      {
        q: 'איך אני יוצר קמפיין חדש?',
        a: 'לאחר ההתחברות לדשבורד החברה, עברו ללשונית "קמפיינים" ולחצו על "צור קמפיין חדש". מלאו את פרטי הקמפיין כולל שם, תיאור, תקציב ותאריכי התחלה וסיום.'
      },
      {
        q: 'איך אני מאשר או דוחה מודעות?',
        a: 'בדשבורד החברה, עברו ללשונית "מודעות ממתינות". שם תוכלו לצפות בכל המודעות שהוגשו על ידי הסוכנים, ולאשר או לדחות כל מודעה בלחיצת כפתור.'
      },
      {
        q: 'איך אני בוחר סוכנים לקמפיין שלי?',
        a: 'בלשונית "סוכנים" תוכלו לצפות ברשימת כל הסוכנים הזמינים, לסנן לפי התמחות ודירוג, ולהקצות סוכנים לקמפיינים שלכם.'
      },
      {
        q: 'איך עובדת מערכת התשלומים?',
        a: 'לאחר אישור מודעה, תוכלו לבצע תשלום מאובטח דרך המערכת. התשלום מועבר לסוכן רק לאחר שהמודעה אושרה סופית.'
      }
    ]
  },
  agent: {
    title: 'שאלות לסוכנים',
    icon: '👤',
    questions: [
      {
        q: 'איך אני מתחיל ליצור מודעות?',
        a: 'לאחר ההתחברות, עברו לדף "יצירת מודעה". שם תוכלו להשתמש בכלי ה-AI המתקדם שלנו ליצירת מודעות מקצועיות. בחרו קמפיין, הזינו את הפרטים, והמערכת תיצור עבורכם מודעה.'
      },
      {
        q: 'מה קורה אחרי שאני שולח מודעה?',
        a: 'המודעה נשלחת לאישור החברה. תוכלו לעקוב אחרי הסטטוס בדף "המודעות שלי". אם המודעה אושרה - תקבלו התראה ותשלום. אם נדחתה - תקבלו משוב לשיפור.'
      },
      {
        q: 'איך אני משפר את הדירוג שלי?',
        a: 'הדירוג שלכם מבוסס על איכות המודעות, אחוז האישורים, ומשוב מהחברות. ככל שתיצרו יותר מודעות איכותיות שמאושרות, הדירוג שלכם ישתפר.'
      },
      {
        q: 'איך אני עוקב אחרי הביצועים של המודעות?',
        a: 'בדף "אנליטיקס QR" תוכלו לראות נתונים מפורטים על כמות הסריקות, מיקומים, ומעורבות של המודעות שלכם.'
      }
    ]
  },
  technical: {
    title: 'שאלות טכניות',
    icon: '⚙️',
    questions: [
      {
        q: 'באילו דפדפנים המערכת נתמכת?',
        a: 'המערכת נתמכת בכל הדפדפנים המודרניים: Chrome, Firefox, Safari, Edge. מומלץ להשתמש בגרסה העדכנית ביותר לחוויה הטובה ביותר.'
      },
      {
        q: 'שכחתי את הסיסמה, מה עושים?',
        a: 'בדף ההתחברות לחצו על "שכחתי סיסמה" והזינו את כתובת המייל שלכם. תקבלו קישור לאיפוס הסיסמה תוך דקות ספורות.'
      },
      {
        q: 'איך אני מעדכן את פרטי הפרופיל שלי?',
        a: 'היכנסו לדף הפרופיל שלכם דרך התפריט. שם תוכלו לעדכן את השם, תמונה, התמחויות, ופרטי התקשרות.'
      },
      {
        q: 'האם המידע שלי מאובטח?',
        a: 'כן, אנחנו משתמשים בהצפנה מתקדמת ופרוטוקולי אבטחה מחמירים. כל התשלומים מבוצעים דרך Stripe, שירות תשלומים מאובטח ומוכר.'
      }
    ]
  }
};

/**
 * Workflow steps for different user types
 */
const workflowSteps = {
  company: {
    title: 'מדריך לחברות',
    icon: '🏢',
    steps: [
      {
        number: 1,
        title: 'הרשמה והתחברות',
        description: 'הירשמו למערכת כחברה והזינו את פרטי העסק שלכם'
      },
      {
        number: 2,
        title: 'יצירת קמפיין',
        description: 'צרו קמפיין חדש עם פרטי המוצר, תקציב ותאריכים'
      },
      {
        number: 3,
        title: 'הקצאת סוכנים',
        description: 'בחרו סוכנים מתאימים והקצו אותם לקמפיין'
      },
      {
        number: 4,
        title: 'בדיקת מודעות',
        description: 'קבלו מודעות מהסוכנים ובדקו אותן'
      },
      {
        number: 5,
        title: 'אישור ותשלום',
        description: 'אשרו מודעות איכותיות ובצעו תשלום'
      },
      {
        number: 6,
        title: 'מעקב וניתוח',
        description: 'עקבו אחרי ביצועי המודעות באנליטיקס'
      }
    ]
  },
  agent: {
    title: 'מדריך לסוכנים',
    icon: '👤',
    steps: [
      {
        number: 1,
        title: 'הרשמה והתחברות',
        description: 'הירשמו למערכת כסוכן והשלימו את הפרופיל שלכם'
      },
      {
        number: 2,
        title: 'בחירת קמפיין',
        description: 'צפו בקמפיינים הזמינים ובחרו את המתאים לכם'
      },
      {
        number: 3,
        title: 'הגשת הצעת מחיר',
        description: 'הגישו הצעת מחיר לקמפיין שתרצו להשתתף בו'
      },
      {
        number: 4,
        title: 'יצירת מודעה',
        description: 'השתמשו בכלי ה-AI ליצירת מודעה מקצועית'
      },
      {
        number: 5,
        title: 'שליחה לאישור',
        description: 'שלחו את המודעה לבדיקת החברה'
      },
      {
        number: 6,
        title: 'קבלת תשלום',
        description: 'לאחר אישור, קבלו תשלום ומשוב'
      }
    ]
  }
};

/**
 * Individual FAQ item component with collapsible functionality
 */
const FAQItem = ({ question, answer, isOpen, onToggle }) => (
  <div className={`faq-item ${isOpen ? 'open' : ''}`}>
    <button className="faq-question" onClick={onToggle}>
      <span>{question}</span>
      <span className="faq-icon">{isOpen ? '−' : '+'}</span>
    </button>
    <div className="faq-answer">
      <p>{answer}</p>
    </div>
  </div>
);

/**
 * FAQ category section component
 */
const FAQCategory = ({ category, data, openItems, onToggle }) => (
  <div className="faq-category">
    <h3 className="category-title">
      <span className="category-icon">{data.icon}</span>
      {data.title}
    </h3>
    <div className="faq-list">
      {data.questions.map((item, index) => {
        const itemKey = `${category}-${index}`;
        return (
          <FAQItem
            key={itemKey}
            question={item.q}
            answer={item.a}
            isOpen={openItems.includes(itemKey)}
            onToggle={() => onToggle(itemKey)}
          />
        );
      })}
    </div>
  </div>
);

/**
 * Workflow step component
 */
const WorkflowStep = ({ step }) => (
  <div className="workflow-step">
    <div className="step-number">{step.number}</div>
    <div className="step-content">
      <h4>{step.title}</h4>
      <p>{step.description}</p>
    </div>
  </div>
);

/**
 * Main FAQ & Help page component
 */
const FAQHelp = () => {
  const navigate = useNavigate();
  const [openItems, setOpenItems] = useState([]);
  const [activeWorkflow, setActiveWorkflow] = useState('company');

  const handleBack = () => {
    // Navigate to the previous page in history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  const toggleItem = (itemKey) => {
    setOpenItems(prev =>
      prev.includes(itemKey)
        ? prev.filter(key => key !== itemKey)
        : [...prev, itemKey]
    );
  };

  const expandAll = () => {
    const allKeys = Object.entries(faqData).flatMap(([category, data]) =>
      data.questions.map((_, index) => `${category}-${index}`)
    );
    setOpenItems(allKeys);
  };

  const collapseAll = () => {
    setOpenItems([]);
  };

  return (
    <div className="faq-help-page">
      <div className="faq-container">
        {/* Header */}
        <header className="faq-header">
          <nav className="faq-nav">
            <button onClick={handleBack} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit', padding: 0 }}>
              → חזרה
            </button>
            <div className="logo">Ads-Maker</div>
          </nav>
        </header>

        {/* Hero Section */}
        <section className="faq-hero">
          <h1>מרכז העזרה</h1>
          <p>כל מה שצריך לדעת כדי להתחיל לעבוד עם Ads-Maker</p>
        </section>

        {/* Quick Links */}
        <section className="quick-links">
          <a href="#workflow" className="quick-link">
            <span className="quick-icon">📖</span>
            <span>מדריך שלב אחר שלב</span>
          </a>
          <a href="#faq" className="quick-link">
            <span className="quick-icon">❓</span>
            <span>שאלות נפוצות</span>
          </a>
          <Link to="/#contact" className="quick-link">
            <span className="quick-icon">📧</span>
            <span>צור קשר</span>
          </Link>
        </section>

        {/* Workflow Guide Section */}
        <section className="workflow-section" id="workflow">
          <h2 className="section-title">מדריך שלב אחר שלב</h2>
          <p className="section-subtitle">בחרו את סוג המשתמש שלכם לצפייה במדריך המותאם</p>

          <div className="workflow-tabs">
            <button
              className={`workflow-tab ${activeWorkflow === 'company' ? 'active' : ''}`}
              onClick={() => setActiveWorkflow('company')}
            >
              <span className="tab-icon">🏢</span>
              אני חברה
            </button>
            <button
              className={`workflow-tab ${activeWorkflow === 'agent' ? 'active' : ''}`}
              onClick={() => setActiveWorkflow('agent')}
            >
              <span className="tab-icon">👤</span>
              אני סוכן
            </button>
          </div>

          <div className="workflow-content">
            <h3 className="workflow-title">
              <span>{workflowSteps[activeWorkflow].icon}</span>
              {workflowSteps[activeWorkflow].title}
            </h3>
            <div className="workflow-steps">
              {workflowSteps[activeWorkflow].steps.map(step => (
                <WorkflowStep key={step.number} step={step} />
              ))}
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section className="faq-section" id="faq">
          <div className="faq-section-header">
            <h2 className="section-title">שאלות נפוצות</h2>
            <div className="faq-controls">
              <button onClick={expandAll} className="control-btn">פתח הכל</button>
              <button onClick={collapseAll} className="control-btn">סגור הכל</button>
            </div>
          </div>

          <div className="faq-categories">
            {Object.entries(faqData).map(([category, data]) => (
              <FAQCategory
                key={category}
                category={category}
                data={data}
                openItems={openItems}
                onToggle={toggleItem}
              />
            ))}
          </div>
        </section>

        {/* CTA Section */}
        <section className="cta-section">
          <h2>לא מצאתם את התשובה?</h2>
          <p>צוות התמיכה שלנו כאן לעזור לכם</p>
          <div className="cta-buttons">
            <Link to="/#contact" className="cta-button primary">צור קשר</Link>
            <Link to="/register" className="cta-button secondary">הרשמה למערכת</Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="faq-footer">
          <div className="footer-links">
            <Link to="/">דף הבית</Link>
            <Link to="/privacy-policy">מדיניות פרטיות</Link>
            <Link to="/terms-of-service">תנאי שימוש</Link>
          </div>
          <p className="copyright">© 2026 Ads-Maker. כל הזכויות שמורות.</p>
        </footer>
      </div>
    </div>
  );
};

export default FAQHelp;
