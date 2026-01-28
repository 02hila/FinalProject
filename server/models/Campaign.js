/**
 * @file Campaign.js
 * @description Mongoose model for advertising campaigns created by companies.
 *   A campaign groups together a target audience, budget, and a set of assigned agents
 *   who will produce ads on behalf of the company.
 *
 * Key fields:
 *   - companyId       -- the User (type "company") who owns this campaign
 *   - assignedAgents  -- array of User references (type "agent") working on the campaign
 *   - status          -- lifecycle: draft -> active -> paused | completed
 *   - budget          -- total budget allocated to the campaign
 *   - impressions / clicks -- aggregated performance metrics
 *
 * Relationships:
 *   - companyId, assignedAgents -> User model
 *   - Referenced by PendingAd, Ad, QRScan, PriceProposal via their campaignId fields.
 */
const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  title: {
    type: String,
    required: true
  },
  description: {
    type: String,
    default: ''
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyName: {
    type: String,
    default: ''
  },
  targetAudience: {
    type: String,
    default: ''
  },
  websiteUrl: { type: String, default: '' },
  budget: {
    type: Number,
    default: 0
  },
  status: {
    type: String,
    enum: ['draft', 'active', 'paused', 'completed'],
    default: 'active'
  },
  assignedAgents: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  platform: {
    type: String,
    default: ''
  },
  impressions: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.models.Campaign || mongoose.model('Campaign', campaignSchema);
