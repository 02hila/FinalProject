// server/routes/qr.js
const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const sharp = require('sharp');
const crypto = require('crypto');
const QRScan = require('../models/QRScan');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

/**
 * יצירת מזהה ייחודי קצר ל-QR
 */
function generateUniqueId() {
  return crypto.randomBytes(6).toString('base64url'); // יוצר מזהה של 8 תווים
}

/**
 * יצירת URL עם UTM parameters
 */
function createUTMUrl(baseUrl, agentId, campaignId, adId) {
  const url = new URL(baseUrl);
  url.searchParams.set('utm_source', `agent_${agentId}`);
  url.searchParams.set('utm_medium', 'qr');
  url.searchParams.set('utm_campaign', campaignId);
  url.searchParams.set('utm_content', `ad_${adId}`);
  return url.toString();
}

/**
 * POST /api/qr/generate
 * יצירת QR code למודעה קיימת
 */
router.post('/generate', authMiddleware, async (req, res) => {
  try {
    const { adId } = req.body;

    if (!adId) {
      return res.status(400).json({
        success: false,
        message: 'חסר מזהה מודעה'
      });
    }

    // שליפת המודעה
    const ad = await PendingAd.findById(adId)
      .populate('campaignId')
      .populate('agentId')
      .populate('companyId');

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'מודעה לא נמצאה'
      });
    }

    // בדיקה שהמשתמש הוא הסוכן שיצר את המודעה או החברה
    const userId = req.userId || req.user._id;
    const isOwner = ad.agentId._id.toString() === userId.toString() || 
                    ad.companyId._id.toString() === userId.toString();

    if (!isOwner && req.user.userType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'אין לך הרשאה ליצור QR למודעה זו'
      });
    }

    // בדיקה אם יש אתר לחברה
    const websiteUrl = ad.websiteUrl || ad.campaignId?.websiteUrl;
    if (!websiteUrl) {
      return res.status(400).json({
        success: false,
        message: 'לא הוגדר אתר לחברה. נא להוסיף אתר בהגדרות הקמפיין.'
      });
    }

    // יצירת מזהה ייחודי
    let uniqueId;
    let exists = true;
    while (exists) {
      uniqueId = generateUniqueId();
      exists = await QRScan.findOne({ uniqueId });
    }

    // יצירת URL המלא עם UTM
    const fullUrl = createUTMUrl(
      websiteUrl,
      ad.agentId._id,
      ad.campaignId._id,
      ad._id
    );

    // יצירת הקישור הקצר
    const shortUrl = `${process.env.BASE_URL || 'https://adsmaker.onrender.com'}/r/${uniqueId}`;

    // יצירת QR code
    const qrDataUrl = await QRCode.toDataURL(shortUrl, {
      width: 300,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#FFFFFF'
      }
    });

    // שמירת המידע במסד הנתונים
    const qrScan = new QRScan({
      uniqueId,
      adId: ad._id,
      campaignId: ad.campaignId._id,
      agentId: ad.agentId._id,
      companyId: ad.companyId._id,
      targetUrl: fullUrl,
      fullUrl: shortUrl,
      qrImageData: qrDataUrl,
      metadata: {
        adTitle: ad.title,
        campaignTitle: ad.campaignId?.title,
        agentName: ad.agentId?.fullName,
        companyName: ad.companyId?.companyName || ad.companyId?.fullName
      }
    });

    await qrScan.save();

    // עדכון המודעה
    ad.qrCode = {
      enabled: true,
      uniqueId,
      imageData: qrDataUrl,
      shortUrl,
      scans: 0
    };
    await ad.save();

    res.json({
      success: true,
      qr: {
        uniqueId,
        shortUrl,
        imageData: qrDataUrl,
        targetUrl: fullUrl
      }
    });

  } catch (error) {
    console.error('❌ Error generating QR:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה ביצירת QR code',
      error: error.message
    });
  }
});

/**
 * POST /api/qr/embed
 * הטמעת QR code בתוך תמונת המודעה
 */
