// routes/payments.js

const express = require('express');
const router = express.Router();
const stripe = require('../config/stripe');
const Payment = require('../models/Payment');
const Ad = require('../models/Ad');
const Quote = require('../models/Quote');
const auth = require('../middleware/auth');
const rateLimit = require('express-rate-limit');

// 🔒 הגבלת קצב לנתיב תשלומים
const paymentLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 דקות
  max: 10, // מקסימום 10 ניסיונות
  message: { success: false, message: 'יותר מדי ניסיונות, נסה שוב מאוחר יותר' }
});

// קבלת תשלומים ממתינים של החברה
router.get('/pending', auth, async (req, res) => {
  try {
    // וידוא שזו חברה
    if (req.user.role !== 'company') {
      return res.status(403).json({ success: false, message: 'גישה לחברות בלבד' });
    }

    const payments = await Payment.find({
      companyId: req.user._id,
      status: 'pending'
    })
    .populate('adId', 'businessName generatedText imageData')
    .populate('agentId', 'name email')
    .sort({ createdAt: -1 });

    // חישוב זמן שנותר
    const paymentsWithTimeLeft = payments.map(p => {
      const timeLeft = p.dueAt ? Math.max(0, p.dueAt - Date.now()) : null;
      return {
        ...p.toObject(),
        timeLeftMs: timeLeft,
        timeLeftHours: timeLeft ? Math.floor(timeLeft / (1000 * 60 * 60)) : null,
        isOverdue: timeLeft !== null && timeLeft <= 0
      };
    });

    res.json({ success: true, payments: paymentsWithTimeLeft });
  } catch (error) {
    console.error('Error fetching payments:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

// 🔒 יצירת Payment Intent (Stripe)
router.post('/create-payment-intent/:paymentId', auth, paymentLimiter, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);

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
        adId: payment.adId?.toString()
      },
      description: `תשלום עבור פרסומת - ${payment._id}`,
      receipt_email: req.user.email
    });

    // שמירת ה-Intent ID
    payment.stripePaymentIntentId = paymentIntent.id;
    payment.status = 'processing';
    await payment.save();

    res.json({
      success: true,
      clientSecret: paymentIntent.client_secret,
      amount: payment.amount
    });

  } catch (error) {
    console.error('Error creating payment intent:', error);
    res.status(500).json({ success: false, message: 'שגיאה ביצירת התשלום' });
  }
});

// 🔒 Webhook מ-Stripe (אישור תשלום)
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // טיפול באירועים
  switch (event.type) {
    case 'payment_intent.succeeded':
      await handlePaymentSuccess(event.data.object);
      break;

    case 'payment_intent.payment_failed':
      await handlePaymentFailure(event.data.object);
      break;

    default:
      console.log(`Unhandled event type: ${event.type}`);
  }

  res.json({ received: true });
});

// פונקציית טיפול בתשלום מוצלח
async function handlePaymentSuccess(paymentIntent) {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id
    });

    if (!payment) {
      console.error('Payment not found for intent:', paymentIntent.id);
      return;
    }

    payment.status = 'completed';
    payment.paidAt = new Date();
    payment.paymentMethod = {
      type: 'credit_card',
      last4: paymentIntent.payment_method_types?.[0] || 'card'
    };
    await payment.save();

    // עדכון הפרסומת
    await Ad.findByIdAndUpdate(payment.adId, {
      paymentStatus: 'paid'
    });

    console.log('✅ Payment completed:', payment._id);

    // TODO: שליחת קבלה במייל
    // await sendReceiptEmail(payment);

  } catch (error) {
    console.error('Error handling payment success:', error);
  }
}

// פונקציית טיפול בתשלום שנכשל
async function handlePaymentFailure(paymentIntent) {
  try {
    const payment = await Payment.findOne({
      stripePaymentIntentId: paymentIntent.id
    });

    if (!payment) return;

    payment.status = 'failed';
    payment.failedAt = new Date();
    payment.failureReason = paymentIntent.last_payment_error?.message;
    await payment.save();

    console.log('❌ Payment failed:', payment._id);

  } catch (error) {
    console.error('Error handling payment failure:', error);
  }
}

// אישור תשלום ידני (fallback אם Webhook לא עובד)
router.post('/confirm/:paymentId', auth, async (req, res) => {
  try {
    const { paymentIntentId } = req.body;
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'תשלום לא נמצא' });
    }

    if (payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה' });
    }

    // אימות מול Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status === 'succeeded') {
      payment.status = 'completed';
      payment.paidAt = new Date();
      await payment.save();

      await Ad.findByIdAndUpdate(payment.adId, {
        paymentStatus: 'paid'
      });

      return res.json({ success: true, message: 'התשלום אושר!' });
    }

    res.status(400).json({ 
      success: false, 
      message: 'התשלום לא הושלם',
      status: paymentIntent.status 
    });

  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({ success: false, message: 'שגיאה באישור התשלום' });
  }
});

// סוכן מבטל פרסומת (אם לא שולם)
router.delete('/cancel-ad/:paymentId', auth, async (req, res) => {
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
    if (payment.stripePaymentIntentId) {
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
    await Ad.findByIdAndUpdate(payment.adId, {
      paymentStatus: 'cancelled',
      isShared: false
    });

    res.json({ success: true, message: 'הפרסומת בוטלה בהצלחה' });

  } catch (error) {
    console.error('Error cancelling:', error);
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

// היסטוריית תשלומים
router.get('/history', auth, async (req, res) => {
  try {
    const query = req.user.role === 'company' 
      ? { companyId: req.user._id }
      : { agentId: req.user._id };

    const payments = await Payment.find(query)
      .populate('adId', 'businessName')
      .populate('agentId', 'name')
      .populate('companyId', 'name')
      .sort({ createdAt: -1 })
      .limit(50);

    res.json({ success: true, payments });
  } catch (error) {
    res.status(500).json({ success: false, message: 'שגיאת שרת' });
  }
});

module.exports = router;