import React, { useState } from 'react';
import './Sharemodal.css';

const ShareModal = ({ isOpen, onClose, ad }) => {
  const [copying, setCopying] = useState(false);

  if (!isOpen || !ad) return null;

  // בניית קישור לפרסום
  const baseUrl = window.location.origin;
  const redirectUrl = `${baseUrl}/ad/${ad._id}`;

  // טקסט למודעה
  const shareText = ad.title || ad.text || ad.generatedText || 'בואו לראות את המבצע שלנו!';
  const adDescription = ad.text || ad.keyMessage || '';
  const fullShareText = adDescription
    ? `${shareText}\n${adDescription}\n\n${redirectUrl}`
    : `${shareText}\n\n${redirectUrl}`;

  // הורדת תמונה כ-Blob
  const downloadImageAsBlob = async () => {
    try {
      if (ad.imageData) {
        const response = await fetch(ad.imageData);
        const blob = await response.blob();
        return blob;
      }
      const response = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${ad._id}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const blob = await response.blob();
        return blob;
      }
      return null;
    } catch (error) {
      console.error('❌ Error downloading image:', error);
      return null;
    }
  };

  // העתקה ללוח
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

  // הורדת תמונה
  const downloadImage = async () => {
    try {
      const response = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${ad._id}/download`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) throw new Error('שגיאה בהורדה');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ad-${ad._id}.png`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('❌ Download error:', error);
      alert('שגיאה בהורדת התמונה');
    }
  };

  // אינסטגרם
  const shareToInstagram = async () => {
    const imageBlob = await downloadImageAsBlob();
    if (!imageBlob) {
      alert('שגיאה בטעינת התמונה');
      return;
    }

    // Web Share API
    if (navigator.share && navigator.canShare) {
      const file = new File([imageBlob], `ad-${ad._id}.png`, { type: 'image/png' });

      try {
        await navigator.share({
          title: ad.title || 'מודעה חדשה',
          text: shareText,
          url: redirectUrl,
          files: [file]
        });
        onClose();
        return;
      } catch (err) {}
    }

    // fallback למובייל
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    await copyToClipboard(fullShareText);

    if (isMobile) {
      window.location.href = 'instagram://camera';
      setTimeout(() => {
        alert('הטקסט הועתק! הדבק אותו בפוסט באינסטגרם');
      }, 600);
    } else {
      await downloadImage();
      alert('התמונה הורדה והטקסט הועתק! העלה אותה לפוסט באינסטגרם');
      window.open('https://www.instagram.com/', '_blank');
    }

    onClose();
  };

  // פייסבוק
  const shareToFacebook = async () => {
    await copyToClipboard(fullShareText);
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(redirectUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank');
    onClose();
  };

  // וואטסאפ
  const shareToWhatsApp = () => {
    const waText = encodeURIComponent(fullShareText);
    const url = `https://wa.me/?text=${waText}`;
    window.open(url, '_blank');
    onClose();
  };

  // טלגרם
  const shareToTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(redirectUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank');
    onClose();
  };

  // טוויטר
  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
    onClose();
  };

  // לינקדאין
  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
    onClose();
  };

  // אימייל
  const shareByEmail = () => {
    const subject = encodeURIComponent(ad.title || 'מודעה מעניינת');
    const body = encodeURIComponent(fullShareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    onClose();
  };

  // העתק קישור בלבד
  const copyLink = async () => {
    await copyToClipboard(redirectUrl);
    alert('הקישור הועתק!');
  };

  // שיתוף רגיל במובייל
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title,
          text: shareText,
          url: redirectUrl
        });
      } catch {}
      onClose();
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

        <div className="share-modal-body">

          {/* כפתור נייטיב במובייל */}
          {navigator.share && (
            <button className="share-btn share-native" onClick={nativeShare}>
              <i className="fas fa-share-alt"></i> שתף
            </button>
          )}

          <button className="share-btn share-instagram" onClick={shareToInstagram}>
            <i className="fab fa-instagram"></i> Instagram
          </button>

          <button className="share-btn share-whatsapp" onClick={shareToWhatsApp}>
            <i className="fab fa-whatsapp"></i> WhatsApp
          </button>

          <button className="share-btn share-facebook" onClick={shareToFacebook}>
            <i className="fab fa-facebook-f"></i> Facebook
          </button>

          <button className="share-btn share-telegram" onClick={shareToTelegram}>
            <i className="fab fa-telegram-plane"></i> Telegram
          </button>

          <button className="share-btn share-twitter" onClick={shareToTwitter}>
            <i className="fab fa-twitter"></i> Twitter
          </button>

          <button className="share-btn share-linkedin" onClick={shareToLinkedIn}>
            <i className="fab fa-linkedin-in"></i> LinkedIn
          </button>

          <button className="share-btn share-email" onClick={shareByEmail}>
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
