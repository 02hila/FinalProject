const express = require('express');
const router = express.Router();
const Ad = require('../models/Ad');
const Quote = require('../models/Quote');
const Payment = require('../models/Payment');
const auth = require('../middleware/auth');

// ✅ בדיקה לפני שיתוף
router.post('/check-before-share/:adId', auth, async (req, res) => {
  try {
    const ad = await Ad.findById(req.params.adId).populate('quoteId');
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }
    
    // בדיקה 1: האם סרקו לפחות פעם אחת?
    if (ad.scanCount < 1) {
      return res.json({ 
        success: false, 
        canShare: false,
        reason: 'no_scan',
        message: 'יש לסרוק את הקוד לפחות פעם אחת לפני השיתוף'
      });
    }
    
    // בדיקה 2: האם יש הצעת מחיר מאושרת?
    if (!ad.quoteId) {
      return res.json({ 
        success: false, 
        canShare: false,
        reason: 'no_quote',
        message: 'אין הצעת מחיר מקושרת לפרסומת'
      });
    }
    
    if (ad.quoteId.status !== 'approved') {
      return res.json({ 
        success: false, 
        canShare: false,
        reason: 'quote_not_approved',
        message: 'החברה עדיין לא אישרה את הצעת המחיר. המתן לאישור לפני השיתוף.',
        quoteStatus: ad.quoteId.status
      });
    }
    
    // ✅ הכל בסדר - אפשר לשתף
    return res.json({ 
      success: true, 
      canShare: true,
      message: 'ניתן לשתף'
    });
    
  } catch (error) {
    console.error('Error checking share status:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

// ✅ ביצוע שיתוף בפועל
router.post('/confirm-share/:adId', auth, async (req, res) => {
  try {
    const { platform } = req.body;
    const ad = await Ad.findById(req.params.adId).populate('quoteId');
    
    if (!ad) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }
    
    // עדכון הפרסומת
    ad.isShared = true;
    ad.sharedAt = new Date();
    await ad.save();
    
    // יצירת בקשת תשלום לחברה
    const payment = new Payment({
      adId: ad._id,
      companyId: ad.quoteId.companyId,
      agentId: ad.quoteId.agentId,
      quoteId: ad.quoteId._id,
      amount: ad.quoteId.amount,
      status: 'pending'
    });
    
    // הגדרת דדליין - 24 שעות
    ad.paymentStatus = 'pending';
    ad.paymentRequestedAt = new Date();
    ad.paymentDueAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await ad.save();
    await payment.save();
    
    // TODO: שליחת התראה לחברה
    // await sendNotificationToCompany(ad.quoteId.companyId, payment);
    
    res.json({ 
      success: true, 
      message: 'השיתוף בוצע! נשלחה בקשת תשלום לחברה',
      paymentId: payment._id
    });
    
  } catch (error) {
    console.error('Error confirming share:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

module.exports = router;