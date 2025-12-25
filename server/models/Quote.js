// models/Quote.js

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