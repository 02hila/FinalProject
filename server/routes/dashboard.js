const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Campaign = require('../models/Campaign');
const Ad = require('../models/Ad');
/**
 * @route   GET /stats
 * @desc    Get dashboard statistics including counts and performance metrics (CTR)
 * @access  Private/Admin
 */
router.get('/stats', async (req, res) => {
  try {
    /**
     * 1. Data Collection
     * Fetching document counts from various collections
     */
    const companiesCount = await Company.countDocuments();
    const campaignsCount = await Campaign.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'active' });
    const adsCount = await Ad.countDocuments();
    /**
     * 2. Metric Calculations
     * Aggregating totals from all campaigns
     */
    const campaigns = await Campaign.find();
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    /**
     * 3. Performance Analysis
     * Calculate CTR (Click-Through Rate). Prevents division by zero.
     */
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;
    // Send the aggregated analytics response
    res.json({
      success: true,
      stats: {
        companies: companiesCount,
        totalCampaigns: campaignsCount,
        activeCampaigns,
        generatedAds: adsCount,
        totalImpressions,
        totalClicks,
        ctr
      }
    });
  } catch (error) {
    /**
     * 4. Error Handling
     */
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;