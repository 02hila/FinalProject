const express = require('express');
const router = express.Router();
const Company = require('../models/Company');
const Campaign = require('../models/Campaign');  // ✅ הוספתי!
const { authMiddleware } = require('../middleware/auth');

router.get('/', authMiddleware, async (req, res) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json({ success: true, companies });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const company = new Company(req.body);
    await company.save();
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findById(req.params.id);
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ✅ NEW: Get all campaigns for a specific company
router.get('/:id/campaigns', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 Fetching campaigns for company:', id);
    
    // Find all campaigns for this company
    const campaigns = await Campaign.find({ companyId: id })
      .populate('assignedAgents', 'fullName email')
      .sort({ createdAt: -1 });
    
    console.log(`✅ Found ${campaigns.length} campaigns for company ${id}`);
    
    res.json({
      success: true,
      campaigns
    });
  } catch (error) {
    console.error('❌ Error fetching company campaigns:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const company = await Company.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json({ success: true, company });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await Company.findByIdAndDelete(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;