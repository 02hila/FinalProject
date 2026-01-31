/**
 * PrivacyPolicy.jsx
 *
 * Static legal page displaying the platform's privacy policy.
 *
 * Route: /privacy-policy
 * Access: Public -- no authentication required.
 * API: None.
 * Context: None.
 *
 * Covers data collection, usage, sharing, security, user rights,
 * cookies, and policy change notifications. Content is in Hebrew.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './PolicyPage.css';

/**
 * PrivacyPolicy component.
 *
 * Renders the full privacy policy document with sections for each
 * topic. Provides a back button that navigates to the previous page.
 *
 * @returns {JSX.Element} The privacy policy page.
 */
const PrivacyPolicy = () => {
  const navigate = useNavigate();

  const handleBack = () => {
    // Navigate to the previous page in history
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="policy-page">
      <div className="policy-container">
        <button onClick={handleBack} className="back-link" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', color: 'inherit', padding: 0 }}>← חזרה</button>

        <h1>מדיניות פרטיות</h1>
        <p className="last-updated">עדכון אחרון: נובמבר 2024</p>

        <div className="highlight">
          <p><strong>אנו מחויבים להגן על פרטיותך.</strong> מדיניות פרטיות זו מסבירה כיצד אנו אוספים, משתמשים ומגנים על המידע האישי שלך.</p>
        </div>

        <section>
          <h2>1. איסוף מידע</h2>
          <p>אנו אוספים מידע שאתה מספק לנו באופן ישיר, כולל:</p>
          <ul>
            <li>שם מלא</li>
            <li>כתובת דואר אלקטרוני</li>
            <li>מספר טלפון</li>
            <li>כתובת מגורים (במידת הצורך)</li>
            <li>מידע על השימוש בשירותים שלנו</li>
          </ul>
        </section>

        <section>
          <h2>2. שימוש במידע</h2>
          <p>אנו משתמשים במידע שנאסף למטרות הבאות:</p>
          <ul>
            <li>מתן ושיפור השירותים שלנו</li>
            <li>תקשורת איתך לגבי החשבון והשירותים</li>
            <li>שליחת עדכונים ומידע שיווקי (בכפוף להסכמתך)</li>
            <li>זיהוי והגנה מפני הונאות</li>
            <li>עמידה בדרישות חוקיות</li>
          </ul>
        </section>

        <section>
          <h2>3. שיתוף מידע</h2>
          <p>אנו לא משתפים את המידע האישי שלך עם צדדים שלישיים, למעט במקרים הבאים:</p>
          <ul>
            <li>כאשר ניתנה הסכמתך המפורשת</li>
            <li>לספקי שירות הפועלים בשמנו (המחויבים לשמור על סודיות)</li>
            <li>כאשר נדרש על פי חוק או בהליך משפטי</li>
            <li>להגנה על זכויות, רכוש או בטחון החברה, משתמשיה או הציבור</li>
          </ul>
        </section>

        <section>
          <h2>4. אבטחת מידע</h2>
          <p>אנו נוקטים באמצעי אבטחה פיזיים, אלקטרוניים וניהוליים כדי להגן על המידע שלך מפני גישה, שימוש או גילוי בלתי מורשים. אמצעי האבטחה שלנו כוללים:</p>
          <ul>
            <li>הצפנת מידע רגיש</li>
            <li>שימוש בפרוטוקולי אבטחה מתקדמים (SSL/TLS)</li>
            <li>בקרת גישה מוגבלת למידע אישי</li>
            <li>עדכונים שוטפים של מערכות האבטחה</li>
          </ul>
        </section>

        <section>
          <h2>5. זכויותיך</h2>
          <p>לפי חוק הגנת הפרטיות, יש לך את הזכויות הבאות:</p>
          <ul>
            <li><strong>זכות עיון:</strong> לקבל מידע על הנתונים האישיים שלך המצויים ברשותנו</li>
            <li><strong>זכות תיקון:</strong> לתקן מידע שגוי או לא מדויק</li>
            <li><strong>זכות מחיקה:</strong> לבקש מחיקת המידע האישי שלך</li>
            <li><strong>זכות התנגדות:</strong> להתנגד לעיבוד המידע האישי שלך</li>
            <li><strong>זכות להעברה:</strong> לקבל את המידע שלך בפורמט מובנה</li>
          </ul>
        </section>

        <section>
          <h2>6. עוגיות (Cookies)</h2>
          <p>אנו משתמשים בעוגיות ובטכנולוגיות דומות כדי לשפר את חווית המשתמש שלך. אתה יכול לשלוט בהעדפות העוגיות שלך דרך הגדרות הדפדפן שלך.</p>
        </section>

        <section>
          <h2>7. שינויים במדיניות</h2>
          <p>אנו שומרים לעצמנו את הזכות לעדכן מדיניות פרטיות זו מעת לעת. שינויים מהותיים יפורסמו באתר ו/או נשלח אליך הודעה במייל.</p>
        </section>

        <section>
          <h2>8. מידע על קטינים</h2>
          <p>השירותים שלנו אינם מיועדים לקטינים מתחת לגיל 18. אנו לא אוספים במודע מידע אישי מקטינים ללא הסכמת הורים.</p>
        </section>

        <div className="contact-info">
          <h2>צור קשר</h2>
          <p>לשאלות או בקשות בנוגע למדיניות הפרטיות שלנו, ניתן ליצור קשר:</p>
          <p><strong>דואר אלקטרוני:</strong> hilamaayan99@gmail.com</p>
          <p><strong>טלפון:</strong> 03-1234567</p>
          <p><strong>כתובת:</strong> תל אביב, ישראל </p>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
