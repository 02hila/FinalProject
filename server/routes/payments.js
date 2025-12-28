// routes/payments.js

const express = require('express');
const router = express.Router();

// Import stripe - handle missing key gracefully
let stripe = null;
if (process.env.STRIPE_SECRET_KEY) {
  stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  console.log('✅ Stripe configured');
} else {
  console.log('⚠️ STRIPE_SECRET_KEY not set - payments will not work');
}

const Payment = require('../models/Payment');
const PendingAd = require('../models/PendingAd');

// Auth middleware - inline to avoid import issues
const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'לא מורשה - אין טוקן' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    const user = await User.findById(decoded.userId || decoded.id);
    if (!user) {
      return res.status(401).json({ success: false, message: 'משתמש לא נמצא' });
    }
    
    req.user = user;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ success: false, message: 'טוקן לא תקין' });
  }
};

// קבלת תשלומים ממתינים של החברה
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    console.log('💳 Fetching pending payments for user:', req.user._id, 'type:', req.user.userType);
    
    // וידוא שזו חברה
    if (req.user.userType !== 'company') {
      return res.status(403).json({ success: false, message: 'גישה לחברות בלבד' });
    }

    const payments = await Payment.find({
      companyId: req.user._id,
      status: 'pending'
    })
    .populate('adId', 'businessName title text imageData')
    .populate('agentId', 'fullName email')
    .sort({ createdAt: -1 });

    console.log('💳 Found payments:', payments.length);

    // חישוב זמן שנותר
    const paymentsWithTimeLeft = payments.map(p => {
      const timeLeft = p.dueAt ? Math.max(0, new Date(p.dueAt) - Date.now()) : null;
      return {
        ...p.toObject(),
        timeLeftMs: timeLeft,
        timeLeftHours: timeLeft ? Math.floor(timeLeft / (1000 * 60 * 60)) : null,
        isOverdue: timeLeft !== null && timeLeft <= 0
      };
    });

    res.json({ success: true, payments: paymentsWithTimeLeft });
  } catch (error) {
    console.error('❌ Error fetching payments:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת', error: error.message });
  }
});

// יצירת Payment Intent (Stripe)
router.post('/create-payment-intent/:paymentId', authMiddleware, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'מערכת התשלומים לא מוגדרת' });
    }

    console.log('💳 Creating payment intent for:', req.params.paymentId);
    
    const payment = await Payment.findById(req.params.paymentId)
      .populate('adId', 'businessName title');

    if (!payment) {
      return res.status(404).json({ success: false, message: 'תשלום לא נמצא' });
    }

    // וידוא שזו החברה הנכונה
    if (payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה לתשלום זה' });
    }

    // וידוא שהתשלום עדיין ממתין
    if (payment.status !== 'pending') {
      return res.status(400).json({ 
        success: false, 
        message: `התשלום כבר ${payment.status === 'completed' ? 'בוצע' : 'בוטל'}` 
      });
    }

    // יצירת Payment Intent ב-Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount * 100), // Stripe עובד באגורות
      currency: 'ils',
      metadata: {
        paymentId: payment._id.toString(),
        companyId: req.user._id.toString(),
        adId: payment.adId?._id?.toString() || ''
      },
      description: `תשלום עבור פרסומת - ${payment.adId?.title || payment._id}`,
      receipt_email: req.user.email
    });

    console.log('✅ Payment intent created:', paymentIntent.id);

    // שמירת ה-Intent ID
    payment.stripePaymentIntentId = paymentIntent.id;
    await payment.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: payment.amount
    });

  } catch (error) {
    console.error('❌ Error creating payment intent:', error);
    res.status(500).json({ success: false, message: 'שגיאה ביצירת התשלום', error: error.message });
  }
});

// אישור תשלום (לאחר הצלחת Stripe בצד הלקוח)
router.post('/confirm/:paymentId', authMiddleware, async (req, res) => {
  try {
    if (!stripe) {
      return res.status(500).json({ success: false, message: 'מערכת התשלומים לא מוגדרת' });
    }

    const { paymentIntentId } = req.body;
    console.log('💳 Confirming payment:', req.params.paymentId, 'intent:', paymentIntentId);
    
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'תשלום לא נמצא' });
    }

    if (payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה' });
    }

    // אימות מול Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('💳 Stripe intent status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      payment.status = 'completed';
      payment.paidAt = new Date();
      await payment.save();

      // עדכון הפרסומת
      await PendingAd.findByIdAndUpdate(payment.adId, {
        paymentStatus: 'paid'
      });

      console.log('✅ Payment confirmed:', payment._id);
      return res.json({ success: true, message: 'התשלום אושר!' });
    }

    res.status(400).json({ 
      success: false, 
      message: 'התשלום לא הושלם',
      status: paymentIntent.status 
    });

  } catch (error) {
    console.error('❌ Error confirming payment:', error);
    res.status(500).json({ success: false, message: 'שגיאה באישור התשלום', error: error.message });
  }
});

// היסטוריית תשלומים
router.get('/history', authMiddleware, async (req, res) => {
  try {
    const query = req.user.userType === 'company' 
      ? { companyId: req.user._id }
      : { agentId: req.user._id };

    const payments = await Payment.find(query)
      .populate('adId', 'businessName title')
      .populate('agentId', 'fullName')
      .populate('companyId', 'companyName fullName')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, payments });
  } catch (error) {
    console.error('Error fetching payment history:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

// ביטול תשלום (רק סוכן, אם לא שולם)
router.delete('/cancel/:paymentId', authMiddleware, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'לא נמצא' });
    }

    // רק הסוכן יכול לבטל
    if (payment.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה' });
    }

    // רק אם עדיין לא שולם
    if (payment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'התשלום כבר בוצע, לא ניתן לבטל' });
    }

    // ביטול ב-Stripe אם יש
    if (stripe && payment.stripePaymentIntentId) {
      try {
        await stripe.paymentIntents.cancel(payment.stripePaymentIntentId);
      } catch (e) {
        console.log('Could not cancel Stripe intent:', e.message);
      }
    }

    payment.status = 'cancelled';
    payment.cancelledAt = new Date();
    await payment.save();

    // עדכון הפרסומת
    await PendingAd.findByIdAndUpdate(payment.adId, {
      paymentStatus: 'cancelled',
      isShared: false
    });

    res.json({ success: true, message: 'התשלום בוטל בהצלחה' });

  } catch (error) {
    console.error('Error cancelling payment:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

module.exports = router;