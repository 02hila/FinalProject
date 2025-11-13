// server/routes/companyDashboard.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Ad = require('../models/Ad');
const { authMiddleware } = require('../middleware/auth');

// Get company dashboard stats
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    // Verify user is a company
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied. Only companies can access this dashboard.' 
      });
    }

    const companyId = req.user._id;

    // Get company's campaigns
    const campaigns = await Campaign.find({ companyId }).sort({ createdAt: -1 });
    
    // Get all ads related to company's campaigns
    const campaignIds = campaigns.map(c => c._id);
    const allAds = await Ad.find({ campaignId: { $in: campaignIds } });
    
    // Count ads by status (you'll need to add status field to Ad model or use a different logic)
    // For now, we'll use the stats from the user
    const pendingAdsCount = req.user.stats.pendingAds || 0;
    const approvedAdsCount = req.user.stats.approvedAds || 0;
    
    // Count active campaigns
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    
    // Get total agents (this would need a relationship model, for now returning 0)
    const totalAgents = req.user.stats.activeAgents || 0;

    // Calculate rejected ads (total - approved - pending)
    const totalAds = allAds.length;
    const rejectedAds = Math.max(0, totalAds - approvedAdsCount - pendingAdsCount);

    // Count proposals (would need a Proposal model, for now returning 0)
    const proposalsCount = 0;

    res.json({
      success: true,
      stats: {
        totalAgents,
        pendingAds: pendingAdsCount,
        approvedAds: approvedAdsCount,
        activeCampaigns,
        rejectedAds,
        proposalsCount,
        totalCampaigns: campaigns.length,
        totalAds
      },
      company: {
        name: req.user.companyName,
        email: req.user.email,
        industry: req.user.industry,
        website: req.user.website
      }
    });
  } catch (error) {
    console.error('Error fetching company dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get company's pending ads
router.get('/pending-ads', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    const companyId = req.user._id;
    const campaigns = await Campaign.find({ companyId });
    const campaignIds = campaigns.map(c => c._id);
    
    // Get ads that need approval (you'll need to add status field)
    const pendingAds = await Ad.find({ 
      campaignId: { $in: campaignIds }
      // Add: status: 'pending' when you add the status field
    }).populate('campaignId').sort({ createdAt: -1 });

    res.json({
      success: true,
      pendingAds
    });
  } catch (error) {
    console.error('Error fetching pending ads:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get company's campaigns
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    const companyId = req.user._id;
    const campaigns = await Campaign.find({ companyId }).sort({ createdAt: -1 });

    res.json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get company's agents (if you have a relationship model)
router.get('/agents', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    // This would need a CompanyAgent relationship model
    // For now, returning all agents
    const agents = await User.find({ userType: 'agent', isActive: true })
      .select('fullName email specialty stats')
      .sort({ 'stats.averageRating': -1 });

    res.json({
      success: true,
      agents
    });
  } catch (error) {
    console.error('Error fetching agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Approve ad
router.put('/approve-ad/:adId', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    const { adId } = req.params;
    const { feedback } = req.body;

    // Update ad status (you'll need to add status field to Ad model)
    const ad = await Ad.findById(adId);
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }

    // Add status field: ad.status = 'approved';
    // Add feedback field: ad.feedback = feedback;
    await ad.save();

    // Update company stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.approvedAds': 1, 'stats.pendingAds': -1 }
    });

    res.json({
      success: true,
      message: 'Ad approved successfully',
      ad
    });
  } catch (error) {
    console.error('Error approving ad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Reject ad
router.put('/reject-ad/:adId', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    const { adId } = req.params;
    const { reason } = req.body;

    const ad = await Ad.findById(adId);
    if (!ad) {
      return res.status(404).json({ success: false, error: 'Ad not found' });
    }

    // Add status field: ad.status = 'rejected';
    // Add rejection reason: ad.rejectionReason = reason;
    await ad.save();

    // Update company stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.pendingAds': -1 }
    });

    res.json({
      success: true,
      message: 'Ad rejected',
      ad
    });
  } catch (error) {
    console.error('Error rejecting ad:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create new campaign
router.post('/campaigns', authMiddleware, async (req, res) => {
  try {
    if (req.user.userType !== 'company') {
      return res.status(403).json({ 
        success: false, 
        error: 'Access denied.' 
      });
    }

    const campaignData = {
      ...req.body,
      companyId: req.user._id
    };

    const campaign = new Campaign(campaignData);
    await campaign.save();

    // Update company stats
    await User.findByIdAndUpdate(req.user._id, {
      $inc: { 'stats.activeCampaigns': 1 }
    });

    res.json({
      success: true,
      message: 'Campaign created successfully',
      campaign
    });
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;