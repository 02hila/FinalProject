const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const PendingAd = require('../models/PendingAd');
const PriceProposal = require('../models/PriceProposal');
const Payment = require('../models/Payment');
const User = require('../models/User');
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

      // Create payment request
      const payment = new Payment({
        adId: ad._id,
        companyId: approvedProposal.companyId._id,
        agentId: req.user._id,
        priceProposalId: approvedProposal._id,
        amount: approvedProposal.proposedBudget,
        status: 'pending',
        dueAt: ad.paymentDueAt
      });
      await payment.save();
      console.log('✅ Payment created:', payment._id);

      // Send email to company
      if (company && company.email) {
        try {
          await sendPaymentRequestEmail({
            companyEmail: company.email,
            companyName: company.fullName || company.companyName || 'חברה',
            agentName: agent?.fullName || agent?.name || 'סוכן',
            agentEmail: agent?.email,
            agentPhone: agent?.phone,
            adTitle: ad.title || 'פרסומת',
            amount: approvedProposal.proposedBudget,
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

    // No approved price proposal - free share
    ad.isShared = true;
    ad.sharedAt = new Date();
    ad.sharedPlatform = platform;
    await ad.save();

    console.log('📤 Share confirmed (no approved proposal - free share)');
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