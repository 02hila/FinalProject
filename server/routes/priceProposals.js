const express = require('express');
const router = express.Router();
const PriceProposal = require('../models/PriceProposal');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

// @route   POST /api/price-proposals
// @desc    Create a new price proposal
// @access  Private (Agent)
router.post('/', authMiddleware, async (req, res) => {
    try {
        const { campaignId, agentId, proposedBudget, message } = req.body;

        if (!campaignId || !agentId || proposedBudget === undefined || proposedBudget === null || !message) {
            return res.status(400).json({ success: false, error: 'All fields are required' });
        }

        const campaign = await Campaign.findById(campaignId);
        if (!campaign) {
            return res.status(404).json({ success: false, error: 'Campaign not found' });
        }

        const newProposal = new PriceProposal({
            campaignId,
            agentId,
            companyId: campaign.companyId,
            originalBudget: campaign.budget,
            proposedBudget,
            message
        });

        await newProposal.save();
        res.status(201).json({ success: true, proposal: newProposal });
    } catch (error) {
        console.error('Error creating price proposal:', error);
        res.status(500).json({ success: false, error: 'Server Error' });
    }
});

// @route   GET /api/price-proposals
// @desc    Get price proposals by query params
// @access  Private
router.get('/', authMiddleware, async (req, res) => {
    try {
        const { campaignId, agentId, status } = req.query;
        
        console.log('🔍 Getting price proposals with query:', { campaignId, agentId, status });
        
        const query = {};
        if (campaignId) query.campaignId = campaignId;
        if (agentId) query.agentId = agentId;
        if (status) query.status = status;
        
        const proposals = await PriceProposal.find(query)
            .populate('agentId', 'fullName email')
            .populate('campaignId', 'title description budget')
            .sort({ createdAt: -1 });
        
        console.log('✅ Found', proposals.length, 'proposals matching query');
        
        res.json({ success: true, proposals });
    } catch (error) {
        console.error('Error fetching price proposals:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה בטעינת הצעות מחיר',
            proposals: []
        });
    }
});

// @route   GET /api/price-proposals/company/:companyId
// @desc    Get all price proposals for a specific company
// @access  Private
router.get('/company/:companyId', authMiddleware, async (req, res) => {
    try {
        const { companyId } = req.params;
        
        console.log('🔍 Getting price proposals for company:', companyId);
        
        if (!companyId || companyId === 'null' || companyId === 'undefined') {
            return res.status(400).json({ 
                success: false, 
                error: 'חסר מזהה חברה תקין',
                proposals: []
            });
        }

        const proposals = await PriceProposal.find({ companyId })
            .populate('agentId', 'fullName email')
            .populate('campaignId', 'title description')
            .sort({ createdAt: -1 });

        console.log('✅ Found', proposals.length, 'price proposals for company');

        res.json({ success: true, proposals });
    } catch (error) {
        console.error('Error fetching company price proposals:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה בטעינת הצעות מחיר',
            proposals: []
        });
    }
});

// @route   POST /api/price-proposals/:id/approve
// @desc    Approve a price proposal and update campaign budget
// @access  Private (Company)
router.post('/:id/approve', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        console.log('✅ Approving price proposal:', id);

        if (!id || id.length !== 24) {
            return res.status(400).json({ 
                success: false, 
                error: 'מזהה הצעה לא תקין' 
            });
        }

        const proposal = await PriceProposal.findById(id);

        if (!proposal) {
            return res.status(404).json({ 
                success: false, 
                error: 'הצעת מחיר לא נמצאה' 
            });
        }

        if (proposal.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: 'הצעת המחיר כבר טופלה' 
            });
        }

        proposal.status = 'approved';
        proposal.companyResponse = {
            message: message || 'ההצעה אושרה',
            responseDate: new Date()
        };
        proposal.respondedAt = new Date();
        await proposal.save();

        const campaign = await Campaign.findById(proposal.campaignId);
        
        if (campaign) {
            const newTotalBudget = campaign.budget + proposal.proposedBudget;
            console.log('🔄 Updating campaign budget from', campaign.budget, 'to', newTotalBudget);
            campaign.budget = newTotalBudget;
            await campaign.save();
        }

        res.json({ 
            success: true, 
            proposal,
            message: 'הצעת המחיר אושרה והתקציב עודכן בהצלחה'
        });
    } catch (error) {
        console.error('❌ Error approving price proposal:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה באישור הצעת המחיר' 
        });
    }
});

// @route   POST /api/price-proposals/:id/reject
// @desc    Reject a price proposal
// @access  Private (Company)
router.post('/:id/reject', authMiddleware, async (req, res) => {
    try {
        const { id } = req.params;
        const { message } = req.body;

        console.log('❌ Rejecting price proposal:', id);

        const proposal = await PriceProposal.findById(id);

        if (!proposal) {
            return res.status(404).json({ 
                success: false, 
                error: 'הצעת מחיר לא נמצאה' 
            });
        }

        if (proposal.status !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                error: 'הצעת המחיר כבר טופלה' 
            });
        }

        proposal.status = 'rejected';
        proposal.companyResponse = {
            message: message || 'ההצעה נדחתה',
            responseDate: new Date()
        };
        proposal.respondedAt = new Date();
        await proposal.save();

        res.json({ 
            success: true, 
            proposal,
            message: 'הצעת המחיר נדחתה'
        });
    } catch (error) {
        console.error('Error rejecting price proposal:', error);
        res.status(500).json({ 
            success: false, 
            error: 'שגיאה בדחיית הצעת המחיר' 
        });
    }
});

module.exports = router;