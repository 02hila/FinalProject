import React, { useState } from 'react';

const PageSelectorModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPages, setSelectedPages] = useState([]);

  const pages = [
    { id: 1, name: 'Facebook Page 1', type: 'facebook' },
    { id: 2, name: 'Instagram Account', type: 'instagram' },
    { id: 3, name: 'Twitter Profile', type: 'twitter' },
  ];

  const togglePage = (pageId) => {
    setSelectedPages(prev =>
      prev.includes(pageId)
        ? prev.filter(id => id !== pageId)
        : [...prev, pageId]
    );
  };

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
