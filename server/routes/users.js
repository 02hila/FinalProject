const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const Ad = require('../models/Ad');
const QRScan = require('../models/QRScan');
const Campaign = require('../models/Campaign');
const Payment = require('../models/Payment');
const PriceProposal = require('../models/PriceProposal');
const AgentRating = require('../models/AgentRating');
const { authMiddleware } = require('../middleware/auth');
const { isAdmin } = require('../middleware/adminAuth');

// GET - Get list of users (with filtering)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userType, companyId } = req.query;

    const query = {};

    // Filter by user type
    if (userType) {
      query.userType = userType;
    }

    // Filter by company
    if (companyId) {
      query.companyId = companyId;
    }

    console.log('🔍 Fetching users with query:', query);

    // Load users (without passwords!)
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', users.length, 'users');
    
    res.json({ 
      success: true, 
      users 
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בטעינת משתמשים',
      error: error.message 
    });
  }
});

// GET - Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'משתמש לא נמצא' 
      });
    }
    
    res.json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בטעינת משתמש',
      error: error.message 
    });
  }
});

// PUT - Mark onboarding guide as seen
router.put('/mark-guide-seen', authMiddleware, async (req, res) => {
  try {
    console.log('📘 Marking guide as seen for user:', req.userId);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { hasSeenGuide: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    console.log('✅ Guide marked as seen for:', user.fullName || user.email);

    res.json({
      success: true,
      message: 'המדריך סומן כנצפה',
      user
    });
  } catch (error) {
    console.error('❌ Error marking guide as seen:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון סטטוס המדריך',
      error: error.message
    });
  }
});

// DELETE - Delete user account with cascading deletes
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.userId;
    const requestingUserType = req.userType;

    console.log('🗑️ Deleting user:', userId, 'by:', requestingUserId);

    // Authorization check: only the user themselves or admin can delete
    if (requestingUserId !== userId && requestingUserType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'אין לך הרשאה למחוק משתמש זה'
      });
    }

    // Find the user first
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    // Start cascading deletes
    console.log('🔄 Starting cascading deletes for user:', userId);

    // 1. Delete all PendingAds created by this agent
    const pendingAdsDeleted = await PendingAd.deleteMany({ agentId: userId });
    console.log('✅ Deleted', pendingAdsDeleted.deletedCount, 'pending ads');

    // 2. Delete all Ads/Quotes created by this agent
    const adsDeleted = await Ad.deleteMany({ agentId: userId });
    console.log('✅ Deleted', adsDeleted.deletedCount, 'ads');

    // 3. Delete all QRScan records for this agent
    const qrScansDeleted = await QRScan.deleteMany({ agentId: userId });
    console.log('✅ Deleted', qrScansDeleted.deletedCount, 'QR scans');

    // 4. Delete all Payments related to this agent
    const paymentsDeleted = await Payment.deleteMany({ agentId: userId });
    console.log('✅ Deleted', paymentsDeleted.deletedCount, 'payments');

    // 5. Delete all PriceProposals from this agent
    const proposalsDeleted = await PriceProposal.deleteMany({ agentId: userId });
    console.log('✅ Deleted', proposalsDeleted.deletedCount, 'price proposals');

    // 6. Delete all AgentRatings for this agent
    const ratingsDeleted = await AgentRating.deleteMany({ agentId: userId });
    console.log('✅ Deleted', ratingsDeleted.deletedCount, 'agent ratings');

    // 7. Remove this agent from all campaigns' assignedAgents arrays
    const campaignsUpdated = await Campaign.updateMany(
      { assignedAgents: userId },
      { $pull: { assignedAgents: userId } }
    );
    console.log('✅ Removed agent from', campaignsUpdated.modifiedCount, 'campaigns');

    // 8. Update company stats for companies that had this agent assigned
    if (campaignsUpdated.modifiedCount > 0) {
      // Find all companies that had campaigns with this agent
      const affectedCampaigns = await Campaign.find({ assignedAgents: userId });
      const companyIds = [...new Set(affectedCampaigns.map(c => c.companyId.toString()))];

      for (const companyId of companyIds) {
        // Recalculate stats for each company
        const companyCampaigns = await Campaign.find({ companyId, status: 'active' });
        const campaignIds = companyCampaigns.map(c => c._id);

        // Count unique agents across all active campaigns
        const uniqueAgents = new Set();
        companyCampaigns.forEach(campaign => {
          campaign.assignedAgents.forEach(agentId => uniqueAgents.add(agentId.toString()));
        });

        // Count approved and pending ads
        const approvedAds = await PendingAd.countDocuments({
          companyId,
          campaignId: { $in: campaignIds },
          status: 'approved'
        });

        const pendingAds = await PendingAd.countDocuments({
          companyId,
          campaignId: { $in: campaignIds },
          status: 'pending'
        });

        // Update company stats
        await User.findByIdAndUpdate(companyId, {
          'stats.activeCampaigns': companyCampaigns.length,
          'stats.activeAgents': uniqueAgents.size,
          'stats.approvedAds': approvedAds,
          'stats.pendingAds': pendingAds
        });

        console.log(`✅ Updated stats for company ${companyId}: campaigns=${companyCampaigns.length}, agents=${uniqueAgents.size}, approved=${approvedAds}, pending=${pendingAds}`);
      }
    }

    // 9. Finally, delete the user
    await User.findByIdAndDelete(userId);
    console.log('✅ Deleted user account');

    res.json({
      success: true,
      message: 'החשבון נמחק בהצלחה',
      deletedData: {
        pendingAds: pendingAdsDeleted.deletedCount,
        ads: adsDeleted.deletedCount,
        qrScans: qrScansDeleted.deletedCount,
        payments: paymentsDeleted.deletedCount,
        priceProposals: proposalsDeleted.deletedCount,
        ratings: ratingsDeleted.deletedCount,
        campaignsUpdated: campaignsUpdated.modifiedCount
      }
    });

  } catch (error) {
    console.error('❌ Error deleting user:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה במחיקת החשבון',
      error: error.message
    });
  }
});

module.exports = router;
