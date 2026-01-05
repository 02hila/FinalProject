// server/routes/agents.js
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/agents
// @desc    Get all agents in the system
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
  try {
    const agents = await User.find({ userType: 'agent' })
      .select('fullName email phone specialty stats profilePic socialMediaPlatform socialMediaHandle createdAt') // ✅ הוספתי socialMediaPlatform ו-phone
      .sort({ 'stats.averageRating': -1 });

    // ✅ Enrich agents with real stats from PendingAd collection
    const enrichedAgents = await Promise.all(agents.map(async (agent) => {
      const agentObj = agent.toObject();
      
      // Get real counts from PendingAd
      const [approved, pending, rejected] = await Promise.all([
        PendingAd.countDocuments({ agentId: agent._id, status: 'approved' }),
        PendingAd.countDocuments({ agentId: agent._id, status: 'pending' }),
        PendingAd.countDocuments({ agentId: agent._id, status: 'rejected' })
      ]);
      
      // Merge real stats with existing stats
      agentObj.stats = {
        ...agentObj.stats,
        approvedAds: approved,
        pendingAds: pending,
        rejectedAds: rejected,
        totalAds: approved + pending + rejected
      };
      
      return agentObj;
    }));

    console.log('✅ Found', enrichedAgents.length, 'agents with enriched stats');

    res.json({
      success: true,
      agents: enrichedAgents
    });

  } catch (error) {
    console.error('❌ Error fetching agents:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

// @route   GET /api/agents/:id/stats
// @desc    Get ad statistics for a specific agent
// @access  Private
router.get('/:id/stats', authMiddleware, async (req, res) => {
  try {
    const agentId = req.params.id;

    // Get the agent to include rating info
    const agent = await User.findById(agentId).select('stats');

    // Use Promise.all to run counts in parallel for better performance
    const [approved, pending, rejected] = await Promise.all([
      PendingAd.countDocuments({ agentId, status: 'approved' }),
      PendingAd.countDocuments({ agentId, status: 'pending' }),
      PendingAd.countDocuments({ agentId, status: 'rejected' })
    ]);

    const totalAds = approved + pending + rejected;

    res.json({
      success: true,
      stats: { 
        approved, 
        pending, 
        rejected, 
        totalAds,
        averageRating: agent?.stats?.averageRating || 0,
        totalRatings: agent?.stats?.totalRatings || 0,
        campaignsCompleted: agent?.stats?.campaignsCompleted || 0
      }
    });

  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;