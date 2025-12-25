import React, { useState } from 'react';
import './Sharemodal.css';

const ShareModal = ({ isOpen, onClose, ad }) => {
  const [copying, setCopying] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !ad) return null;

  const baseUrl = window.location.origin;
  const redirectUrl = `${baseUrl}/ad/${ad._id}`;
  const shareText = ad.title || ad.text || ad.generatedText || 'בואו לראות את המבצע שלנו!';
  const adDescription = ad.text || ad.keyMessage || '';
  const fullShareText = adDescription
    ? `${shareText}\n${adDescription}\n\n${redirectUrl}`
    : `${shareText}\n\n${redirectUrl}`;

  // פתיחת חלון שיתוף ואז הצגת Pop-up אישור
  const handleShareClick = (shareFunction, platform) => {
    setCurrentPlatform(platform);
    shareFunction(); // פותח את חלון השיתוף
    
    // אחרי 2 שניות מציג את ה-Pop-up "האם שיתפת?"
    setTimeout(() => {
      setShowConfirmPopup(true);
    }, 2000);
  };

  // המשתמש אישר ששיתף
  const handleConfirmYes = async () => {
    setIsProcessing(true);
    setShowConfirmPopup(false);
    
    try {
      const response = await fetch(`https://adsmaker.onrender.com/api/share/confirm-share/${ad._id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ platform: currentPlatform })
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert('🎉 תודה! נשלחה הודעה לחברה.');
        onClose();
      } else {
        // אם החברה לא אישרה הצעת מחיר
        setBlockReason(data.message);
        setShowBlockedPopup(true);
      }
    } catch (error) {
      console.error('Error confirming share:', error);
      alert('שגיאה בעדכון השיתוף');
    } finally {
      setIsProcessing(false);
    }
  };

  // המשתמש לא שיתף
  const handleConfirmNo = () => {
    setShowConfirmPopup(false);
  };

  // פונקציות שיתוף (ללא שינוי)
  const shareToWhatsApp = () => {
    const waText = encodeURIComponent(fullShareText);
    window.open(`https://wa.me/?text=${waText}`, '_blank');
  };

  const shareToFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(redirectUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank');
  };

  const shareToInstagram = async () => {
    await copyToClipboard(fullShareText);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = 'instagram://camera';
    } else {
      window.open('https://www.instagram.com/', '_blank');
    }
  };

  const shareToTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(redirectUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank');
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(ad.title || 'מודעה מעניינת');
    const body = encodeURIComponent(fullShareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
    setCopying(true);
    setTimeout(() => setCopying(false), 2000);
  };

  const copyLink = async () => {
    await copyToClipboard(redirectUrl);
    setCurrentPlatform('copy_link');
    setShowConfirmPopup(true);
  };

  const downloadImage = async () => {
    try {
      const response = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${ad._id}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('שגיאה בהורדה');
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-${ad._id}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      setCurrentPlatform('download');
      setShowConfirmPopup(true);
    } catch (error) {
      console.error('Download error:', error);
      alert('שגיאה בהורדת התמונה');
    }
  };

  return (
    <div className="share-modal-overlay" onClick={onClose}>
      <div className="share-modal-content" onClick={(e) => e.stopPropagation()}>

        <div className="share-modal-header">
          <h3>שתף מודעה</h3>
          <button className="share-modal-close" onClick={onClose}>
            <i className="fas fa-times"></i>
          </button>
        </div>

        {/* ✅ Pop-up אישור שיתוף */}
        {showConfirmPopup && (
          <div className="share-confirm-popup">
            <div className="confirm-popup-content">
              <i className="fas fa-question-circle"></i>
              <h4>האם שיתפת את הפרסומת?</h4>
              <p>אם שיתפת, נשלח הודעה לחברה</p>
              <div className="confirm-buttons">
                <button 
                  className="confirm-yes" 
                  onClick={handleConfirmYes}
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <><i className="fas fa-spinner fa-spin"></i> שולח...</>
                  ) : (
                    <><i className="fas fa-check"></i> כן, שיתפתי</>
                  )}
                </button>
                <button className="confirm-no" onClick={handleConfirmNo}>
                  <i className="fas fa-times"></i> לא
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ✅ Pop-up חסימה */}
        {showBlockedPopup && (
          <div className="share-blocked-popup">
            <div className="blocked-popup-content">
              <i className="fas fa-exclamation-triangle"></i>
              <h4>לא ניתן להשלים כרגע</h4>
              <p>{blockReason}</p>
              <button onClick={() => setShowBlockedPopup(false)}>הבנתי</button>
            </div>
          </div>
        )}

        <div className="share-modal-body">
          <button className="share-btn share-whatsapp" onClick={() => handleShareClick(shareToWhatsApp, 'whatsapp')}>
            <i className="fab fa-whatsapp"></i> WhatsApp
          </button>

          <button className="share-btn share-facebook" onClick={() => handleShareClick(shareToFacebook, 'facebook')}>
            <i className="fab fa-facebook-f"></i> Facebook
          </button>

          <button className="share-btn share-instagram" onClick={() => handleShareClick(shareToInstagram, 'instagram')}>
            <i className="fab fa-instagram"></i> Instagram
          </button>

          <button className="share-btn share-telegram" onClick={() => handleShareClick(shareToTelegram, 'telegram')}>
            <i className="fab fa-telegram-plane"></i> Telegram
          </button>

          <button className="share-btn share-twitter" onClick={() => handleShareClick(shareToTwitter, 'twitter')}>
            <i className="fab fa-twitter"></i> Twitter
          </button>

          <button className="share-btn share-linkedin" onClick={() => handleShareClick(shareToLinkedIn, 'linkedin')}>
            <i className="fab fa-linkedin-in"></i> LinkedIn
          </button>

          <button className="share-btn share-email" onClick={() => handleShareClick(shareByEmail, 'email')}>
            <i className="fas fa-envelope"></i> Email
          </button>

          <button className="share-btn share-download" onClick={downloadImage}>
            <i className="fas fa-download"></i> הורד תמונה
          </button>

          <button className="share-btn share-copy" onClick={copyLink}>
            <i className="fas fa-copy"></i> העתק קישור
          </button>
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