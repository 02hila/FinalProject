// routes/redirect.js - מטפל ב-QR code redirects ומעקב

const express = require('express');
const router = express.Router();
const QRScan = require('../models/QRScan');

/* ===== QR CODE REDIRECT ===== */
router.get('/:uniqueId', async (req, res) => {
  const { uniqueId } = req.params;
  
  console.log('🔗 QR Redirect request:', uniqueId);

  try {
    // חפש את ה-QR ב-DB
    const qrEntry = await QRScan.findOne({ uniqueId });

    if (!qrEntry) {
      console.error('❌ QR not found:', uniqueId);
      
      // עמוד שגיאה ידידותי
      return res.status(404).send(`
        <!DOCTYPE html>
        <html dir="rtl" lang="he">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>QR לא נמצא</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              display: flex;
              justify-content: center;
              align-items: center;
              min-height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              text-align: center;
              padding: 20px;
            }
            .container {
              background: rgba(255, 255, 255, 0.1);
              backdrop-filter: blur(10px);
              border-radius: 20px;
              padding: 40px;
              max-width: 500px;
              box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
            }
            h1 { font-size: 48px; margin: 0 0 20px 0; }
            p { font-size: 18px; line-height: 1.6; }
            .error-code { 
              font-size: 14px; 
              opacity: 0.7; 
              margin-top: 20px;
              font-family: monospace;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔍</h1>
            <h2>QR Code לא נמצא</h2>
            <p>מצטערים, ה-QR code שסרקת אינו קיים במערכת.</p>
            <p class="error-code">ID: ${uniqueId}</p>
          </div>
        </body>
        </html>
      `);
    }

    console.log('✅ QR found, redirecting to:', qrEntry.targetUrl);

    // עדכן את מספר הסריקות
    qrEntry.scans = (qrEntry.scans || 0) + 1;
    qrEntry.lastScannedAt = new Date();
    
    // שמור את הסריקה (אסינכרוני - לא לחכות)
    qrEntry.save().catch(err => {
      console.error('⚠️ Failed to update scan count:', err.message);
    });

    // Redirect מיידי לאתר היעד
    return res.redirect(302, qrEntry.targetUrl);

  } catch (error) {
    console.error('💥 Redirect error:', error);
    
    return res.status(500).send(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>שגיאה</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            text-align: center;
            padding: 20px;
          }
          .container {
            background: rgba(255, 255, 255, 0.1);
            backdrop-filter: blur(10px);
            border-radius: 20px;
            padding: 40px;
            max-width: 500px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
          }
          h1 { font-size: 48px; margin: 0 0 20px 0; }
          p { font-size: 18px; line-height: 1.6; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>⚠️</h1>
          <h2>שגיאה בעיבוד</h2>
          <p>אירעה שגיאה בעיבוד ה-QR code. אנא נסה שוב מאוחר יותר.</p>
        </div>
      </body>
      </html>
    `);
  }
});

/* ===== QR ANALYTICS ENDPOINT ===== */
router.get('/stats/:uniqueId', async (req, res) => {
  const { uniqueId } = req.params;
  
  try {
    const qrEntry = await QRScan.findOne({ uniqueId })
      .populate('campaignId', 'title')
      .populate('agentId', 'fullName')
      .populate('companyId', 'companyName fullName');

    if (!qrEntry) {
      return res.status(404).json({ success: false, error: 'QR not found' });
    }

    return res.json({
      success: true,
      stats: {
        uniqueId: qrEntry.uniqueId,
        scans: qrEntry.scans || 0,
        targetUrl: qrEntry.targetUrl,
        shortUrl: qrEntry.fullUrl,
        createdAt: qrEntry.createdAt,
        lastScannedAt: qrEntry.lastScannedAt,
        campaign: qrEntry.campaignId?.title,
        agent: qrEntry.agentId?.fullName,
        company: qrEntry.companyId?.companyName || qrEntry.companyId?.fullName
      }
    });

  } catch (error) {
    console.error('Error fetching QR stats:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

module.exports = router;