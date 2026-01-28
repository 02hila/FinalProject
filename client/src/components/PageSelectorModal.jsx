/**
 * PageSelectorModal.jsx
 *
 * A self-contained modal component that presents a list of social media pages
 * (Facebook, Instagram, Twitter) and allows the user to select one or more of
 * them via checkboxes. The component manages its own open/closed state: when
 * closed it renders a trigger button; when open it renders a full-screen overlay
 * with the page list and save/cancel actions.
 *
 * Props: none -- this component is fully self-managed with internal state.
 *
 * Used by: Ad publishing flows where the user needs to choose target social
 * media pages for an advertisement.
 *
 * Notable behaviour:
 *  - The list of available pages is currently hard-coded (placeholder data).
 *  - On save, the selected page IDs are logged to the console; integration
 *    with a backend or parent callback can be added as needed.
 */
import React, { useState } from 'react';

/**
 * Renders a button that opens a modal for selecting social media pages.
 *
 * @returns {React.ReactElement}
 */
const PageSelectorModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPages, setSelectedPages] = useState([]);

  /** Placeholder page data -- to be replaced with data from the backend. */
  const pages = [
    { id: 1, name: 'Facebook Page 1', type: 'facebook' },
    { id: 2, name: 'Instagram Account', type: 'instagram' },
    { id: 3, name: 'Twitter Profile', type: 'twitter' },
  ];

  /**
   * Toggles a page in or out of the current selection.
   * @param {number} pageId - The ID of the page to toggle.
   */
  const togglePage = (pageId) => {
    setSelectedPages(prev =>
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

  /** Logs the selected pages and closes the modal. */
  const handleSave = () => {
    console.log('Selected pages:', selectedPages);
    setIsOpen(false);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        style={{
          padding: '10px 20px',
          background: '#667eea',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          cursor: 'pointer',
          marginBottom: '20px'
        }}
      >
        בחר עמודים
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000
    }}>
      <div style={{
        background: 'white',
        padding: '20px',
        borderRadius: '12px',
        maxWidth: '500px',
        width: '90%',
        maxHeight: '80vh',
        overflow: 'auto'
      }}>
        <h3>בחר עמודים לפרסום</h3>
        <div style={{ marginBottom: '20px' }}>
          {pages.map(page => (
            <div key={page.id} style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              border: '1px solid #ddd',
              borderRadius: '8px',
              marginBottom: '10px'
            }}>
              <input
                type="checkbox"
                checked={selectedPages.includes(page.id)}
                onChange={() => togglePage(page.id)}
                style={{ marginLeft: '10px' }}
              />
              <div>
                <div style={{ fontWeight: 'bold' }}>{page.name}</div>
                <div style={{ fontSize: '12px', color: '#666' }}>{page.type}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
          <button
            onClick={() => setIsOpen(false)}
            style={{
              padding: '8px 16px',
              background: '#f0f0f0',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            ביטול
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: '#667eea',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer'
            }}
          >
            שמור
          </button>
        </div>
      </div>
    </div>
  );
};

export default PageSelectorModal;
