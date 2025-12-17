// server/routes/pendingAds.js - WORKING VERSION
const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { authMiddleware } = require('../middleware/auth');

// ✅ Import the model correctly
const PendingAd = require('../models/PendingAd');

console.log('📋 PendingAd model type:', typeof PendingAd);
console.log('📋 PendingAd.find type:', typeof PendingAd.find);

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

module.exports = router;