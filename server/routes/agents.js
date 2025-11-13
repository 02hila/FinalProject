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
      .select('fullName email specialty stats profilePic createdAt')
      .sort({ 'stats.averageRating': -1 }); // Sort by rating (highest first)

    console.log('✅ Found', agents.length, 'agents');

    res.json({
      success: true,
      agents: agents
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

    // Use Promise.all to run counts in parallel for better performance
    const [approved, pending, rejected] = await Promise.all([
      PendingAd.countDocuments({ agentId, status: 'approved' }),
      PendingAd.countDocuments({ agentId, status: 'pending' }),
      PendingAd.countDocuments({ agentId, status: 'rejected' })
    ]);

    const totalAds = approved + pending + rejected;

    res.json({
      success: true,
      stats: { approved, pending, rejected, totalAds }
    });

  } catch (error) {
    console.error('Error fetching agent stats:', error);
    res.status(500).json({ success: false, error: 'Server Error' });
  }
});

module.exports = router;