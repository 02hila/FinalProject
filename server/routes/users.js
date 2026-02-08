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

// PUT - Update user profile
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const userId = req.params.id;
    const requestingUserId = req.userId;
    const requestingUserType = req.userType;
    const updates = req.body;

    console.log('📝 Updating user profile:', userId, 'by:', requestingUserId);

    // Authorization check: only the user themselves or admin can update
    if (requestingUserId !== userId && requestingUserType !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'אין לך הרשאה לעדכן משתמש זה'
      });
    }

    // Prevent updating sensitive fields
    delete updates.password;
    delete updates.email;
    delete updates.userType;
    delete updates.stats;
    delete updates.isActive;
    delete updates.isVerified;
    delete updates.createdAt;
    delete updates.updatedAt;

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: updates },
      { new: true, runValidators: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    console.log('✅ User profile updated successfully');

    res.json({
      success: true,
      message: 'הפרופיל עודכן בהצלחה',
      user
    });

  } catch (error) {
    console.error('❌ Error updating user profile:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון הפרופיל',
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

    // Start cascading deletes based on user type
    console.log('🔄 Starting cascading deletes for user:', userId, 'type:', user.userType);

    // Initialize delete counters
    let pendingAdsDeleted = { deletedCount: 0 };
    let adsDeleted = { deletedCount: 0 };
    let qrScansDeleted = { deletedCount: 0 };
    let paymentsDeleted = { deletedCount: 0 };
    let proposalsDeleted = { deletedCount: 0 };
    let campaignsDeleted = { deletedCount: 0 };
    let ratingsDeleted = { deletedCount: 0 };
    let campaignsUpdated = { modifiedCount: 0 };

    // Validate user type
    if (!user.userType || (user.userType !== 'agent' && user.userType !== 'company')) {
      console.error('❌ Invalid user type:', user.userType);
      return res.status(400).json({
        success: false,
        message: 'סוג משתמש לא תקין'
      });
    }

    if (user.userType === 'agent') {
      try {
        // Agent deletion logic
        // 1. Delete all PendingAds created by this agent
        pendingAdsDeleted = await PendingAd.deleteMany({ agentId: userId });
        console.log('✅ Deleted', pendingAdsDeleted.deletedCount, 'pending ads');

        // 2. Delete all Ads/Quotes created by this agent
        adsDeleted = await Ad.deleteMany({ agentId: userId });
        console.log('✅ Deleted', adsDeleted.deletedCount, 'ads');

        // 3. Delete all QRScan records for this agent
        qrScansDeleted = await QRScan.deleteMany({ agentId: userId });
        console.log('✅ Deleted', qrScansDeleted.deletedCount, 'QR scans');

        // 4. Delete all Payments related to this agent
        paymentsDeleted = await Payment.deleteMany({ agentId: userId });
        console.log('✅ Deleted', paymentsDeleted.deletedCount, 'payments');

        // 5. Delete all PriceProposals from this agent
        proposalsDeleted = await PriceProposal.deleteMany({ agentId: userId });
        console.log('✅ Deleted', proposalsDeleted.deletedCount, 'price proposals');

        // 6. Delete all AgentRatings for this agent
        ratingsDeleted = await AgentRating.deleteMany({ agentId: userId });
        console.log('✅ Deleted', ratingsDeleted.deletedCount, 'agent ratings');

        // 7. Find affected campaigns before removing agent
        const affectedCampaigns = await Campaign.find({ assignedAgents: userId });

        // 8. Remove this agent from all campaigns' assignedAgents arrays
        campaignsUpdated = await Campaign.updateMany(
          { assignedAgents: userId },
          { $pull: { assignedAgents: userId } }
        );
        console.log('✅ Removed agent from', campaignsUpdated.modifiedCount, 'campaigns');
      } catch (agentDeleteError) {
        console.error('❌ Error in agent deletion logic:', agentDeleteError);
        throw new Error(`Failed to delete agent data: ${agentDeleteError.message}`);
      }

      // 9. Update company stats for companies that had this agent assigned
      if (campaignsUpdated.modifiedCount > 0) {
        try {
          // Use the affected campaigns found before removal
          const companyIds = [...new Set(affectedCampaigns.map(c => c.companyId.toString()))];

          for (const companyId of companyIds) {
            try {
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
            } catch (statsError) {
              console.warn(`⚠️ Failed to update stats for company ${companyId}:`, statsError.message);
              // Continue with other companies, don't fail the whole deletion
            }
          }
        } catch (statsUpdateError) {
          console.warn('⚠️ Failed to update company stats after agent removal:', statsUpdateError.message);
          // Don't fail the user deletion if stats update fails
        }
      }
    } else if (user.userType === 'company') {
      // Company deletion logic
      // 1. Find all campaigns created by this company
      const companyCampaigns = await Campaign.find({ companyId: userId });
      const campaignIds = companyCampaigns.map(c => c._id);
      console.log('📋 Found', campaignIds.length, 'campaigns for company');

      // 2. Delete all PendingAds related to company's campaigns
      pendingAdsDeleted = await PendingAd.deleteMany({ campaignId: { $in: campaignIds } });
      console.log('✅ Deleted', pendingAdsDeleted.deletedCount, 'pending ads');

      // 3. Delete all Ads/Quotes related to company's campaigns
      adsDeleted = await Ad.deleteMany({ campaignId: { $in: campaignIds } });
      console.log('✅ Deleted', adsDeleted.deletedCount, 'ads');

      // 4. Delete all QRScan records for company's campaigns
      qrScansDeleted = await QRScan.deleteMany({ campaignId: { $in: campaignIds } });
      console.log('✅ Deleted', qrScansDeleted.deletedCount, 'QR scans');

      // 5. Delete all Payments related to company's campaigns
      paymentsDeleted = await Payment.deleteMany({ campaignId: { $in: campaignIds } });
      console.log('✅ Deleted', paymentsDeleted.deletedCount, 'payments');

      // 6. Delete all PriceProposals related to company's campaigns
      proposalsDeleted = await PriceProposal.deleteMany({ campaignId: { $in: campaignIds } });
      console.log('✅ Deleted', proposalsDeleted.deletedCount, 'price proposals');

      // 7. Delete all campaigns created by this company
      campaignsDeleted = await Campaign.deleteMany({ companyId: userId });
      console.log('✅ Deleted', campaignsDeleted.deletedCount, 'campaigns');

      // Initialize ratingsDeleted for company (companies don't have ratings)
      ratingsDeleted = { deletedCount: 0 };

      // 8. Update agent stats for agents that were assigned to this company's campaigns
      if (campaignIds.length > 0) {
        // Find all agents that were assigned to this company's campaigns
        const affectedAgents = await Campaign.find({ companyId: userId }).distinct('assignedAgents');
        const agentIds = [...new Set(affectedAgents.map(id => id.toString()))];

        for (const agentId of agentIds) {
          // Recalculate stats for each agent
          const agentAds = await Ad.find({ agentId });
          const agentPendingAds = await PendingAd.find({ agentId });

          const approvedAds = agentAds.filter(ad => ad.status === 'approved').length;
          const pendingAds = agentPendingAds.filter(ad => ad.status === 'pending').length;
          const rejectedAds = agentPendingAds.filter(ad => ad.status === 'rejected').length;

          // Calculate average rating
          const ratings = await AgentRating.find({ agentId });
          const averageRating = ratings.length > 0
            ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length
            : 0;

          // Update agent stats
          await User.findByIdAndUpdate(agentId, {
            'stats.totalAds': agentAds.length + agentPendingAds.length,
            'stats.approvedAds': approvedAds,
            'stats.pendingAds': pendingAds,
            'stats.rejectedAds': rejectedAds,
            'stats.averageRating': averageRating,
            'stats.totalRatings': ratings.length
          });

          console.log(`✅ Updated stats for agent ${agentId}: total=${agentAds.length + agentPendingAds.length}, approved=${approvedAds}, pending=${pendingAds}, rejected=${rejectedAds}, rating=${averageRating.toFixed(1)}`);
        }
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
