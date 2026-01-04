// server/routes/pendingAds.js - WITH PAGINATION & ALTERNATIVE AD EMAIL NOTIFICATION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');

// ✅ Import the model correctly
const PendingAd = require('../models/PendingAd');
const { sendAlternativeAdApprovedEmail } = require('../services/emailService');

console.log('📋 PendingAd model type:', typeof PendingAd);
console.log('📋 PendingAd.find type:', typeof PendingAd.find);

/* ==========================================
   GET - כל הפרסומות (עם pagination ו-filters)
   ========================================== */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, agentId, campaignId } = req.query;
    
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
    if (campaignId && campaignId !== 'all') {
      query.campaignId = campaignId;
    }
    
    console.log('📋 Fetching pending ads with query:', query);
    
    // ✅ PAGINATION: Support both page/limit and skip/limit
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 6;
    const skip = req.query.skip ? parseInt(req.query.skip) : (page - 1) * limit;
    
    // Validate values
    const finalLimit = Math.min(Math.max(limit, 1), 100);
    const finalSkip = Math.max(skip, 0);
    
    // ✅ Include imageData for pending ads and agent requests
    const isAgentRequest = req.user.userType === 'agent';
    const isPendingRequest = query.status === 'pending' || req.query.status === 'pending';
    const includeImageData = isPendingRequest || isAgentRequest;

    let adsQuery = PendingAd.find(query);

    if (!includeImageData) {
      adsQuery = adsQuery.select('-imageData');
    }

    console.log(`📸 Including imageData: ${includeImageData ? 'YES' : 'NO'} (agent: ${isAgentRequest}, pending: ${isPendingRequest})`);
    
    // ✅ Get total count BEFORE pagination
    const totalAds = await PendingAd.countDocuments(query);
    const totalPages = Math.ceil(totalAds / finalLimit);
    
    // ✅ Fetch ads with pagination
    const ads = await adsQuery
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .skip(finalSkip)
      .limit(finalLimit);
    
    // ✅ Get unique campaigns for filter dropdown (only for agents on first page)
    let campaigns = [];
    if (isAgentRequest && page === 1) {
      try {
        campaigns = await PendingAd.aggregate([
          { $match: { agentId: req.user._id } },
          { $group: { _id: '$campaignId' } },
          { $lookup: {
              from: 'campaigns',
              localField: '_id',
              foreignField: '_id',
              as: 'campaign'
            }
          },
          { $unwind: { path: '$campaign', preserveNullAndEmptyArrays: false } },
          { $project: { _id: '$campaign._id', title: '$campaign.title' } }
        ]);
      } catch (aggErr) {
        console.log('⚠️ Campaign aggregation failed:', aggErr.message);
      }
    }
    
    console.log(`✅ Found ${ads.length} ads (page: ${page}, totalPages: ${totalPages}, totalAds: ${totalAds})`);
    
    res.json({ 
      success: true, 
      ads, 
      // ✅ Pagination info
      totalAds,
      totalPages,
      currentPage: page,
      limit: finalLimit,
      // ✅ Campaigns for filter
      campaigns,
      // Legacy support
      total: totalAds,
      skip: finalSkip
    });
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
   GET - הורדת תמונה (רק למאושרים)
   ========================================== */
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    // ✅ Only allow download for approved ads
    if (ad.status !== 'approved') {
      return res.status(403).json({ 
        success: false, 
        error: 'ניתן להוריד רק פרסומות מאושרות' 
      });
    }
    
    if (!ad.imageData) {
      return res.status(404).json({ success: false, error: 'No image found' });
    }
    
    // Extract base64 data
    const matches = ad.imageData.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches) {
      return res.status(400).json({ success: false, error: 'Invalid image format' });
    }
    
    const mimeType = matches[1];
    const imageBuffer = Buffer.from(matches[2], 'base64');
    
    // Set headers for download
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="ad-${ad._id}.png"`);
    res.setHeader('Content-Length', imageBuffer.length);
    
    res.send(imageBuffer);
  } catch (error) {
    console.error('❌ Download error:', error);
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
    
    // ✅ NEW: Use the markApproved method
    ad.markApproved();
    
    if (rating) {
      ad.companyFeedback = {
        rating,
        comment: comment || '',
        feedbackDate: new Date()
      };
    }
    
    await ad.save();
    
    console.log(`✅ Ad ${ad._id} approved. Share tracking initialized.`);
    
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