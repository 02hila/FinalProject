// server/routes/pendingAds.js - WITH ALTERNATIVE AD EMAIL NOTIFICATION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');
const axios = require('axios');

// Import the model correctly
const PendingAd = require('../models/PendingAd');
const { sendAlternativeAdApprovedEmail } = require('../services/emailService');

console.log('📋 PendingAd model type:', typeof PendingAd);
console.log('📋 PendingAd.find type:', typeof PendingAd.find);

/* ==========================================
   GET - All ads (with filters)
   ========================================== */
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { status, agentId, campaignId } = req.query;

    let query = {};

    // Automatically filter by company if user is a company
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
    if (campaignId) query.campaignId = campaignId;

    console.log('📋 Fetching pending ads with query:', query);

    //  Pagination - calculate skip from page number
    const page = req.query.page ? parseInt(req.query.page, 10) : 1;
    const limitValue = req.query.limit ? parseInt(req.query.limit, 10) : 50;
    const finalLimit = isNaN(limitValue) ? 50 : Math.min(Math.max(limitValue, 1), 100);
    const finalPage = isNaN(page) ? 1 : Math.max(page, 1);
    const finalSkip = (finalPage - 1) * finalLimit;
    
    //Include imageData for pending ads and agent requests
    const isAgentRequest = req.user.userType === 'agent';
    const isPendingRequest = query.status === 'pending' || req.query.status === 'pending';
    const includeImageData = isPendingRequest || isAgentRequest;

    let adsQuery = PendingAd.find(query);

    if (!includeImageData) {
      adsQuery = adsQuery.select('-imageData');
    }

    console.log(`📸 Including imageData: ${includeImageData ? 'YES' : 'NO'} (agent: ${isAgentRequest}, pending: ${isPendingRequest})`);
    
    const ads = await adsQuery
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(finalLimit)
      .skip(finalSkip);
    
    const total = await PendingAd.countDocuments(query);

    // Calculate pagination info
    const totalPages = Math.ceil(total / finalLimit);
    const currentPage = Math.min(finalPage, totalPages || 1);
    
    console.log(`✅ Found ${ads.length} ads (total: ${total}, page: ${currentPage}/${totalPages}, limit: ${finalLimit}, includeImage: ${includeImageData})`);
    res.json({ success: true, ads, total, totalAds: total, currentPage, totalPages, limit: finalLimit, skip: finalSkip });
  } catch (error) {
    console.error('❌ Error fetching pending ads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   GET - Specific ad
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
   POST - Approve ad
   ========================================== */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ad = await PendingAd.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }

    // Use the markApproved method
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
    // Normalize data - support all formats
    const finalReasons = rejectionReasons || (rejectionReason ? rejectionReason.split(', ') : ['text', 'title', 'image']);
    const finalDetails = rejectionDetails || 'לא צוין פירוט';

    console.log('📊 DATA:', JSON.stringify({ finalReasons, finalDetails }));

    // Load the ad
    const pendingAd = await PendingAd.findById(id)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName');

    if (!pendingAd) {
      console.error('❌ Ad not found');
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    // Save rejection
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
   POST - Reject ad (support for two endpoints)
   ========================================== */
router.post('/:id/reject', authMiddleware, handleAdRejection);
router.post('/:id/reject-with-components', authMiddleware, handleAdRejection);

/* ==========================================
   POST - שמירת פרסומת לאחר אישור הסוכן
   ========================================== */
router.post('/save-approved', authMiddleware, async (req, res) => {
  try {
    const saveData = req.body;
    
    if (!saveData || !saveData.uniqueId) {
      return res.status(400).json({ success: false, error: 'Missing required data' });
    }

    // Verify the agent is the one who generated the ad
    if (saveData.agentId !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: 'Not authorized' });
    }

    // Save the ad to database
    const pendingAd = new PendingAd({
      uniqueId: saveData.uniqueId,
      title: saveData.title,
      text: saveData.text,
      callToAction: saveData.callToAction,
      imageData: saveData.imageData,
      companyId: saveData.companyId,
      campaignId: saveData.campaignId,
      agentId: saveData.agentId,
      qrCode: saveData.qrCode,
      websiteUrl: saveData.websiteUrl,
      metadata: saveData.metadata,
      status: 'pending' // Waiting for company approval
    });

    await pendingAd.save();
    console.log('✅ Ad saved after agent approval:', pendingAd._id);

    return res.json({
      success: true,
      pendingAdId: pendingAd._id,
      message: 'Ad saved successfully'
    });
  } catch (error) {
    console.error('❌ Error saving approved ad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ==========================================
   DELETE - Delete ad (for agent who didn't like the ad)
   ========================================== */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }
    
    // Only allow agent who created the ad to delete it (if status is pending)
    if (ad.status === 'pending' && ad.agentId.toString() === req.user._id.toString()) {
      await PendingAd.findByIdAndDelete(req.params.id);
      console.log('✅ Ad deleted by agent:', req.params.id);
      return res.json({ success: true, message: 'Ad deleted successfully' });
    }
    
    return res.status(403).json({ success: false, error: 'Not authorized to delete this ad' });
  } catch (error) {
    console.error('❌ Error deleting ad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;