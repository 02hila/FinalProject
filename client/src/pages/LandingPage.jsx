import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  //  פונקציית סקרול חלקה
  const scrollToSection = (sectionId) => {
    const element = document.getElementById(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      // אם אין section כזה, גלול למעלה
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <nav className="landing-nav">
            <div className="logo">Ads-Maker</div>
            <ul className="nav-links">
              {/* ✅ עם onClick לסקרול חלק */}
              <li>
                <a 
                  href="#home" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('home');
                  }}
                >
                  דף הבית
                </a>
              </li>
              <li>
                <a 
                  href="#features" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('features');
                  }}
                >
                  תכונות
                </a>
              </li>
              <li>
                <a 
                  href="#contact" 
                  onClick={(e) => {
                    e.preventDefault();
                    scrollToSection('contact');
                  }}
                >
                  צור קשר
                </a>
              </li>
            </ul>
          </nav>
        </header>

        {/* ✅ הוספתי id="home" */}
        <section className="hero" id="home">
          <h1>ברוכים הבאים ל-Ads-Maker</h1>
          <p className="subtitle">מערכת יצירת מודעות מתקדמת עבור חברות וסוכנים</p>
          <div className="cta-buttons">
            <Link to="/login" className="cta-button">התחברות</Link>
            <Link to="/register" className="cta-button cta-secondary">הרשמה</Link>
          </div>
        </section>

        {/* ✅ id="features" כבר היה */}
        <section className="features" id="features">
          <h2 className="section-title">מה אנחנו מציעים?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">🏢</div>
              <h3>ניהול חברה מתקדם</h3>
              <p>נהלו את כל הקמפיינים והסוכנים שלכם ממקום אחד. צפייה בביצועים, אישור מודעות וניהול מלא של המערכת.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">👤</div>
              <h3>פורטל סוכנים</h3>
              <p>סוכנים יכולים ליצור מודעות מותאמות אישית, לעקוב אחר הביצועים ולתקשר ישירות עם הלקוחות.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">🤖</div>
              <h3>יצירת מודעות חכמה</h3>
              <p>טכנולוגיית AI מתקדמת ליצירת מודעות מקצועיות בהתאמה אישית לכל קמפיין וסוכן.</p>
            </div>
          </div>
        </section>

        {/* ✅ הוספתי section "צור קשר" */}
        <section className="contact-section" id="contact">
          <h2 className="section-title">צור קשר</h2>
          <div className="contact-content">
            <div className="contact-info">
              <div className="contact-item">
                <i className="fas fa-envelope"></i>
                <span>support@ads-maker.com</span>
              </div>
              <div className="contact-item">
                <i className="fas fa-phone"></i>
                <span>03-1234567</span>
              </div>
              <div className="contact-item">
                <i className="fas fa-map-marker-alt"></i>
                <span>תל אביב, ישראל</span>
              </div>
            </div>
            <div className="contact-form">
              <h3>שלח לנו הודעה</h3>
              <form onSubmit={(e) => {
                e.preventDefault();
                alert('תודה על פנייתך! ניצור איתך קשר בקרוב.');
              }}>
                <input type="text" placeholder="שם מלא" required />
                <input type="email" placeholder="אימייל" required />
                <textarea placeholder="הודעה" rows="4" required></textarea>
                <button type="submit" className="submit-button">שלח</button>
              </form>
            </div>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="footer-links">
            <Link to="/privacy-policy">מדיניות פרטיות</Link>
            <Link to="/terms-of-service">תנאי שימוש</Link>
            <a 
              href="#contact" 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('contact');
              }}
            >
              צור קשר
            </a>
            <a 
              href="#features" 
              onClick={(e) => {
                e.preventDefault();
                scrollToSection('features');
              }}
            >
              אודות
            </a>
          </div>
          <p className="copyright">© 2024 Ads-Maker. כל הזכויות שמורות.</p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;