router.post('/embed', authMiddleware, async (req, res) => {
  try {
    const { adId, position = 'bottom-right', size = 150 } = req.body;

    const ad = await PendingAd.findById(adId);
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'מודעה לא נמצאה'
      });
    }

    if (!ad.qrCode || !ad.qrCode.enabled) {
      return res.status(400).json({
        success: false,
        message: 'לא נוצר QR למודעה זו. נא ליצור QR תחילה.'
      });
    }

    if (!ad.imageData) {
      return res.status(400).json({
        success: false,
        message: 'אין תמונה למודעה זו'
      });
    }

    // המרת התמונות מ-Base64 ל-Buffer
    const adImageBuffer = Buffer.from(
      ad.imageData.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    const qrImageBuffer = Buffer.from(
      ad.qrCode.imageData.replace(/^data:image\/\w+;base64,/, ''),
      'base64'
    );

    // קבלת מידות התמונה הראשית
    const adImage = sharp(adImageBuffer);
    const metadata = await adImage.metadata();

    // חישוב מיקום ה-QR
    const padding = 20;
    let left, top;

    switch (position) {
      case 'top-left':
        left = padding;
        top = padding;
        break;
      case 'top-right':
        left = metadata.width - size - padding;
        top = padding;
        break;
      case 'bottom-left':
        left = padding;
        top = metadata.height - size - padding;
        break;
      case 'bottom-right':
      default:
        left = metadata.width - size - padding;
        top = metadata.height - size - padding;
        break;
      case 'center':
        left = (metadata.width - size) / 2;
        top = (metadata.height - size) / 2;
        break;
    }

    // שינוי גודל ה-QR והוספת רקע לבן
    const resizedQR = await sharp(qrImageBuffer)
      .resize(size, size)
      .extend({
        top: 10,
        bottom: 10,
        left: 10,
        right: 10,
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .png()
      .toBuffer();

    // הטמעת ה-QR בתמונה
    const finalImage = await adImage
      .composite([{
        input: resizedQR,
        top: Math.round(top),
        left: Math.round(left)
      }])
      .png()
      .toBuffer();

    // המרה ל-Base64
    const finalImageBase64 = `data:image/png;base64,${finalImage.toString('base64')}`;

    // עדכון התמונה במסד הנתונים
    ad.imageData = finalImageBase64;
    await ad.save();

    res.json({
      success: true,
      message: 'QR הוטמע בהצלחה בתמונה',
      imageData: finalImageBase64
    });

  } catch (error) {
    console.error('❌ Error embedding QR:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בהטמעת QR בתמונה',
      error: error.message
    });
  }
});

/**
 * GET /api/qr/analytics/:adId
 * קבלת סטטיסטיקות QR למודעה ספציפית
 */
router.get('/analytics/:adId', authMiddleware, async (req, res) => {
  try {
    const { adId } = req.params;

    const qrScan = await QRScan.findOne({ adId })
      .populate('campaignId', 'title')
      .populate('agentId', 'fullName')
      .populate('companyId', 'companyName fullName');

    if (!qrScan) {
      return res.status(404).json({
        success: false,
        message: 'לא נמצאו נתוני QR למודעה זו'
      });
    }

    // חישוב סטטיסטיקות
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = qrScan.scans.filter(scan => 
      scan.timestamp >= today
    ).length;

    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekScans = qrScan.scans.filter(scan => 
      scan.timestamp >= last7Days
    ).length;

    res.json({
      success: true,
      analytics: {
        totalScans: qrScan.totalScans,
        todayScans,
        weekScans,
        shortUrl: qrScan.fullUrl,
        targetUrl: qrScan.targetUrl,
        isActive: qrScan.isActive,
        createdAt: qrScan.createdAt,
        metadata: qrScan.metadata
      }
    });

  } catch (error) {
    console.error('❌ Error fetching QR analytics:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סטטיסטיקות',
      error: error.message
    });
  }
});

/**
 * GET /api/qr/analytics/agent/:agentId
 * קבלת כל סטטיסטיקות ה-QR של סוכן
 */
router.get('/analytics/agent/:agentId', authMiddleware, async (req, res) => {
  try {
    const { agentId } = req.params;

    const qrScans = await QRScan.find({ agentId })
      .populate('adId', 'title status')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 });

    const totalScans = qrScans.reduce((sum, qr) => sum + qr.totalScans, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = qrScans.reduce((sum, qr) => {
      const dailyScans = qr.scans.filter(scan => scan.timestamp >= today).length;
      return sum + dailyScans;
    }, 0);

    res.json({
      success: true,
      summary: {
        totalQRs: qrScans.length,
        totalScans,
        todayScans,
        averageScansPerQR: qrScans.length > 0 ? (totalScans / qrScans.length).toFixed(1) : 0
      },
      qrs: qrScans.map(qr => ({
        id: qr._id,
        adTitle: qr.metadata.adTitle,
        campaignTitle: qr.metadata.campaignTitle,
        totalScans: qr.totalScans,
        shortUrl: qr.fullUrl,
        isActive: qr.isActive,
        createdAt: qr.createdAt
      }))
    });

  } catch (error) {
    console.error('❌ Error fetching agent QR analytics:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת סטטיסטיקות הסוכן',
      error: error.message
    });
  }
});

module.exports = router;