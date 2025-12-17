// server/routes/pendingAds.js - קובץ מלא
const express = require('express'); 
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios');

/* ==========================================
   GET - כל הפרסומות (עם filters)
   ========================================== */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { companyId, status, agentId } = req.query;
    
    let query = {};
    if (companyId) query.companyId = companyId;
    if (status) query.status = status;
    if (agentId) query.agentId = agentId;
    
    console.log('📋 Fetching pending ads with query:', query);
    
    const ads = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${ads.length} ads`);
    res.json({ success: true, ads });
  } catch (error) {
    console.error('❌ Error fetching pending ads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   GET - פרסומת ספציפית
   ========================================== */
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title');
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    res.json({ success: true, ad });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   POST - אישור פרסומת
   ========================================== */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ad = await PendingAd.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    ad.status = 'approved';
    if (rating) {
      ad.companyFeedback = {
        rating,
        comment: comment || '',
        feedbackDate: new Date()
      };
    }
    
    await ad.save();
    
    res.json({ success: true, ad });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   POST - דחיית פרסומת (פורמט ישן)
   ========================================== */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { rejectionReason, rejectionDetails } = req.body;
    const ad = await PendingAd.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    // תמיכה לאחור - מפנה ל-ad-improvement
    const improvementResponse = await axios.post(
      `${process.env.BASE_URL || 'http://localhost:3000'}/api/ad-improvement/reject-and-improve`,
      {
        adId: req.params.id,
        rejectionReason,
        rejectionDetails
      },
      {
        headers: { Authorization: req.headers.authorization },
        timeout: 60000
      }
    );
    
    res.json(improvementResponse.data);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   POST - דחיית פרסומת עם בחירה מרובה 🆕
   ========================================== */
router.post('/:id/reject-with-components', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReasons, rejectionDetails } = req.body;

    console.log('🔵 Reject with components:', { id, rejectionReasons, rejectionDetails });

    // ולידציה
    if (!rejectionReasons || !Array.isArray(rejectionReasons) || rejectionReasons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'חובה לבחור לפחות רכיב אחד לשינוי'
      });
    }

    const validReasons = ['title', 'text', 'image'];
    const invalidReasons = rejectionReasons.filter(r => !validReasons.includes(r));
    if (invalidReasons.length > 0) {
      return res.status(400).json({
        success: false,
        error: `רכיבים לא תקינים: ${invalidReasons.join(', ')}`
      });
    }

    if (!rejectionDetails || rejectionDetails.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'חובה להוסיף הסבר מפורט'
      });
    }

    // קריאה ל-API improvement
    try {
      const improvementResponse = await axios.post(
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/ad-improvement/reject-and-improve`,
        {
          adId: id,
          rejectionReasons,
          rejectionDetails
        },
        {
          headers: { Authorization: req.headers.authorization },
          timeout: 60000
        }
      );

      res.json(improvementResponse.data);
    } catch (improvementError) {
      console.error('⚠️ Ad improvement failed:', improvementError.message);
      res.status(500).json({
        success: false,
        error: 'שגיאה ביצירת פרסומת חלופית'
      });
    }

  } catch (error) {
    console.error('❌ Error in reject-with-components:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת',
      details: error.message
    });
  }
});

module.exports = router;