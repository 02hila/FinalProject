import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="landing-container">
        <header className="landing-header">
          <nav className="landing-nav">
            <div className="logo">Ads-Maker</div>
            <ul className="nav-links">
              <li><a href="#home">דף הבית</a></li>
              <li><a href="#features">תכונות</a></li>
              <li><a href="#contact">צור קשר</a></li>
            </ul>
          </nav>
        </header>

        <section className="hero">
          <h1>ברוכים הבאים ל-Ads-Maker</h1>
          <p className="subtitle">מערכת יצירת מודעות מתקדמת עבור חברות וסוכנים</p>
          <div className="cta-buttons">
            <Link to="/login" className="cta-button">התחברות</Link>
            <Link to="/register" className="cta-button cta-secondary">הרשמה</Link>
          </div>
        </section>

        <section className="features" id="features">
          <div className="feature-card">
            <h3>🏢 ניהול חברה מתקדם</h3>
            <p>נהלו את כל הקמפיינים והסוכנים שלכם ממקום אחד. צפייה בביצועים, אישור מודעות וניהול מלא של המערכת.</p>
          </div>
          <div className="feature-card">
            <h3>👤 פורטל סוכנים</h3>
            <p>סוכנים יכולים ליצור מודעות מותאמות אישית, לעקוב אחר הביצועים ולתקשר ישירות עם הלקוחות.</p>
          </div>
          <div className="feature-card">
            <h3>🤖 יצירת מודעות חכמה</h3>
            <p>טכנולוגיית AI מתקדמת ליצירת מודעות מקצועיות בהתאמה אישית לכל קמפיין וסוכן.</p>
          </div>
        </section>

        <footer className="landing-footer">
          <div className="footer-links">
            <Link to="/privacy-policy">מדיניות פרטיות</Link>
            <Link to="/terms-of-service">תנאי שימוש</Link>
            <a href="#contact">צור קשר</a>
            <a href="#about">אודות</a>
          </div>
          <p className="copyright">© 2024 Ads-Maker. כל הזכויות שמורות.</p>
        </footer>
      </div>
    </div>
  );
};

export default LandingPage;