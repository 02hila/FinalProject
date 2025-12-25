const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const PendingAd = require('../models/PendingAd');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const User = require('../models/User');
const { authMiddleware: auth } = require('../middleware/auth');
const { sendPaymentRequestEmail } = require('../services/emailService');

// ✅ אישור שיתוף + שליחת מייל לחברה
router.post('/confirm-share/:adId', auth, async (req, res) => {
  try {
    const { platform } = req.body;
    
    // חפש ב-Ad וגם ב-PendingAd
    let ad = await Ad.findById(req.params.adId).populate('quoteId');
    if (!ad) {
      ad = await PendingAd.findById(req.params.adId);
    }
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }

    // בדיקה: האם יש הצעת מחיר מאושרת?
    if (!ad.quoteId) {
      return res.json({ 
        success: false, 
        message: 'אין הצעת מחיר מקושרת לפרסומת. פנה לחברה.'
      });
    }

    const quote = await Quote.findById(ad.quoteId);
    if (!quote || quote.status !== 'approved') {
      return res.json({ 
        success: false, 
        message: 'החברה עדיין לא אישרה את הצעת המחיר. המתן לאישור.'
      });
    }

    // קבל פרטי סוכן וחברה
    const agent = await User.findById(req.user._id);
    const company = await User.findById(quote.companyId);

    if (!company) {
      return res.status(400).json({ success: false, message: 'חברה לא נמצאה' });
    }

    // עדכון הפרסומת
    ad.isShared = true;
    ad.sharedAt = new Date();
    ad.sharedPlatform = platform;
    ad.paymentStatus = 'pending';
    ad.paymentRequestedAt = new Date();
    ad.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 שעות
    await ad.save();

    // יצירת בקשת תשלום
    const payment = new Payment({
      adId: ad._id,
      companyId: quote.companyId,
      agentId: req.user._id,
      quoteId: quote._id,
      amount: quote.amount,
      status: 'pending',
      dueAt: ad.paymentDueAt
    });
    await payment.save();

    // 📧 שליחת מייל לחברה
    try {
      await sendPaymentRequestEmail({
        companyEmail: company.email,
        companyName: company.fullName || company.companyName,
        agentName: agent.fullName,
        agentEmail: agent.email,
        agentPhone: agent.phone,
        adTitle: ad.title,
        amount: quote.amount,
        paymentId: payment._id
      });
      console.log('✅ Payment request email sent to company');
    } catch (emailError) {
      console.error('❌ Email error:', emailError);
      // ממשיכים גם אם המייל נכשל
    }

    res.json({ 
      success: true, 
      message: 'תודה! נשלחה הודעה לחברה לתשלום.',
      paymentId: payment._id
    });

  } catch (error) {
    console.error('Error confirming share:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

module.exports = router;