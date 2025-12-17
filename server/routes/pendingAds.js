// server/routes/pendingAds.js - COMPLETE WORKING VERSION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');

// ✅ Import the model correctly
const PendingAd = require('../models/PendingAd');

console.log('📋 PendingAd model type:', typeof PendingAd);
console.log('📋 PendingAd.find type:', typeof PendingAd.find);

/* ==========================================
   GET - כל הפרסומות (עם filters)
   ========================================== */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, agentId } = req.query;
    
    let query = {};
    
    // ✅ FIX: Automatically filter by company if user is a company
    if (req.user.userType === 'company') {
      query.companyId = req.user._id;
      console.log('📋 Company user - filtering by companyId:', req.user._id);
    } else if (req.user.userType === 'agent') {
      // If agent, filter by agentId
      query.agentId = req.user._id;
      console.log('📋 Agent user - filtering by agentId:', req.user._id);
    }
    
    // Additional filters
    if (status) query.status = status;
    if (agentId) query.agentId = agentId;
    
    console.log('📋 Fetching pending ads with query:', query);
    
    // ✅ FIX: Limit results and exclude imageData to prevent memory issues
    const limitValue = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const skipValue = req.query.skip ? parseInt(req.query.skip, 10) : 0;
    const finalLimit = isNaN(limitValue) ? 50 : Math.min(Math.max(limitValue, 1), 100); // Between 1 and 100
    const finalSkip = isNaN(skipValue) ? 0 : Math.max(skipValue, 0);
    
    const ads = await PendingAd.find(query)
      .select('-imageData') // ✅ Exclude imageData to save memory
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(finalLimit)
      .skip(finalSkip);
    
    const total = await PendingAd.countDocuments(query);
    
    console.log(`✅ Found ${ads.length} ads (total: ${total}, limit: ${finalLimit}, skip: ${finalSkip})`);
    res.json({ success: true, ads, total, limit: finalLimit, skip: finalSkip });
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
   POST - דחיית פרסומת (תמיכה לאחור)
   ========================================== */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { rejectionReason, rejectionDetails } = req.body;
    const ad = await PendingAd.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    ad.status = 'rejected';
    ad.rejectionReason = rejectionReason || '';
    
    await ad.save();
    
    res.json({ success: true, ad });
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

    // טען את הפרסומת המקורית
    const pendingAd = await PendingAd.findById(id)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName');

    if (!pendingAd) {
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    console.log('✅ Found ad:', pendingAd.title);

    // שמור דחייה בהיסטוריה (אם יש מתודה במודל)
    if (typeof pendingAd.addRejection === 'function') {
      pendingAd.addRejection({
        reason: rejectionReasons.join(', '),
        details: rejectionDetails,
        rejectedBy: req.userId,
        notes: `Components to change: ${rejectionReasons.join(', ')}`
      });
    } else {
      // fallback אם אין מתודה
      pendingAd.status = 'rejected';
    }

    await pendingAd.save();
    console.log('✅ Saved rejection');

    // קריאה ל-API של שיפור הפרסומת
    try {
      console.log('🔄 Calling ad-improvement API...');
      
      const improvementResponse = await axios.post(
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/ad-improvement/reject-and-improve`,
        {
          adId: id,
          rejectionReasons,
          rejectionDetails
        },
        {
          headers: {
            Authorization: req.headers.authorization
          },
          timeout: 60000
        }
      );

      console.log('✅ Ad improvement response:', improvementResponse.data);

      res.json({
        success: true,
        message: 'הפרסומת נדחתה ופרסומת חלופית נוצרה',
        ad: pendingAd,
        improvement: improvementResponse.data,
        emailSent: improvementResponse.data.emailSent || false
      });

    } catch (improvementError) {
      console.error('⚠️ Ad improvement failed:', improvementError.message);
      
      res.json({
        success: true,
        message: 'הפרסומת נדחתה',
        ad: pendingAd,
        warning: 'לא הצלחנו ליצור פרסומת חלופית אוטומטית',
        emailSent: false
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