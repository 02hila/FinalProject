const express = require('express');
const router = express.Router();
const mongoose = require('mongoose'); // ✅ הוספה חדשה
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

// @route   GET /api/campaigns/agent/:agentId
// @desc    Get all campaigns assigned to a specific agent
// @access  Private
router.get('/agent/:agentId', authMiddleware, async (req, res) => {
    try {
        const agentId = req.params.agentId;
        
        console.log('🔍 Looking for campaigns for agent:', agentId);

   
        const agentObjectId = new mongoose.Types.ObjectId(agentId);

        // Find campaigns where the agentId is in the assignedAgents array
        const campaigns = await Campaign.find({ assignedAgents: agentObjectId })
            .populate('companyId', 'companyName')
            .sort({ createdAt: -1 });

        console.log('✅ Found campaigns:', campaigns.length);

        // Add companyName to each campaign for easier access on the client
        const campaignsWithCompanyName = campaigns.map(c => ({
            ...c.toObject(),
            companyName: c.companyId?.companyName || 'N/A'
        }));

        res.json({ success: true, campaigns: campaignsWithCompanyName });
    } catch (error) {
        console.error('Error fetching agent campaigns:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

// @route   GET /api/campaigns/company/:companyId
// @desc    Get all campaigns for a specific company
// @access  Private
router.get('/company/:companyId', authMiddleware, async (req, res) => {
    try {
        const { companyId } = req.params;
        
        console.log('🔍 Getting campaigns for company:', companyId);
        
        if (!companyId || companyId === 'null' || companyId === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                error: 'חסר מזהה חברה תקין',
                campaigns: []
            });
        }

        const campaigns = await Campaign.find({ companyId })
            .populate('assignedAgents', 'fullName email')
            .sort({ createdAt: -1 });

        console.log('✅ Found', campaigns.length, 'campaigns for company');

        res.json({ success: true, campaigns });
    } catch (error) {
        console.error('Error fetching company campaigns:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה בטעינת קמפיינים',
            campaigns: []
        });
    }
});

// @route   POST /api/campaigns
// @desc    Create a new campaign
// @access  Private
router.post('/', authMiddleware, async (req, res) => {
    try {
        const campaignData = req.body;
        
        console.log('📥 Creating new campaign:', campaignData);

        const campaign = new Campaign(campaignData);
        await campaign.save();

        console.log('✅ Campaign created:', campaign._id);

        res.status(201).json({ success: true, campaign });
    } catch (error) {
        console.error('Error creating campaign:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה ביצירת קמפיין' 
        });
    }
});

// @route   PUT /api/campaigns/:id
// @desc    Update a campaign
// @access  Private
router.put('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const campaign = await Campaign.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'קמפיין לא נמצא' 
            });
        }

        res.json({ success: true, campaign });
    } catch (error) {
        console.error('Error updating campaign:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה בעדכון קמפיין' 
        });
    }
});

// @route   DELETE /api/campaigns/:id
// @desc    Delete a campaign
// @access  Private
router.delete('/:id', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;

        const campaign = await Campaign.findByIdAndDelete(id);

        if (!campaign) {
            return res.status(404).json({ 
                success: false, 
                error: 'קמפיין לא נמצא' 
            });
        }

        res.json({ 
            success: true, 
            message: 'קמפיין נמחק בהצלחה' 
        });
    } catch (error) {
        console.error('Error deleting campaign:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה במחיקת קמפיין' 
        });
    }
});

module.exports = router;