const express = require('express'); 
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');

// GET - קבלת כל הפרסומות הממתינות
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 User from token:', req.userId, req.user);

    const { companyId, agentId: queryAgentId, status } = req.query;
    const query = {};

    // אם המשתמש הוא סוכן, תמיד השתמש ב-ID שלו
    if (req.user && req.user.userType === 'agent') {
      const agentIdFromToken = req.userId || req.user._id;
      if (agentIdFromToken) query.agentId = agentIdFromToken;
    } else if (queryAgentId && queryAgentId !== 'null' && queryAgentId !== 'undefined') {
      query.agentId = queryAgentId;
    }

    if (companyId && companyId !== 'null' && companyId !== 'undefined') query.companyId = companyId;

    if (status && status !== 'null' && status !== 'undefined') {
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statusArray.length > 0) query.status = { $in: statusArray };
      } else {
        query.status = status;
      }
    }

    console.log('🔍 Fetching pending ads with query:', query);

    // הגבלה ל-50 מודעות אחרונות, לא להביא תמונות בשאילתה הראשית
    const pendingAds = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(50)
      .select('-imageData')
      .lean();

    console.log('✅ Found', pendingAds.length, 'pending ads');

    // הבא תמונות בנפרד
    const adsWithImages = await Promise.all(
      pendingAds.map(async (ad) => {
        const adWithImage = await PendingAd.findById(ad._id)
          .select('imageData')
          .lean();
        return {
          ...ad,
          imageData: adWithImage?.imageData || null
        };
      })
    );

    res.json({ success: true, ads: adsWithImages });
  } catch (error) {
    console.error('❌ Error fetching pending ads:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת פרסומות ממתינות',
      error: error.message
    });
  }
});

// POST - יצירת פרסומת חדשה לאישור
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('📥 Received pending ad data:', req.body);

    const pendingAd = new PendingAd(req.body);
    await pendingAd.save();

    console.log('✅ Pending ad saved:', pendingAd._id);

    res.status(201).json({ success: true, ad: pendingAd });
  } catch (error) {
    console.error('❌ Error creating pending ad:', error);
    res.status(400).json({ success: false, message: 'שגיאה ביצירת פרסומת', error: error.message });
  }
});

// PUT - עדכון סטטוס (אישור/דחייה)
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!pendingAd) return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });

    res.json({ success: true, ad: pendingAd });
  } catch (error) {
    res.status(400).json({ success: false, message: 'שגיאה בעדכון פרסומת', error: error.message });
  }
});

// DELETE - מחיקת פרסומת
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findByIdAndDelete(req.params.id);
    if (!pendingAd) return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });

    res.json({ success: true, message: 'פרסומת נמחקה בהצלחה' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאה במחיקת פרסומת', error: error.message });
  }
});

// GET - קבלת פרסומות ממתינות לפי חברה
router.get('/company/:companyId', authMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.query;

    if (!companyId || companyId === 'null' || companyId === 'undefined') {
      return res.status(400).json({ success: false, error: 'חסר מזהה חברה תקין', ads: [] });
    }

    const query = { companyId };
    if (status) {
      const statusArray = status.split(',').map(s => s.trim()).filter(Boolean);
      query.status = { $in: statusArray };
    }

    const pendingAds = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, ads: pendingAds });
  } catch (error) {
    res.status(500).json({ success: false, error: 'שגיאה בטעינת פרסומות ממתינות', ads: [] });
  }
});

// POST - אישור פרסומת
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const pendingAd = await PendingAd.findById(id);
    if (!pendingAd) return res.status(404).json({ success: false, error: 'Pending ad not found' });

    pendingAd.status = 'approved';
    if (rating) {
      pendingAd.companyFeedback.rating = rating;
      pendingAd.companyFeedback.comment = comment || '';
      pendingAd.companyFeedback.feedbackDate = new Date();
    }

    await pendingAd.save();

    if (rating && pendingAd.agentId) {
      const agent = await User.findById(pendingAd.agentId);
      if (agent) {
        const totalRatings = (agent.stats?.totalRatings || 0) + 1;
        const currentAverage = agent.stats?.averageRating || 0;
        const newAverage = ((currentAverage * (totalRatings - 1)) + parseInt(rating)) / totalRatings;

        agent.stats.averageRating = parseFloat(newAverage.toFixed(1));
        agent.stats.totalRatings = totalRatings;
        agent.stats.totalApproved = (agent.stats.totalApproved || 0) + 1;

        await agent.save();
      }
    }

    res.json({ success: true, ad: pendingAd });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST - דחיית פרסומת
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectionReason, rejectionDetails, allowRevision } = req.body;

    const pendingAd = await PendingAd.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        'companyFeedback.rejectionReason': rejectionReason || 'other',
        'companyFeedback.rejectionDetails': rejectionDetails || reason || '',
        'companyFeedback.allowRevision': allowRevision || false,
        'companyFeedback.feedbackDate': new Date()
      },
      { new: true }
    );

    if (!pendingAd) return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });

    res.json({ success: true, ad: pendingAd });
  } catch (error) {
    res.status(500).json({ success: false, error: 'שגיאה בדחיית הפרסומת' });
  }
});

// GET - הורדת תמונה של מודעה
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findById(req.params.id);
    if (!pendingAd) return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });

    const user = await User.findById(req.userId);
    if (user.userType === 'agent' && pendingAd.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'לא ניתן להוריד מודעה שטרם אושרה על ידי החברה',
        status: pendingAd.status
      });
    }

    if (!pendingAd.imageData) {
      return res.status(404).json({ success: false, error: 'אין תמונה למודעה זו' });
    }

    const base64Data = pendingAd.imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="ad-${pendingAd._id}.png"`
    });

    res.send(imageBuffer);
  } catch (error) {
    res.status(500).json({ success: false, error: 'שגיאה בהורדת התמונה' });
  }
});

module.exports = router;
