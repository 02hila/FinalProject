import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './SharedHeader.css';

const SharedHeader = ({ userType, userName, onLogout }) => {
  const navigate = useNavigate();

  const getDashboardPath = () => {
    if (userType === 'company') return '/company-dashboard';
    if (userType === 'agent') return '/agent-dashboard';
    return '/dashboard';
  };

  // ✅ פונקציה לניווט לדף הבית
  const handleGoToHome = (e) => {
    e.preventDefault();
    navigate('/'); // נווט לדף הבית הראשי
  };

  return (
    <header className="shared-header">
      <div className="shared-header-container">
        <div className="shared-header-logo">
          <Link to={getDashboardPath()}>
            <h2>Ads-Maker</h2>
          </Link>
        </div>

        <nav className="shared-header-nav">
          <Link to={getDashboardPath()} className="nav-link">
            דשבורד
          </Link>
          
          <div className="nav-dropdown">
            <button className="nav-link dropdown-toggle">
              עוד מידע ▼
            </button>
            <div className="dropdown-menu">
              {/* ✅ תיקון - onClick במקום Link שלא עובד */}
              <a 
                href="/" 
                onClick={handleGoToHome} 
                className="dropdown-item"
              >
                דף הבית
              </a>
              <Link to="/privacy-policy" className="dropdown-item">מדיניות פרטיות</Link>
              <Link to="/terms-of-service" className="dropdown-item">תנאי שימוש</Link>
            </div>
          </div>
        </nav>

        <div className="shared-header-user">
          {/* שימוש ב-userName אם הוא קיים ולא ריק, אחרת שימוש ב-userType או 'מנהל' */}
          <span className="user-name">
            שלום, {userName && userName.trim() !== "" ? userName : (userType === 'admin' ? 'מנהל' : 'משתמש')}
          </span>
          <button onClick={onLogout} className="btn-logout">
            יציאה
          </button>
        </div>
      </div>
    </header>
  );
};

export default SharedHeader;