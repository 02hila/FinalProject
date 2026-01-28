/**
 * Sharemodal.jsx
 *
 * A modal dialog that lets agents share an advertisement across multiple social
 * platforms (WhatsApp, Facebook, Instagram, Telegram, Twitter, LinkedIn, Email),
 * copy the share link, or download the ad image. After the user triggers a share
 * action the modal presents a confirmation popup asking whether the share actually
 * took place; on confirmation it sends a POST to the backend so the company is
 * notified and share analytics are recorded. If the company has not approved the
 * ad for sharing, a "blocked" popup is shown instead.
 *
 * Props:
 *  - isOpen  (boolean)  Controls modal visibility.
 *  - onClose (Function) Callback to close the modal.
 *  - ad      (Object)   The advertisement object (must contain _id and title/text fields).
 *
 * Used by: AgentDashboard and related ad listing pages wherever an agent can share an ad.
 */
import React, { useState } from 'react';
import './Sharemodal.css';

/**
 * Renders a share-to-social-media modal for a given ad.
 *
 * @param {Object}   props
 * @param {boolean}  props.isOpen  - Whether the modal is currently visible.
 * @param {Function} props.onClose - Invoked to close the modal.
 * @param {Object}   props.ad      - The ad data; requires at least _id.
 * @returns {React.ReactElement|null}
 */
const ShareModal = ({ isOpen, onClose, ad }) => {
  const [copying, setCopying] = useState(false);
  const [showConfirmPopup, setShowConfirmPopup] = useState(false);
  const [showBlockedPopup, setShowBlockedPopup] = useState(false);
  const [blockReason, setBlockReason] = useState('');
  const [currentPlatform, setCurrentPlatform] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  if (!isOpen || !ad) return null;

  // Build the redirect URL that points to the public ad view page.
  const baseUrl = window.location.origin;
  const redirectUrl = `${baseUrl}/ad/${ad._id}`;
  const shareText = ad.title || ad.text || ad.generatedText || 'בואו לראות את המבצע שלנו!';
  const adDescription = ad.text || ad.keyMessage || '';
  const fullShareText = adDescription
    ? `${shareText}\n${adDescription}\n\n${redirectUrl}`
    : `${shareText}\n\n${redirectUrl}`;

  /**
   * Opens the platform-specific share window and, after a short delay, displays
   * a confirmation popup asking whether the user actually completed the share.
   *
   * @param {Function} shareFunction - Platform share launcher (e.g. shareToWhatsApp).
   * @param {string}   platform      - Platform identifier sent to the backend.
   */
  const handleShareClick = (shareFunction, platform) => {
    setCurrentPlatform(platform);
    shareFunction();

    // Allow time for the share window to open before prompting for confirmation.
    setTimeout(() => {
      setShowConfirmPopup(true);
    }, 2000);
  };

  /**
   * Called when the user confirms they completed the share. Sends a POST request
   * to record the share event. If the server responds with a non-success status
   * (e.g. the company has not approved the pricing), a "blocked" popup is shown.
   */
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
        // The company has not approved the quote or another restriction applies.
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

  /** Dismisses the share-confirmation popup when the user says they did not share. */
  const handleConfirmNo = () => {
    setShowConfirmPopup(false);
  };

  // --- Platform-specific share launchers ---

  /** Opens WhatsApp with pre-filled share text. */
  const shareToWhatsApp = () => {
    const waText = encodeURIComponent(fullShareText);
    window.open(`https://wa.me/?text=${waText}`, '_blank');
  };

  /** Opens the Facebook share dialog with the ad URL and quote. */
  const shareToFacebook = () => {
    const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(redirectUrl)}&quote=${encodeURIComponent(shareText)}`;
    window.open(fbUrl, '_blank');
  };

  /**
   * Instagram does not support direct URL sharing, so the share text is copied
   * to the clipboard first. On mobile devices the native Instagram camera deep
   * link is attempted; on desktop the Instagram website is opened.
   */
  const shareToInstagram = async () => {
    await copyToClipboard(fullShareText);
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      window.location.href = 'instagram://camera';
    } else {
      window.open('https://www.instagram.com/', '_blank');
    }
  };

  /** Opens Telegram's share URL dialog. */
  const shareToTelegram = () => {
    const tgUrl = `https://t.me/share/url?url=${encodeURIComponent(redirectUrl)}&text=${encodeURIComponent(shareText)}`;
    window.open(tgUrl, '_blank');
  };

  /** Opens Twitter's tweet compose dialog. */
  const shareToTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
  };

  /** Opens LinkedIn's share offsite dialog. */
  const shareToLinkedIn = () => {
    const url = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(redirectUrl)}`;
    window.open(url, '_blank');
  };

  /** Opens the user's default email client with pre-filled subject and body. */
  const shareByEmail = () => {
    const subject = encodeURIComponent(ad.title || 'מודעה מעניינת');
    const body = encodeURIComponent(fullShareText);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  /**
   * Copies the provided text to the clipboard. Uses the modern Clipboard API
   * with a legacy textarea fallback for older browsers.
   *
   * @param {string} text - Text to copy.
   */
  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback: create a temporary textarea, select its content, and use execCommand.
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

  /** Copies the ad link and immediately shows the share-confirmation popup. */
  const copyLink = async () => {
    await copyToClipboard(redirectUrl);
    setCurrentPlatform('copy_link');
    setShowConfirmPopup(true);
  };

  /**
   * Downloads the ad image as a PNG file via the backend download endpoint.
   * After a successful download, the share-confirmation popup is shown.
   */
  const downloadImage = async () => {
    try {
      const response = await fetch(`https://adsmaker.onrender.com/api/pending-ads/${ad._id}/download`, {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (!response.ok) throw new Error('שגיאה בהורדה');

      // Convert the response to a blob, create a temporary object URL, and trigger download.
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

        {/* Share confirmation popup -- asks the user if they actually shared */}
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

        {/* Blocked popup -- shown when the company has not approved the share */}
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
