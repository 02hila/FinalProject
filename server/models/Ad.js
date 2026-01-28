/**
 * @file Ad.js
 * @description Mongoose model for finalized advertisements. This schema extends the base Quote
 *   fields with ad-sharing and payment-tracking capabilities. Once a quote is approved and an
 *   ad is created, this model tracks whether the ad has been shared, its payment status, and
 *   relevant timestamps.
 *
 * Note: The schema reuses the Quote model name at export time via `mongoose.models.Quote`,
 *   meaning this file effectively extends or aliases the Quote collection. This design allows
 *   ad-specific fields (isShared, paymentStatus, etc.) to coexist alongside quote data.
 *
 * Key fields:
 *   - amount         -- the agreed price for the ad work
 *   - status         -- pending | approved | rejected (inherited from quote workflow)
 *   - isShared       -- whether the agent has distributed the ad on social platforms
 *   - paymentStatus  -- tracks the payment lifecycle: not_required -> pending -> paid | failed | cancelled | overdue
 *   - quoteId        -- back-reference to the originating Quote document
 *
 * Relationships:
 *   - agentId   -> User model (the agent who created the ad)
 *   - companyId -> User model (the company that commissioned the ad)
 *   - adId      -> Ad model (self-reference or linked ad)
 *   - quoteId   -> Quote model
 *   - Referenced by Payment.adId for payment processing.
 */
const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  adId: { type: mongoose.Schema.Types.ObjectId, ref: 'Ad' },

  amount: { type: Number, required: true },
  description: String,

  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },

  approvedAt: { type: Date },
  rejectedAt: { type: Date },

  createdAt: { type: Date, default: Date.now },

  // Ad-specific extensions beyond the base quote fields
  quoteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Quote' },
  isShared: { type: Boolean, default: false },
  sharedAt: { type: Date },
  paymentStatus: {
    type: String,
    enum: ['not_required', 'pending', 'paid', 'failed', 'cancelled', 'overdue'],
    default: 'not_required'
  },
  paymentRequestedAt: { type: Date },
  paymentDueAt: { type: Date }
});

module.exports = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);
