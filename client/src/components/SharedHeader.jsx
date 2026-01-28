/**
 * SharedHeader.jsx
 *
 * The top navigation bar shared across all authenticated dashboard views (admin,
 * company, and agent). It renders the application logo that links to the appropriate
 * dashboard, a navigation dropdown with informational pages, a personalised greeting,
 * and a logout button.
 *
 * Props:
 *  - userType (string)   'admin' | 'company' | 'agent' -- determines the dashboard link.
 *  - userName (string)   Display name for the greeting; falls back to a generic label.
 *  - onLogout (Function) Callback invoked when the user clicks the logout button.
 *
 * Used by: AdminDashboard, CompanyDashboard, and AgentDashboard page components.
 */
import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './SharedHeader.css';

/**
 * Renders the shared application header with logo, navigation, and user controls.
 *
 * @param {Object}   props
 * @param {string}   props.userType - The role of the current user.
 * @param {string}   props.userName - The user's display name.
 * @param {Function} props.onLogout - Handler for the logout action.
 * @returns {React.ReactElement}
 */
const SharedHeader = ({ userType, userName, onLogout }) => {
  const navigate = useNavigate();

  /**
   * Returns the correct dashboard path based on the current user's role.
   * @returns {string} Dashboard URL path.
   */
  const getDashboardPath = () => {
    if (userType === 'company') return '/company-dashboard';
    if (userType === 'agent') return '/agent-dashboard';
    return '/dashboard';
  };

  /**
   * Navigates to the public home page. Uses programmatic navigation instead of
   * a plain Link to ensure proper SPA routing behavior from the dropdown.
   * @param {React.SyntheticEvent} e - Click event.
   */
  const handleGoToHome = (e) => {
    e.preventDefault();
    navigate('/');
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
          {/* Show the user's name if available; otherwise fall back to a role label. */}
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
