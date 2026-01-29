/**
 * @fileoverview Payment routes module for handling payment-related operations.
 * This module provides endpoints for managing payments, including creating payment intents,
 * confirming payments, fetching payment history, and canceling payments using Stripe integration.
 * All routes require authentication and are designed for company and agent users.
 *
 * @module routes/payments
 */

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

/**
 * GET /pending - Retrieve pending payments for the authenticated company.
 * This endpoint fetches all pending payments associated with the logged-in company user.
 * It populates related ad and agent information, calculates remaining time until due date,
 * and marks overdue payments. Only accessible to company users.
 *
 * @route GET /pending
 * @middleware authMiddleware - Requires authentication
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status and array of pending payments
 * @returns {Object[]} payments - Array of payment objects with time calculations
 * @returns {number} payments[].timeLeftMs - Milliseconds remaining until due date (null if no due date)
 * @returns {number} payments[].timeLeftHours - Hours remaining until due date (null if no due date)
 * @returns {boolean} payments[].isOverdue - True if payment is past due date
 * @throws {403} Forbidden - If user is not a company
 * @throws {500} Internal Server Error - If database query fails
 */
router.get('/pending', authMiddleware, async (req, res) => {
  try {
    console.log('💳 Fetching pending payments for user:', req.user._id, 'type:', req.user.userType);

    // Ensure user is a company
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

    // Calculate remaining time
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

// Create Payment Intent (Stripe)
/**
 * POST /create-payment-intent/:paymentId - Create a Stripe payment intent for a specific payment.
 * This endpoint creates a payment intent using Stripe for the specified payment ID.
 * It ensures the payment belongs to the authenticated company, is still pending, and creates
 * the intent with the correct amount in ILS. The client secret is returned for frontend processing.
 *
 * @route POST /create-payment-intent/:paymentId
 * @middleware authMiddleware - Requires authentication
 * @param {string} paymentId - The ID of the payment to create intent for (URL parameter)
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status, client secret, and amount
 * @returns {string} clientSecret - Stripe client secret for payment processing
 * @returns {number} amount - Payment amount in ILS
 * @throws {500} Internal Server Error - If Stripe is not configured
 * @throws {404} Not Found - If payment does not exist
 * @throws {403} Forbidden - If user is not authorized for this payment
 * @throws {400} Bad Request - If payment is not pending
 */
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

    // Ensure it's the correct company
    if (payment.companyId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה לתשלום זה' });
    }

    // Ensure payment is still pending
    if (payment.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: `התשלום כבר ${payment.status === 'completed' ? 'בוצע' : 'בוטל'}`
      });
    }

    // Create Payment Intent in Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(payment.amount * 100), // Stripe works in agorot
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

    // Save the Intent ID
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

/**
 * POST /confirm/:paymentId - Confirm a payment after successful Stripe processing on the client side.
 * This endpoint verifies the payment with Stripe, updates the payment status to completed,
 * and marks the associated ad as paid. It ensures the payment belongs to the authenticated company.
 *
 * @route POST /confirm/:paymentId
 * @middleware authMiddleware - Requires authentication
 * @param {string} paymentId - The ID of the payment to confirm (URL parameter)
 * @param {Object} req.body - Request body containing payment intent ID
 * @param {string} req.body.paymentIntentId - Stripe payment intent ID from client
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status and message
 * @throws {500} Internal Server Error - If Stripe is not configured
 * @throws {404} Not Found - If payment does not exist
 * @throws {403} Forbidden - If user is not authorized for this payment
 * @throws {400} Bad Request - If payment intent has not succeeded
 */
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

    // Verify with Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    console.log('💳 Stripe intent status:', paymentIntent.status);

    if (paymentIntent.status === 'succeeded') {
      payment.status = 'completed';
      payment.paidAt = new Date();
      await payment.save();

      // Update the ad
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

/**
 * GET /history - Retrieve payment history for the authenticated user.
 * This endpoint fetches all payments associated with the logged-in user (company or agent).
 * It populates related ad, agent, and company information, sorts by creation date descending,
 * and limits results to the last 50 payments for performance.
 *
 * @route GET /history
 * @middleware authMiddleware - Requires authentication
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status and array of payments
 * @returns {Object[]} payments - Array of payment objects with populated relations
 * @throws {500} Internal Server Error - If database query fails
 */
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

/**
 * DELETE /cancel/:paymentId - Cancel a payment (agents only, if not yet paid).
 * This endpoint allows agents to cancel payments that have not been completed yet.
 * It cancels the payment in Stripe if a payment intent exists, updates the payment status to cancelled,
 * and marks the associated ad as cancelled and unshared. Only the agent who created the payment can cancel it.
 *
 * @route DELETE /cancel/:paymentId
 * @middleware authMiddleware - Requires authentication
 * @param {string} paymentId - The ID of the payment to cancel (URL parameter)
 * @param {Object} req - Express request object containing authenticated user
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with success status and message
 * @throws {404} Not Found - If payment does not exist
 * @throws {403} Forbidden - If user is not the agent who created the payment
 * @throws {400} Bad Request - If payment is already completed
 * @throws {500} Internal Server Error - If database update fails
 */
router.delete('/cancel/:paymentId', authMiddleware, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.paymentId);

    if (!payment) {
      return res.status(404).json({ success: false, message: 'לא נמצא' });
    }

    // Role check: Only the agent who created the request can cancel it
    if (payment.agentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'אין הרשאה' });
    }

    // Integrity check: Prevent cancellation of already paid invoices
    if (payment.status === 'completed') {
      return res.status(400).json({ success: false, message: 'התשלום כבר בוצע, לא ניתן לבטל' });
    }

    // Attempt to cancel Stripe intent if it was already created
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

    // Revert ad status to unshared/cancelled
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