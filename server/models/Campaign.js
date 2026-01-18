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