/**
 * @file Quote.js
 * @description Mongoose model for price quotes submitted by agents to companies for ad work.
 *   A quote represents a proposed cost for creating or managing an advertisement. Once approved,
 *   it may be linked to an Ad and trigger a Payment workflow.
 *
 * Key fields:
 *   - amount       -- the quoted monetary value
 *   - status       -- pending | approved | rejected
 *   - approvedAt / rejectedAt -- timestamps recording when the company decided
 *   - description  -- free-text explanation of what the quote covers
 *
 * Relationships:
 *   - agentId   -> User model (the agent submitting the quote)
 *   - companyId -> User model (the company receiving the quote)
 *   - adId      -> Ad model (the ad the quote pertains to, if applicable)
 *   - Referenced by Payment.quoteId when a payment is created from an approved quote.
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

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Quote || mongoose.model('Quote', quoteSchema);
