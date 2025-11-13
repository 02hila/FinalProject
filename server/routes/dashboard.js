const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Campaign = require('../models/Campaign');
const Ad = require('../models/Ad');

router.get('/stats', async (req, res) => {
  try {
    const companiesCount = await Company.countDocuments();
    const campaignsCount = await Campaign.countDocuments();
    const activeCampaigns = await Campaign.countDocuments({ status: 'active' });
    const adsCount = await Ad.countDocuments();
    
    const campaigns = await Campaign.find();
    const totalImpressions = campaigns.reduce((sum, c) => sum + (c.impressions || 0), 0);
    const totalClicks = campaigns.reduce((sum, c) => sum + (c.clicks || 0), 0);
    const ctr = totalImpressions > 0 ? ((totalClicks / totalImpressions) * 100).toFixed(2) : 0;

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
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;