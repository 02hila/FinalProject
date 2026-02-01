const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const PendingAd = require('../models/PendingAd');
const PriceProposal = require('../models/PriceProposal');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Campaign = require('../models/Campaign');
const Company = require('../models/Company');
const { authMiddleware: auth } = require('../middleware/auth');
const { sendPaymentRequestEmail } = require('../services/emailService');

// Confirm share + send email to company
router.post('/confirm-share/:adId', auth, async (req, res) => {
  try {
    const { platform } = req.body;

    // Search in PendingAd first
    let ad = await PendingAd.findById(req.params.adId);
    let isPendingAd = !!ad;

    if (!ad) {
      ad = await Ad.findById(req.params.adId);
    }

    if (!ad) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }

    console.log('📤 Processing share for ad:', ad._id);
    console.log('📤 Ad campaignId:', ad.campaignId);

    // Check: Is there an approved price proposal for this campaign?
    let approvedProposal = null;

    if (ad.campaignId) {
      approvedProposal = await PriceProposal.findOne({
        campaignId: ad.campaignId,
        status: 'approved'
      }).populate('companyId');

      console.log('📤 Found approved proposal:', approvedProposal ? 'YES' : 'NO');
    }

    // There is an approved price proposal - send email to company!
    if (approvedProposal) {
      const agent = await User.findById(req.user._id);
      const company = approvedProposal.companyId;

      console.log('📤 Company:', company?.email);
      console.log('📤 Agent:', agent?.fullName);

      // Update the ad
      ad.isShared = true;
      ad.sharedAt = new Date();
      ad.sharedPlatform = platform;
      ad.paymentStatus = 'pending';
      ad.paymentRequestedAt = new Date();
      ad.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await ad.save();

      // Calculate agent share: 70% base + proposed adjustment
      // The proposedBudget represents the difference from the 70% base
      const baseAgentShare = approvedProposal.originalBudget * 0.7;
      const agentShare = baseAgentShare + approvedProposal.proposedBudget;

      // Create payment request with agent share amount
      const payment = new Payment({
        adId: ad._id,
        companyId: approvedProposal.companyId._id,
        agentId: req.user._id,
        priceProposalId: approvedProposal._id,
        amount: agentShare, // Agent's 70% share
        status: 'pending',
        dueAt: ad.paymentDueAt
      });
      await payment.save();
      console.log('✅ Payment created:', payment._id, 'Agent share:', agentShare);

      // Send email to company (email will calculate total from agent share)
      if (company && company.email) {
        try {
          await sendPaymentRequestEmail({
            companyEmail: company.email,
            companyName: company.fullName || company.companyName || 'חברה',
            agentName: agent?.fullName || agent?.name || 'סוכן',
            agentEmail: agent?.email,
            agentPhone: agent?.phone,
            adTitle: ad.title || 'פרסומת',
            amount: agentShare, // Agent's share - email will show total breakdown
            paymentId: payment._id
          });
          console.log('✅ Payment request email sent to:', company.email);
        } catch (emailError) {
          console.error('❌ Email error:', emailError);
        }
      } else {
        console.log('⚠️ No company email found');
      }

      return res.json({
        success: true,
        message: 'תודה! נשלחה הודעה לחברה לתשלום.',
        paymentId: payment._id
      });
    }

    // No approved price proposal - still send payment request with default budget
    console.log('📤 No approved proposal - sending payment request with default budget...');

    const agent = await User.findById(req.user._id);

    // Get campaign to find the default budget
    let campaign = null;
    let company = null;

    if (ad.campaignId) {
      campaign = await Campaign.findById(ad.campaignId);
      if (campaign?.companyId) {
        company = await User.findById(campaign.companyId);
      }
    }

    // If no company found via campaign, try to find via ad's companyId
    if (!company && ad.companyId) {
      company = await User.findById(ad.companyId);
      // Also try Company model
      if (!company) {
        const companyDoc = await Company.findById(ad.companyId);
        if (companyDoc) {
          company = await User.findById(companyDoc.userId);
        }
      }
    }

    // Calculate default budget: Ad Budget (Ads-Maker fee) + Agent Fee (70% of budget)
    // Default budget is the campaign budget, or 100 if not set
    const defaultBudget = campaign?.budget || 100;
    const agentFee = defaultBudget * 0.7; // 70% goes to agent
    const adsMakerFee = defaultBudget * 0.3; // 30% is Ads-Maker fee
    const totalAmount = defaultBudget; // Total = Ad Budget (which includes both fees)

    console.log('📤 Default budget calculation:');
    console.log('   Campaign budget:', defaultBudget);
    console.log('   Agent fee (70%):', agentFee);
    console.log('   Ads-Maker fee (30%):', adsMakerFee);
    console.log('   Total amount:', totalAmount);

    // Update ad status
    ad.isShared = true;
    ad.sharedAt = new Date();
    ad.sharedPlatform = platform;
    ad.paymentStatus = 'pending';
    ad.paymentRequestedAt = new Date();
    ad.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await ad.save();

    // Create payment record even without approved proposal
    if (company) {
      const payment = new Payment({
        adId: ad._id,
        companyId: company._id,
        agentId: req.user._id,
        amount: agentFee, // Agent's share
        status: 'pending',
        dueAt: ad.paymentDueAt,
        metadata: {
          defaultBudget: true, // Flag to indicate this used default values
          totalBudget: totalAmount,
          agentFee: agentFee,
          adsMakerFee: adsMakerFee
        }
      });
      await payment.save();
      console.log('✅ Payment created with default budget:', payment._id);

      // Send email to company requesting payment
      if (company.email) {
        try {
          await sendPaymentRequestEmail({
            companyEmail: company.email,
            companyName: company.fullName || company.companyName || 'חברה',
            agentName: agent?.fullName || agent?.name || 'סוכן',
            agentEmail: agent?.email,
            agentPhone: agent?.phone,
            adTitle: ad.title || 'פרסומת',
            amount: agentFee, // Agent's share - email will show total breakdown
            paymentId: payment._id,
            isDefaultBudget: true // Flag for email template
          });
          console.log('✅ Payment request email sent to:', company.email);
        } catch (emailError) {
          console.error('❌ Email error:', emailError);
        }
      } else {
        console.log('⚠️ No company email found for payment request');
      }

      return res.json({
        success: true,
        message: 'תודה! נשלחה הודעה לחברה לתשלום.',
        paymentId: payment._id
      });
    }

    // No company found at all - just mark as shared
    console.log('⚠️ No company found - share recorded without payment request');
    return res.json({
      success: true,
      message: 'השיתוף נרשם בהצלחה!'
    });

  } catch (error) {
    console.error('❌ Error confirming share:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

module.exports = router;