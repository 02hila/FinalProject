const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');

/* ---------------------------------------------
   GET - קבלת מודעות מאושרות של הסוכן
---------------------------------------------- */
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 User from token:', req.userId, req.user);

    // רק סוכנים יכולים לראות את המודעות שלהם
    if (!req.user || req.user.userType !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'גישה מותרת רק לסוכנים'
      });
    }

    const agentId = req.userId || req.user._id;

    const query = {
      agentId: agentId,
      status: 'approved'
    };

    console.log('🔍 Fetching approved ads with query:', query);

    const ads = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    console.log('✅ Found', ads.length, 'approved ads');

    res.json(ads);

  } catch (error) {
    console.error('❌ Error fetching ads:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת מודעות',
      error: error.message
    });
  }
});

/* ---------------------------------------------
   GET - הורדת תמונה של מודעה מאושרת
---------------------------------------------- */
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({ success: false, error: 'מודעה לא נמצאה' });
    }

    // בדיקה שהמודעה שייכת לסוכן
    if (ad.agentId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'אין הרשאה לגשת למודעה זו'
      });
    }

    if (ad.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'לא ניתן להוריד מודעה שטרם אושרה'
      });
    }

    if (!ad.imageData) {
      return res.status(404).json({ success: false, error: 'אין תמונה למודעה זו' });
    }

    const base64Data = ad.imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="ad-${ad._id}.png"`
    });

    res.send(imageBuffer);

  } catch (error) {
    console.error('❌ Error downloading ad image:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהורדת התמונה'
    });
  }
});

// ---------------------------------------------
// ✅ ROUTES חדשים הוספו כאן
// ---------------------------------------------

/* ---------------------------------------------
   GET - קבלת מודעה ציבורית (לדף הביניים)
---------------------------------------------- */
router.get('/public/:adId', async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.adId)
      .populate('campaignId', 'title websiteUrl') // מושך את שדות ה-title וה-websiteUrl מהקמפיין
      .lean();
    
    if (!ad) {
      return res.status(404).json({ error: 'מודעה לא נמצאה' });
    }
    
    res.json(ad);
  } catch (error) {
    console.error('❌ Error fetching public ad:', error);
    res.status(500).json({ error: error.message });
  }
});

/* ---------------------------------------------
   POST - ספירת קליקים על מודעה
---------------------------------------------- */
router.post('/click/:adId', async (req, res) => {
  try {
    // מעדכן את שדה clicks ומוסיף 1
    await PendingAd.findByIdAndUpdate(req.params.adId, {
      $inc: { clicks: 1 }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error logging click:', error);
    res.status(500).json({ error: error.message });
  }
});

// ---------------------------------------------

module.exports = router;