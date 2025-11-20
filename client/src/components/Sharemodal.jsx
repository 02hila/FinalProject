import React from "react";
import "./ShareModal.css";

const ShareModal = ({ isOpen, onClose, ad }) => {
  if (!isOpen || !ad) return null;

  // יצירת קישור לדף הביניים
  const baseUrl = window.location.origin;
  const shareUrl = `${baseUrl}/ad/${ad._id}`;
  
  // יצירת טקסט לשיתוף
  const shareText = ad.title || ad.generatedText || "בדקו את המודעה הזו!";
  const adDescription = ad.text || ad.keyMessage || "";
  const fullText = adDescription 
    ? `${shareText}\n${adDescription}\n\n${shareUrl}` 
    : `${shareText}\n\n${shareUrl}`;

  // פונקציות שיתוף לכל רשת
  const shareToWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(fullText)}`;
    window.open(url, "_blank");
    onClose();
  };

  const shareToFacebook = () => {
    const url = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
    onClose();
  };

  const shareToTelegram = () => {
    const url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(url, "_blank");
    onClose();
  };

  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
    onClose();
  };

  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`;
    window.open(url, "_blank");
    onClose();
  };

  const shareByEmail = () => {
    const subject = encodeURIComponent(ad.title || "מודעה מעניינת");
    const body = encodeURIComponent(fullText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
    onClose();
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert("הקישור הועתק!");
      onClose();
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  // שיתוף באמצעות Web Share API (למובייל)
  const nativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: ad.title || "מודעה",
          text: shareText,
          url: shareUrl,
        });
        onClose();
      } catch (err) {
        console.log("Share cancelled");
      }
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
          {/* כפתור שיתוף נייטיב למובייל */}
          {navigator.share && (
            <button className="share-btn share-native" onClick={nativeShare}>
              <i className="fas fa-share-alt"></i>
              <span>שתף</span>
            </button>
          )}

          <button className="share-btn share-whatsapp" onClick={shareToWhatsApp}>
            <i className="fab fa-whatsapp"></i>
            <span>WhatsApp</span>
          </button>

          <button className="share-btn share-facebook" onClick={shareToFacebook}>
            <i className="fab fa-facebook-f"></i>
            <span>Facebook</span>
          </button>

          <button className="share-btn share-telegram" onClick={shareToTelegram}>
            <i className="fab fa-telegram-plane"></i>
            <span>Telegram</span>
          </button>

          <button className="share-btn share-twitter" onClick={shareToTwitter}>
            <i className="fab fa-twitter"></i>
            <span>Twitter</span>
          </button>

          <button className="share-btn share-linkedin" onClick={shareToLinkedIn}>
            <i className="fab fa-linkedin-in"></i>
            <span>LinkedIn</span>
          </button>

          <button className="share-btn share-email" onClick={shareByEmail}>
            <i className="fas fa-envelope"></i>
            <span>Email</span>
          </button>

          <button className="share-btn share-copy" onClick={copyToClipboard}>
            <i className="fas fa-copy"></i>
            <span>העתק קישור</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareModal;