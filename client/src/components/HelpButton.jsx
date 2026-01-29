/**
 * HelpButton.jsx
 *
 * A floating help button component that appears on all pages.
 * Provides quick access to the FAQ & Help center.
 * Includes a tooltip on hover and smooth animations.
 *
 * Usage: Import and render this component in App.jsx or main layout
 * to make it visible across all pages.
 */

import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import './HelpButton.css';

/**
 * Floating help button with tooltip
 * @returns {JSX.Element} The floating help button component
 */
const HelpButton = () => {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="help-button-container">
      {showTooltip && (
        <div className="help-tooltip">
          עזרה ושאלות נפוצות
        </div>
      )}
      <Link
        to="/faq"
        className="help-button"
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        aria-label="עזרה ושאלות נפוצות"
      >
        <span className="help-icon">?</span>
      </Link>
    </div>
  );
};

export default HelpButton;
