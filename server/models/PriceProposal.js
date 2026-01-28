/**
 * @file PriceProposal.js
 * @description Mongoose model for budget negotiation proposals. An agent can propose a different
 *   budget for a campaign when the original budget does not meet their expectations. The company
 *   then approves or rejects the proposal, optionally attaching a response message.
 *
 * Key fields:
 *   - originalBudget  -- the campaign's budget at the time of the proposal
 *   - proposedBudget  -- the agent's counter-offer amount
 *   - status          -- pending | approved | rejected
 *   - companyResponse -- embedded object with the company's reply message and timestamp
 *
 * Relationships:
 *   - campaignId -> Campaign model
 *   - agentId    -> User model (the agent proposing the new price)
 *   - companyId  -> User model (the company that owns the campaign)
 */
const mongoose = require('mongoose');

const priceProposalSchema = new mongoose.Schema({
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  originalBudget: {
    type: Number,
    required: true
  },
  proposedBudget: {
    type: Number,
    required: true
  },
  message: {
    type: String,
    default: ''
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  companyResponse: {
    message: String,
    responseDate: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('PriceProposal', priceProposalSchema);
