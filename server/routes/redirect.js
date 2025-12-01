// server/routes/redirect.js
const express = require('express');
const router = express.Router();
const QRScan = require('../models/QRScan');
const PendingAd = require('../models/PendingAd');

/**
 * GET /r/:uniqueId
 * מעקב אחר סריקת QR והפניה לאתר היעד
 */
router.get('/:uniqueId', async (req, res) => {
  try {
    const { uniqueId } = req.params;

    // חיפוש ה-QR במסד הנתונים
    const qrScan = await QRScan.findOne({ uniqueId, isActive: true });

    if (!qrScan) {
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
              height: 100vh;
              margin: 0;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
            }
            .container {
              text-align: center;
              padding: 40px;
              background: rgba(255, 255, 255, 0.1);
              border-radius: 20px;
              backdrop-filter: blur(10px);
            }
            h1 { font-size: 48px; margin: 0; }
            p { font-size: 18px; margin-top: 20px; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>🔍</h1>
            <h1>QR לא נמצא</h1>
            <p>הקוד שסרקת אינו תקף או שהוסר מהמערכת</p>
          </div>
        </body>
        </html>
      `);
    }

    // איסוף מידע על הסריקה
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const ipAddress = req.ip || req.headers['x-forwarded-for'] || 'Unknown';
    const referer = req.headers['referer'] || req.headers['referrer'] || 'Direct';

    // שמירת הסריקה (רק אם יש פחות מ-1000 סריקות)
    if (qrScan.scans.length < 1000) {
      qrScan.scans.push({
        timestamp: new Date(),
        userAgent,
        ipAddress,
        referer
      });
    }

    // עדכון מונה הסריקות
    qrScan.totalScans += 1;
    await qrScan.save();

    // עדכון מודעה
    await PendingAd.findByIdAndUpdate(qrScan.adId, {
      $inc: { 
        'qrCode.scans': 1,
        'clicks': 1
      }
    });

    console.log(`✅ QR Scan recorded: ${uniqueId} -> ${qrScan.targetUrl}`);

    // הפניה לכתובת היעד
    res.redirect(302, qrScan.targetUrl);

  } catch (error) {
    console.error('❌ Error in redirect:', error);
    res.status(500).send(`
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
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
          }
          .container {
            text-align: center;
            padding: 40px;
            background: rgba(255, 255, 255, 0.1);
            border-radius: 20px;
            backdrop-filter: blur(10px);
          }
          h1 { font-size: 48px; margin: 0; }
          p { font-size: 18px; margin-top: 20px; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>❌</h1>
          <h1>שגיאה</h1>
          <p>אירעה שגיאה בעיבוד הבקשה. אנא נסה שוב מאוחר יותר.</p>
        </div>
      </body>
      </html>
    `);
  }
});

/**
 * GET /r/:uniqueId/preview
 * תצוגה מקדימה של נתוני ה-QR (לבדיקות)
 */
router.get('/:uniqueId/preview', async (req, res) => {
  try {
    const { uniqueId } = req.params;

    const qrScan = await QRScan.findOne({ uniqueId })
      .populate('adId', 'title imageData')
      .populate('campaignId', 'title')
      .populate('agentId', 'fullName')
      .populate('companyId', 'companyName fullName');

    if (!qrScan) {
      return res.status(404).json({
        success: false,
        message: 'QR לא נמצא'
      });
    }

    res.json({
      success: true,
      qr: {
        uniqueId: qrScan.uniqueId,
        shortUrl: qrScan.fullUrl,
        targetUrl: qrScan.targetUrl,
        totalScans: qrScan.totalScans,
        isActive: qrScan.isActive,
        metadata: qrScan.metadata,
        ad: {
          title: qrScan.adId?.title,
          imageData: qrScan.adId?.imageData
        },
        campaign: {
          title: qrScan.campaignId?.title
        },
        agent: {
          name: qrScan.agentId?.fullName
        },
        company: {
          name: qrScan.companyId?.companyName || qrScan.companyId?.fullName
        }
      }
    });

  } catch (error) {
    console.error('❌ Error in preview:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת תצוגה מקדימה'
    });
  }
});

module.exports = router;