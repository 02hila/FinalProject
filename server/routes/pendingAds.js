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
    
    // ✅ FIX: Limit results to prevent memory issues
    const limitValue = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const skipValue = req.query.skip ? parseInt(req.query.skip, 10) : 0;
    const finalLimit = isNaN(limitValue) ? 50 : Math.min(Math.max(limitValue, 1), 100); // Between 1 and 100
    const finalSkip = isNaN(skipValue) ? 0 : Math.max(skipValue, 0);
    
    // ✅ Include imageData only for pending ads (to save memory on history)
    // If status is 'pending', include imageData. Otherwise exclude it.
    const includeImageData = query.status === 'pending' || (!query.status && req.query.status === 'pending');
    
    let adsQuery = PendingAd.find(query);
    
    // Only exclude imageData if NOT fetching pending ads
    if (!includeImageData) {
      adsQuery = adsQuery.select('-imageData');
    }
    
    const ads = await adsQuery
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(finalLimit)
      .skip(finalSkip);
    
    const total = await PendingAd.countDocuments(query);
    
    console.log(`✅ Found ${ads.length} ads (total: ${total}, limit: ${finalLimit}, skip: ${finalSkip}, includeImage: ${includeImageData})`);
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
   SHARED REJECTION LOGIC
   ========================================== */
async function handleAdRejection(req, res) {
  const { id } = req.params;
  const { rejectionReasons, rejectionDetails, rejectionReason } = req.body;
  
  console.log('🚀 [START] REJECTION PROCESS');
  console.log(`📍 ID: ${id}`);
  
  try {
    // נרמול הנתונים - תמיכה בכל הפורמטים
    const finalReasons = rejectionReasons || (rejectionReason ? rejectionReason.split(', ') : ['text', 'title', 'image']);
    const finalDetails = rejectionDetails || 'לא צוין פירוט';

    console.log('📊 DATA:', JSON.stringify({ finalReasons, finalDetails }));

    // טען את הפרסומת
    const pendingAd = await PendingAd.findById(id)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName');

    if (!pendingAd) {
      console.error('❌ Ad not found');
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    // שמור דחייה
    if (typeof pendingAd.addRejection === 'function') {
      pendingAd.addRejection({
        reason: finalReasons.join(', '),
        details: finalDetails,
        rejectedBy: req.userId
      });
    } else {
      pendingAd.status = 'rejected';
      pendingAd.rejectionReason = finalReasons.join(', ');
    }

    await pendingAd.save();
    console.log('✅ Status updated to rejected in DB');

    // קריאה לשיפור AI ושליחת מייל
    try {
      const host = req.get('host');
      const protocol = req.protocol;
      const baseUrl = host.includes('localhost') ? `http://${host}` : `${protocol}://${host}`;
      
      console.log(`🔗 Calling AI improvement: ${baseUrl}/api/ad-improvement/reject-and-improve`);

      const improvementResponse = await axios.post(
        `${baseUrl}/api/ad-improvement/reject-and-improve`,
        {
          adId: id,
          rejectionReasons: finalReasons,
          rejectionDetails: finalDetails
        },
        {
          headers: { Authorization: req.headers.authorization },
          timeout: 120000 
        }
      );

      console.log('✅ AI and Email completed');
      return res.json({
        success: true,
        message: 'הפרסומת נדחתה והודעה נשלחה לסוכן',
        ad: pendingAd,
        emailSent: improvementResponse.data.emailSent
      });

    } catch (aiError) {
      console.error('⚠️ AI/Email step failed but DB updated:', aiError.message);
      return res.json({
        success: true,
        message: 'הפרסומת נדחתה, אך חל שיבוש בשליחת המייל המשופר',
        ad: pendingAd,
        emailSent: false
      });
    }

  } catch (error) {
    console.error('❌ Critical error in rejection:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/* ==========================================
   POST - דחיית פרסומת (תמיכה בשני ה-Endpoints)
   ========================================== */
router.post('/:id/reject', authMiddleware, handleAdRejection);
router.post('/:id/reject-with-components', authMiddleware, handleAdRejection);

module.exports = router;