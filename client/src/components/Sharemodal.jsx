import React, { useState } from 'react';
import './Sharemodal.css';

const ShareModal = ({ isOpen, onClose, ad }) => {
  const [copying, setCopying] = useState(false);
  const [checking, setChecking] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  if (!isOpen || !ad) return null;

  const baseUrl = window.location.origin;
  const redirectUrl = `${baseUrl}/ad/${ad._id}`;
  const shareText = ad.title || ad.text || ad.generatedText || 'בואו לראות את המבצע שלנו!';
  const adDescription = ad.text || ad.keyMessage || '';
  const fullShareText = adDescription
    ? `${shareText}\n${adDescription}\n\n${redirectUrl}`
    : `${shareText}\n\n${redirectUrl}`;

  // ✅ NEW: בדיקה לפני כל שיתוף
  const checkBeforeShare = async () => {
    try {
      setChecking(true);
      const response = await fetch(`https://adsmaker.onrender.com/api/share/check-before-share/${ad._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      
      const data = await response.json();
      
      if (!data.canShare) {
        setBlockReason(data.message);
        setShowBlockedPopup(true);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking share status:', error);
      return true; // במקרה של שגיאה, נאפשר להמשיך
    } finally {
      setChecking(false);
    }
  };

  // ✅ NEW: אישור שיתוף בשרת
  const confirmShare = async (platform) => {
    try {
      await fetch(`https://adsmaker.onrender.com/api/share/confirm-share/${ad._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ platform })
      });
    } catch (error) {
      console.error('Error confirming share:', error);
    }
  };

  // ✅ פונקציית עטיפה לכל שיתוף
  const handleShare = async (shareFunction, platform) => {
    const canShare = await checkBeforeShare();
    if (!canShare) return;
    
    await confirmShare(platform);
    await shareFunction();
  };

  // ... (שאר הפונקציות נשארות אותו דבר, רק מעטפים אותן)

  const shareToWhatsApp = async () => {
    const waText = encodeURIComponent(fullShareText);
    const url = `https://wa.me/?text=${waText}`;
    window.open(url, '_blank');
    onClose();
  };

  // ... שאר פונקציות השיתוף ...

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>

        <div className="share-modal-header">
          <h3>שתף מודעה</h3>
          <button className="share-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* ✅ Pop-up חסימה */}
        {showBlockedPopup && (
          <div className="share-blocked-popup">
            <div className="blocked-popup-content">
              <i className="fas fa-exclamation-triangle"></i>
              <h4>לא ניתן לשתף כרגע</h4>
              <p>{blockReason}</p>
              <button onClick={() => setShowBlockedPopup(false)}>הבנתי</button>
            </div>
          </div>
        )}

        {checking && (
          <div className="share-checking">
            <i className="fas fa-spinner fa-spin"></i>
            <span>בודק סטטוס...</span>
          </div>
        )}

        <div className="share-modal-body">
          <button 
            className="share-btn share-whatsapp" 
            onClick={() => handleShare(shareToWhatsApp, 'whatsapp')}
            disabled={checking}
          >
            <i className="fab fa-whatsapp"></i> WhatsApp
          </button>

          {/* ... שאר הכפתורים באותו פורמט ... */}
        </div>

        {copying && (
          <div className="copy-notification">
            <i className="fas fa-check"></i> הועתק בהצלחה!
          </div>
        )}
      </div>
    </div>
  );
};

export default ShareModal;