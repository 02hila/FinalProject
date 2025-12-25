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
    
    // חפש ב-PendingAd קודם
    let ad = await PendingAd.findById(req.params.adId);
    
    if (!ad) {
      ad = await Ad.findById(req.params.adId);
    }
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }

    // ✅ בדיקה: האם יש הצעת מחיר?
    if (ad.quoteId) {
      const quote = await Quote.findById(ad.quoteId);
      
      // יש הצעת מחיר אבל היא לא אושרה - חסום!
      if (quote && quote.status !== 'approved') {
        console.log('❌ Share blocked - quote pending approval');
        return res.json({ 
          success: false, 
          message: 'שלחת הצעת מחיר לחברה והיא עדיין לא אושרה. המתן לאישור החברה לפני השיתוף.'
        });
      }
      
      // ✅ יש הצעת מחיר מאושרת - שולחים מייל לחברה!
      if (quote && quote.status === 'approved') {
        const agent = await User.findById(req.user._id);
        const company = await User.findById(quote.companyId);

        // עדכון הפרסומת
        ad.isShared = true;
        ad.sharedAt = new Date();
        ad.sharedPlatform = platform;
        ad.paymentStatus = 'pending';
        ad.paymentRequestedAt = new Date();
        ad.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
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
        if (company) {
          try {
            await sendPaymentRequestEmail({
              companyEmail: company.email,
              companyName: company.fullName || company.companyName || 'חברה',
              agentName: agent?.fullName || agent?.name || 'סוכן',
              agentEmail: agent?.email,
              agentPhone: agent?.phone,
              adTitle: ad.title || 'פרסומת',
              amount: quote.amount,
              paymentId: payment._id
            });
            console.log('✅ Payment request email sent to:', company.email);
          } catch (emailError) {
            console.error('❌ Email error:', emailError);
          }
        }

        return res.json({ 
          success: true, 
          message: 'תודה! נשלחה הודעה לחברה לתשלום.',
          paymentId: payment._id
        });
      }
    }

    // ✅ אין הצעת מחיר - שיתוף חופשי
    ad.isShared = true;
    ad.sharedAt = new Date();
    ad.sharedPlatform = platform;
    await ad.save();

    console.log('📤 Share confirmed (no quote - free share)');
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
