// routes/redirect.js - מטפל ב-QR code redirects ומעקב (גרסה משופרת)

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

    console.log('✅ QR found:', {
      uniqueId: qrEntry.uniqueId,
      currentScans: qrEntry.totalScans || 0,
      targetUrl: qrEntry.targetUrl
    });

    // 🔥 עדכון מספר הסריקות - בשיטה מתוקנת
    try {
      // שיטה 1: עדכון ישיר עם $inc
      const updateResult = await QRScan.findByIdAndUpdate(
        qrEntry._id,
        { 
          $inc: { totalScans: 1 },
          $push: { 
            scans: {
              timestamp: new Date(),
              userAgent: req.get('user-agent') || 'Unknown',
              ip: req.ip || req.connection.remoteAddress || 'Unknown'
            }
          },
          $set: { lastScannedAt: new Date() }
        },
        { new: true }
      );

      console.log('✅ Scan updated successfully:', {
        uniqueId: updateResult.uniqueId,
        newTotalScans: updateResult.totalScans,
        scansArrayLength: updateResult.scans?.length || 0
      });

    } catch (updateError) {
      console.error('⚠️ Failed to update scan count:', updateError.message);
      // אבל עדיין עושים redirect - לא לעצור את הזרימה
    }

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
        scans: qrEntry.totalScans || 0,
        scansArray: qrEntry.scans?.length || 0,
        targetUrl: qrEntry.targetUrl,
        shortUrl: qrEntry.fullUrl,
        createdAt: qrEntry.createdAt,
        lastScannedAt: qrEntry.lastScannedAt,
        campaign: qrEntry.campaignId?.title,
        agent: qrEntry.agentId?.fullName,
        company: qrEntry.companyId?.companyName || qrEntry.companyId?.fullName,
        isActive: qrEntry.isActive
      }
    });

  } catch (error) {
    console.error('Error fetching QR stats:', error);
    return res.status(500).json({ success: false, error: 'Internal error' });
  }
});

/* ===== DEBUG ENDPOINT - בדיקת QR ===== */
router.get('/debug/:uniqueId', async (req, res) => {
  const { uniqueId } = req.params;
  
  try {
    const qrEntry = await QRScan.findOne({ uniqueId })
      .populate('campaignId', 'title')
      .populate('agentId', 'fullName');

    if (!qrEntry) {
      return res.json({ 
        success: false, 
        message: 'QR not found',
        uniqueId 
      });
    }

    return res.json({
      success: true,
      debug: {
        uniqueId: qrEntry.uniqueId,
        totalScans: qrEntry.totalScans,
        scansArrayLength: qrEntry.scans?.length || 0,
        lastScannedAt: qrEntry.lastScannedAt,
        createdAt: qrEntry.createdAt,
        targetUrl: qrEntry.targetUrl,
        shortUrl: qrEntry.fullUrl,
        isActive: qrEntry.isActive,
        campaign: qrEntry.campaignId?.title,
        agent: qrEntry.agentId?.fullName,
        recentScans: qrEntry.scans?.slice(-5) || []
      }
    });

  } catch (error) {
    console.error('Debug error:', error);
    return res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

module.exports = router;