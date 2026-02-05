/**
 * TermsOfService.jsx
 *
 * Static legal page displaying the platform's terms of service.
 *
 * Route: /terms-of-service
 * Access: Public -- no authentication required.
 * API: None.
 * Context: None.
 *
 * Covers definitions, acceptance, permitted use, user accounts,
 * intellectual property, liability limitations, indemnification,
 * service changes, termination, jurisdiction, and external links.
 * Content is in English.
 */

import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './PolicyPage.css';

/**
 * TermsOfService component.
 *
 * Renders the complete terms of service document. Provides a back
 * button that navigates to the previous page.
 *
 * @returns {JSX.Element} The terms of service page.
 */
const TermsOfService = () => {
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

        <h1>תנאי השירות</h1>
        <p className="last-updated">עדכון אחרון: נובמבר 2025</p>

        <div className="highlight warning">
          <p><strong>קרא בעיון:</strong> שימוש באתר ובשירותים שלנו מהווה הסכמה לתנאים אלה. אם אינך מסכים לתנאים, אנא הימנע משימוש בשירות.</p>
        </div>

        <section>
          <h2>1. הגדרות</h2>
          <p>במסמך זה:</p>
          <ul>
            <li><strong>"החברה"</strong> - מתייחס לחברה שלנו ולכל חברות הבת שלה</li>
            <li><strong>"השירות"</strong> - האתר, האפליקציה וכל השירותים הקשורים</li>
            <li><strong>"משתמש"</strong> או <strong>"אתה"</strong> - כל אדם או גוף המשתמש בשירות</li>
            <li><strong>"תוכן"</strong> - כל מידע, טקסט, תמונה או חומר אחר</li>
          </ul>
        </section>

        <section>
          <h2>2. קבלת התנאים</h2>
          <p>בגישה לשירות ושימוש בו, אתה מצהיר כי:</p>
          <ul>
            <li>אתה בן 18 לפחות או שיש לך הסכמה של הורה/אפוטרופוס</li>
            <li>יש לך את הזכות והסמכות לקבל את תנאים אלה</li>
            <li>השימוש שלך בשירות אינו מפר כל חוק או תקנה</li>
            <li>כל המידע שאתה מספק הוא נכון ומדויק</li>
          </ul>
        </section>

        <section>
          <h2>3. שימוש מותר</h2>
          <p>אתה רשאי להשתמש בשירות למטרות חוקיות בלבד. אסור לך:</p>
          <ul>
            <li>להפר זכויות קניין רוחני של החברה או צד שלישי</li>
            <li>להעלות תוכן פוגעני, בלתי חוקי, או מזיק</li>
            <li>להפיץ וירוסים, תוכנות זדוניות או כל קוד מזיק אחר</li>
            <li>לנסות לחדור למערכות או לרשתות של החברה</li>
            <li>להפריע לשימוש של משתמשים אחרים בשירות</li>
            <li>להשתמש בשירות למטרות מסחריות ללא אישור בכתב</li>
            <li>לאסוף מידע על משתמשים אחרים ללא הסכמתם</li>
          </ul>
        </section>

        <section>
          <h2>4. רישום וחשבון משתמש</h2>
          <p>כדי להשתמש בחלק מהשירותים, עליך ליצור חשבון:</p>
          <ul>
            <li>אתה אחראי לשמור על סודיות פרטי ההתחברות שלך</li>
            <li>אתה אחראי לכל הפעילות תחת החשבון שלך</li>
            <li>עליך להודיע לנו מיד על כל שימוש לא מורשה בחשבון</li>
            <li>החברה שומרת לעצמה את הזכות להשעות או לסגור חשבונות</li>
          </ul>
        </section>

        <section>
          <h2>5. קניין רוחני</h2>
          <p>כל התוכן, העיצוב, הלוגו, הקוד והחומרים באתר הם קניינה של החברה או של מעניקי הרישיון שלה:</p>
          <ul>
            <li>מוגנים תחת חוקי זכויות יוצרים, סימני מסחר ודינים אחרים</li>
            <li>אסור להעתיק, לשכפל, להפיץ או לעשות שימוש מסחרי ללא אישור</li>
            <li>כל התוכן שאתה מעלה נשאר בבעלותך, אך אתה נותן לנו רישיון להשתמש בו</li>
          </ul>
        </section>

        <div className="important">
          <h2>6. הגבלת אחריות</h2>
          <p><strong>חשוב מאוד:</strong></p>
          <p>השירות ניתן "כמות שהוא" ו-"כפי שזמין". החברה אינה מתחייבת כי השירות יהיה זמין תמיד, בטוח, או ללא שגיאות.</p>
          <p>החברה לא תישא באחריות לכל נזק ישיר, עקיף, מקרי, תוצאתי או עונשי הנובע מהשימוש או חוסר היכולת להשתמש בשירות.</p>
        </div>

        <section>
          <h2>7. שיפוי</h2>
          <p>אתה מסכים לשפות ולפצות את החברה, עובדיה ושותפיה בגין כל תביעה, הפסד או נזק הנובעים מ:</p>
          <ul>
            <li>השימוש שלך בשירות</li>
            <li>הפרה של תנאי שימוש אלה</li>
            <li>הפרה של זכויות צד שלישי</li>
            <li>תוכן שהעלית לשירות</li>
          </ul>
        </section>

        <section>
          <h2>8. שינויים בשירות</h2>
          <p>החברה שומרת לעצמה את הזכות:</p>
          <ul>
            <li>לשנות, להשעות או להפסיק כל חלק מהשירות בכל עת</li>
            <li>לשנות את תנאי השימוש מעת לעת</li>
            <li>לשנות את מחירי השירותים עם הודעה מוקדמת</li>
          </ul>
        </section>

        <section>
          <h2>9. סיום השימוש</h2>
          <p>החברה רשאית לסיים את גישתך לשירות בכל עת, ללא הודעה מוקדמת, במקרים של:</p>
          <ul>
            <li>הפרה של תנאי שימוש אלה</li>
            <li>פעילות חשודה או בלתי חוקית</li>
            <li>בקשה שלך לסגירת חשבון</li>
            <li>דרישה משפטית</li>
          </ul>
        </section>

        <section>
          <h2>10. דין וסמכות שיפוט</h2>
          <p>תנאים אלה כפופים לדיני מדינת ישראל. כל מחלוקת תידון בבתי המשפט המוסמכים בישראל.</p>
        </section>

        <section>
          <h2>11. הוראות כלליות</h2>
          <ul>
            <li>אם הוראה כלשהי נמצאת בלתי תקפה, שאר ההוראות יישארו בתוקף</li>
            <li>אי אכיפה של זכות אינה מהווה ויתור עליה</li>
            <li>תנאים אלה מהווים את כל ההסכם בינך לבין החברה</li>
            <li>אסור להעביר את זכויותיך לפי תנאים אלה ללא אישור בכתב</li>
          </ul>
        </section>

        <section>
          <h2>12. קישורים לאתרים חיצוניים</h2>
          <p>השירות עשוי להכיל קישורים לאתרים של צדדים שלישיים. החברה אינה אחראית לתוכן או לפרקטיקות הפרטיות של אתרים אלה.</p>
        </section>

        <section>
          <h2>13. הודעות</h2>
          <p>כל הודעה אליך תישלח לכתובת הדואר האלקטרוני שסיפקת. אתה מסכים לקבל הודעות אלקטרוניות ומתחייב לשמור על כתובת מייל עדכנית.</p>
        </section>

        <div className="contact-info">
          <h2>צור קשר</h2>
          <p>לשאלות או בקשות בנוגע לתנאי השימוש, ניתן ליצור קשר:</p>
          <p><strong>דואר אלקטרוני:</strong> hilamaayan99@gmail.com</p>
          <p><strong>טלפון:</strong> 03-1234567</p>
          <p><strong>כתובת:</strong> תל אביב, ישראל</p>
        </div>

        <p style={{ marginTop: '30px', fontSize: '14px', color: '#666' }}>
          בשימוש בשירות, אתה מאשר כי קראת, הבנת והסכמת להיות מחויב לתנאי שימוש אלה.
        </p>
      </div>
    </div>
  );
};

export default TermsOfService;
