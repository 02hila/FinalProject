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
              <Link to="/landing" className="dropdown-item">דף הבית</Link>
              <Link to="/privacy-policy" className="dropdown-item">מדיניות פרטיות</Link>
              <Link to="/terms-of-service" className="dropdown-item">תנאי שימוש</Link>
            </div>
          </div>
        </nav>

      <div className="shared-header-user">
  <button onClick={onLogout} className="btn-logout">
    יציאה
  </button>
</div>
      </div>
    </header>
  );
};

export default SharedHeader;