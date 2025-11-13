// server/routes/requests.js
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

// קבלת הפניות של סוכן
router.get('/agent/my-requests', authMiddleware, async (req, res) => {
  try {
    // קבל את ה-userId מה-token (צריך middleware)
    const agentId = req.userId; // מגיע מה-authMiddleware
    
    console.log('📋 Getting requests for agent:', agentId);
    
    const requests = await PendingAd.find({ agentId })
      .populate('companyId', 'companyName email')
      .sort({ createdAt: -1 });
    
    const stats = {
      pending: requests.filter(r => r.status === 'pending').length,
      approved: requests.filter(r => r.status === 'approved').length,
      rejected: requests.filter(r => r.status === 'rejected').length,
      totalEarnings: requests
        .filter(r => r.status === 'approved')
        .reduce((sum, r) => sum + (r.price || 0), 0)
    };
    
    res.json({
      success: true,
      requests: requests.map(r => ({
        _id: r._id,
        companyId: r.companyId,
        campaignId: r.campaignId,
        campaignName: r.campaignName,
        price: r.price || 0,
        status: r.status,
        rejectionReason: r.rejectionReason,
        rating: r.companyFeedback,
        adContent: r.adContent,
        createdAt: r.createdAt
      })),
      stats
    });
  } catch (error) {
    console.error('❌ Error fetching agent requests:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;