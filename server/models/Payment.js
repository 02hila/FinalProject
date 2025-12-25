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
  
  // פרטי תשלום
  paymentMethod: {
    type: { type: String, enum: ['credit_card', 'paypal', 'bit', 'bank_transfer'] },
    last4: String,
    cardBrand: String,
    token: String
  },
  
  // תאריכים
  dueAt: { type: Date },
  paidAt: { type: Date },
  cancelledAt: { type: Date },
  
  // תזכורות
  remindersSent: [{
    sentAt: { type: Date, default: Date.now },
    type: { type: String, enum: ['email', 'sms', 'push', 'in_app'] },
    success: { type: Boolean, default: true }
  }],
  
  // הודעה לסוכן (אם לא שולם)
  agentNotifiedAt: { type: Date },
  
  // הערות
  notes: String

}, { timestamps: true });

// Index לחיפוש תשלומים שעבר זמנם
paymentSchema.index({ status: 1, dueAt: 1 });

module.exports = mongoose.model('Payment', paymentSchema);