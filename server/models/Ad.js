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
// הוסף לסכמה הקיימת של Ad
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