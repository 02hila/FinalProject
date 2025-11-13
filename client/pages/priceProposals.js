const express = require('express');
const router = express.Router();
const PriceProposal = require('../models/PriceProposal');
const Campaign = require('../models/Campaign');

// סוכן שולח הצעת מחיר
router.post('/', async (req, res) => {
  try {
    console.log('💰 Creating price proposal:', req.body);
    
    const { campaignId, agentId, proposedBudget, message } = req.body;
    
    if (!campaignId || !agentId || !proposedBudget) {
      return res.status(400).json({ 
        success: false, 
        error: 'Missing required fields' 
      });
    }
    
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return res.status(404).json({ success: false, error: 'Campaign not found' });
    }
    
    // בדוק אם כבר יש הצעה ממתינה
    const existingProposal = await PriceProposal.findOne({
      campaignId,
      agentId,
      status: 'pending'
    });
    
    if (existingProposal) {
      // עדכן את ההצעה הקיימת
      existingProposal.proposedBudget = proposedBudget;
      existingProposal.message = message;
      await existingProposal.save();
      
      return res.json({ success: true, proposal: existingProposal });
    }
    
    // צור הצעה חדשה
    const proposal = new PriceProposal({
      campaignId,
      agentId,
      companyId: campaign.companyId,
      originalBudget: campaign.budget,
      proposedBudget,
      message
    });
    
    await proposal.save();
    
    console.log('✅ Price proposal created:', proposal._id);
    res.json({ success: true, proposal });
  } catch (error) {
    console.error('❌ Error creating proposal:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// החברה מקבלת את כל ההצעות שלה
router.get('/company/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.query;
    
    const query = { companyId };
    if (status) {
      query.status = status;
    }
    
    const proposals = await PriceProposal.find(query)
      .populate('campaignId', 'title description')
      .populate('agentId', 'fullName email')
      .sort({ createdAt: -1 });
    
    res.json({ success: true, proposals });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// אישור הצעה
router.put('/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const proposal = await PriceProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }
    
    proposal.status = 'approved';
    proposal.companyResponse = {
      message: message || 'ההצעה אושרה',
      responseDate: new Date()
    };
    await proposal.save();
    
    // עדכן את התקציב בקמפיין
    await Campaign.findByIdAndUpdate(proposal.campaignId, {
      budget: proposal.proposedBudget
    });
    
    res.json({ success: true, proposal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// דחיית הצעה
router.put('/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { message } = req.body;
    
    const proposal = await PriceProposal.findById(id);
    if (!proposal) {
      return res.status(404).json({ success: false, error: 'Proposal not found' });
    }
    
    proposal.status = 'rejected';
    proposal.companyResponse = {
      message: message || 'ההצעה נדחתה',
      responseDate: new Date()
    };
    await proposal.save();
    
    res.json({ success: true, proposal });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;