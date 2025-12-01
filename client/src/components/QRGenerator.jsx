// client/src/components/QRGenerator.jsx
import React, { useState } from 'react';
import { generateQR, embedQR } from '../services/qrService';
import './QRGenerator.css';

const QRGenerator = ({ ad, onQRGenerated, onClose }) => {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1 = generate, 2 = customize, 3 = done
  const [qrData, setQrData] = useState(null);
  const [embedOptions, setEmbedOptions] = useState({
    position: 'bottom-right',
    size: 150
  });
  const [error, setError] = useState('');

  const token = localStorage.getItem('token');

  // שלב 1: יצירת ה-QR
  const handleGenerateQR = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await generateQR(ad._id, token);
      
      if (response.success) {
        setQrData(response.qr);
        setStep(2);
      } else {
        setError(response.message || 'שגיאה ביצירת QR');
      }
    } catch (err) {
      setError(err.message || 'שגיאה ביצירת QR');
    } finally {
      setLoading(false);
    }
  };

  // שלב 2: הטמעת ה-QR בתמונה
  const handleEmbedQR = async () => {
    setLoading(true);
    setError('');

    try {
      const response = await embedQR(ad._id, embedOptions, token);
      
      if (response.success) {
        setStep(3);
        if (onQRGenerated) {
          onQRGenerated(response.imageData);
        }
      } else {
        setError(response.message || 'שגיאה בהטמעת QR');
      }
    } catch (err) {
      setError(err.message || 'שגיאה בהטמעת QR');
    } finally {
      setLoading(false);
    }
  };

  // דילוג על ההטמעה
  const handleSkipEmbed = () => {
    setStep(3);
    if (onQRGenerated) {
      onQRGenerated(null);
    }
  };

  return (
    <div className="qr-generator-overlay" onClick={onClose}>
      <div className="qr-generator-modal" onClick={(e) => e.stopPropagation()}>
        <button className="qr-close-btn" onClick={onClose}>
          <i className="fas fa-times"></i>
        </button>

        {/* שלב 1: הקדמה */}
        {step === 1 && (
          <div className="qr-step">
            <div className="qr-icon">
              <i className="fas fa-qrcode"></i>
            </div>
            <h2>הוספת QR Code למודעה</h2>
            <p>
              QR Code יאפשר למשתמשים לסרוק את המודעה ולהגיע ישירות לאתר החברה.
              המערכת תעקוב אחר כל סריקה ותספק סטטיסטיקות מפורטות.
            </p>

            <div className="qr-info-box">
              <h4>📊 מה תקבל?</h4>
              <ul>
                <li>✅ QR code ייחודי עם מעקב</li>
                <li>✅ קישור קצר לשיתוף</li>
                <li>✅ סטטיסטיקות בזמן אמת</li>
                <li>✅ מעקב UTM מלא</li>
              </ul>
            </div>

            {error && (
              <div className="qr-error">
                <i className="fas fa-exclamation-circle"></i> {error}
              </div>
            )}

            <div className="qr-actions">
              <button 
                className="qr-btn qr-btn-secondary" 
                onClick={onClose}
                disabled={loading}
              >
                ביטול
              </button>
              <button 
                className="qr-btn qr-btn-primary" 
                onClick={handleGenerateQR}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="qr-spinner"></span> יוצר QR...
                  </>
                ) : (
                  <>
                    <i className="fas fa-magic"></i> צור QR
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* שלב 2: התאמה אישית */}
        {step === 2 && qrData && (
          <div className="qr-step">
            <div className="qr-success-badge">
              <i className="fas fa-check-circle"></i> QR נוצר בהצלחה!
            </div>

            <h2>התאמה אישית</h2>
            <p>בחר איפה להציב את ה-QR בתמונה</p>

            <div className="qr-preview-section">
              <img 
                src={qrData.imageData} 
                alt="QR Code" 
                className="qr-preview-image"
              />
              <div className="qr-short-url">
                <strong>קישור קצר:</strong>
                <a href={qrData.shortUrl} target="_blank" rel="noopener noreferrer">
                  {qrData.shortUrl}
                </a>
              </div>
            </div>

            <div className="qr-options">
              <div className="qr-option-group">
                <label>מיקום ה-QR:</label>
                <select 
                  value={embedOptions.position}
                  onChange={(e) => setEmbedOptions({...embedOptions, position: e.target.value})}
                >
                  <option value="top-left">פינה עליונה שמאלית</option>
                  <option value="top-right">פינה עליונה ימנית</option>
                  <option value="bottom-left">פינה תחתונה שמאלית</option>
                  <option value="bottom-right">פינה תחתונה ימנית (מומלץ)</option>
                  <option value="center">מרכז</option>
                </select>
              </div>

              <div className="qr-option-group">
                <label>גודל ה-QR:</label>
                <input 
                  type="range" 
                  min="100" 
                  max="300" 
                  step="10"
                  value={embedOptions.size}
                  onChange={(e) => setEmbedOptions({...embedOptions, size: parseInt(e.target.value)})}
                />
                <span className="qr-size-display">{embedOptions.size}px</span>
              </div>
            </div>

            {error && (
              <div className="qr-error">
                <i className="fas fa-exclamation-circle"></i> {error}
              </div>
            )}

            <div className="qr-actions">
              <button 
                className="qr-btn qr-btn-secondary" 
                onClick={handleSkipEmbed}
                disabled={loading}
              >
                דלג
              </button>
              <button 
                className="qr-btn qr-btn-primary" 
                onClick={handleEmbedQR}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <span className="qr-spinner"></span> מטמיע...
                  </>
                ) : (
                  <>
                    <i className="fas fa-check"></i> הטמע בתמונה
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* שלב 3: סיום */}
        {step === 3 && qrData && (
          <div className="qr-step">
            <div className="qr-success-icon">
              <i className="fas fa-check-circle"></i>
            </div>
            <h2>QR נוסף בהצלחה!</h2>
            <p>המודעה שלך כוללת כעת QR code עם מעקב מלא</p>

            <div className="qr-final-info">
              <div className="qr-info-item">
                <i className="fas fa-link"></i>
                <div>
                  <strong>קישור קצר</strong>
                  <p>{qrData.shortUrl}</p>
                </div>
              </div>
              <div className="qr-info-item">
                <i className="fas fa-globe"></i>
                <div>
                  <strong>יעד</strong>
                  <p>{new URL(qrData.targetUrl).hostname}</p>
                </div>
              </div>
            </div>

            <div className="qr-actions">
              <button 
                className="qr-btn qr-btn-primary qr-btn-full" 
                onClick={onClose}
              >
                <i className="fas fa-check"></i> סיום
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default QRGenerator;