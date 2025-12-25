// models/Payment.js

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

paymentSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.models.Payment || mongoose.model('Payment', paymentSchema);