// models/Quote.js

const mongoose = require('mongoose');

const quoteSchema = new mongoose.Schema({
  agentId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  companyId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true,
    index: true 
  },
  adId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Ad' 
  },
  campaignId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Campaign' 
  },
  
  // פרטי הצעת המחיר
  amount: { 
    type: Number, 
    required: true 
  },
  description: String,
  services: [String], // רשימת שירותים
  
  // סטטוס
  status: { 
    type: String, 
    enum: ['pending', 'approved', 'rejected', 'expired'],
    default: 'pending',
    index: true
  },
  
  // תאריכים
  expiresAt: { type: Date },
  approvedAt: { type: Date },
  rejectedAt: { type: Date },
  
  // סיבת דחייה
  rejectionReason: String

}, { timestamps: true });

module.exports = mongoose.model('Quote', quoteSchema);