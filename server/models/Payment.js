/**
 * @file Payment.js
 * @description Mongoose model for payment records between companies and agents.
 *   A payment is created when a company owes an agent for approved ad work, optionally
 *   linked to a Quote. The model tracks the full payment lifecycle from pending through
 *   completion or cancellation, including reminder history.
 *
 * Key fields:
 *   - amount          -- the monetary value owed
 *   - status          -- lifecycle: pending -> processing -> completed | failed | cancelled
 *   - paymentMethod   -- embedded sub-document with card/payment provider details
 *   - remindersSent   -- log of payment reminders dispatched to the company
 *   - dueAt / paidAt  -- key date milestones for the payment
 *
 * Relationships:
 *   - adId      -> Ad model (the ad this payment is for)
 *   - companyId -> User model (the company making the payment)
 *   - agentId   -> User model (the agent receiving the payment)
 *   - quoteId   -> Quote model (the agreed-upon price quote, if applicable)
 */
const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Ad',
    required: true,
    index: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  quoteId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Quote'
  },

  amount: {
    type: Number,
    required: true
  },

  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },

  paymentMethod: {
    type: { type: String, enum: ['credit_card', 'paypal', 'bit', 'bank_transfer'] },
    last4: String,
    cardBrand: String,
    token: String
  },

  dueAt: { type: Date },
  paidAt: { type: Date },
  cancelledAt: { type: Date },

  remindersSent: [{
    sentAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['email', 'sms', 'push', 'in_app'] },
    success: { type: Boolean, default: true }
  }],

  agentNotifiedAt: { type: Date },
  notes: String

}, { timestamps: true });

// Compound index for querying overdue or upcoming payments by status and due date
paymentSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);
