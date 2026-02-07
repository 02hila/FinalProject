// server/routes/agents.js
const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/agents
// @desc    Get all agents in the system
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const agents = await Agent.find();

    const agentsWithStats = await Promise.all(
      agents.map(async (agent) => {
        const approvedAds = await PendingAd.find({
          agentId: agent._id,
          status: 'approved',
          'companyFeedback.rating': { $exists: true }
        });

        let averageRating = 0;
        let totalRatings = approvedAds.length;

        if (totalRatings > 0) {
          const sum = approvedAds.reduce(
            (acc, ad) => acc + ad.companyFeedback.rating,
            0
          );
          averageRating = sum / totalRatings;
        }

        return {
          ...agent.toObject(),
          stats: {
            averageRating,
            totalRatings
          }
        };
      })
    );

    res.json({ success: true, agents: agentsWithStats });
  } catch (error) {
    console.error('❌ Error fetching agents:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});



// @route   GET /api/agents/new-assignments
// @desc    Get unseen campaign assignments for the logged-in agent
// @access  Private
router.get('/new-assignments', authMiddleware, async (req, res) => {
  try {
    const agentId = req.userId;

    // Get the agent's seen assignments
    const agent = await User.findById(agentId).select('seenCampaignAssignments');
    const seenIds = agent?.seenCampaignAssignments || [];

    // Find campaigns where this agent is assigned but hasn't seen the assignment yet
    const newAssignments = await Campaign.find({
      assignedAgents: agentId,
      _id: { $nin: seenIds },
      status: { $in: ['active', 'draft'] }
    })
    .populate('companyId', 'companyName fullName')
    .sort({ createdAt: -1 });

    console.log(`📋 Found ${newAssignments.length} new campaign assignments for agent ${agentId}`);

    res.json({
      success: true,
      assignments: newAssignments
    });

  } catch (error) {
    console.error('❌ Error fetching new assignments:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @route   PUT /api/agents/mark-assignment-seen/:campaignId
// @desc    Mark a campaign assignment as seen
// @access  Private
router.put('/mark-assignment-seen/:campaignId', authMiddleware, async (req, res) => {
  try {
    const agentId = req.userId;
    const campaignId = req.params.campaignId;

    // Add the campaign to the agent's seen assignments
    await User.findByIdAndUpdate(agentId, {
      $addToSet: { seenCampaignAssignments: campaignId }
    });

    console.log(`✅ Marked campaign ${campaignId} as seen for agent ${agentId}`);

    res.json({
      success: true,
      message: 'Assignment marked as seen'
    });

  } catch (error) {
    console.error('❌ Error marking assignment as seen:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});
// @route   GET /api/agents/:id/stats
// @desc    Get ad statistics for a specific agent
// @access  Private
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const agentId = req.params.id;

    const [approved, pending, rejected] = await Promise.all([
      PendingAd.countDocuments({ agentId, status: 'approved' }),
      PendingAd.countDocuments({ agentId, status: 'pending' }),
      PendingAd.countDocuments({ agentId, status: 'rejected' })
    ]);

    
  const ratingResult = await PendingAd.aggregate([
  {
    $match: {
      agentId: new mongoose.Types.ObjectId(agentId),
      "companyFeedback.rating": { $gt: 0 }
    }
  },
  {
    $group: {
      _id: null,
      avgRating: { $avg: "$companyFeedback.rating" },
      count: { $sum: 1 }
    }
  }
]);


    const averageRating = ratingResult.length > 0 ? ratingResult[0].avgRating : 0;
    const totalRatings = ratingResult.length > 0 ? ratingResult[0].count : 0;
    const totalAds = approved + pending + rejected;

    res.json({
      success: true,
      stats: { 
        approved, 
        pending, 
        rejected, 
        totalAds,
        averageRating: parseFloat(averageRating.toFixed(1)), // מעגל לספרה אחת אחרי הנקודה
        totalRatings,
        campaignsCompleted: 0 
      }
    });

  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;