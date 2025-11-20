// server/models/PendingAd.js
const mongoose = require('mongoose');

const pendingAdSchema = new mongoose.Schema({
  // פרטי הפרסומת
  title: {
    type: String,
    required: true
  },
  text: {
    type: String,
    required: true
  },
  imageData: {
    type: String, // Base64 או URL
    default: null
  },
  clicks: { type: Number, default: 0 },
  
  // ✅ קישור לאתר החברה
  websiteUrl: {
    type: String,
    default: ''
  },
  
  // קישור לקמפיין
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true
  },
  campaignName: {
    type: String,
    required: false
  },
  
  // פרטי הסוכן שיצר
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  agentName: {
    type: String,
    required: false
  },
  
  // פרטי החברה
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // פרטי הפרסום
  platform: {
    type: String,
    enum: ['Facebook', 'Instagram', 'Google Ads', 'TikTok', 'LinkedIn', 'Twitter', 'Multiple'],
    default: 'Facebook'
  },
  
  // סטטוס
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'revision_requested'],
    default: 'pending'
  },
  
  // משוב מהחברה
  companyFeedback: {
    // במקרה של אישור
    rating: {
      type: Number,
      min: 1,
      max: 5,
      default: null
    },
    comment: {
      type: String,
      default: null
    },
    
    // במקרה של דחייה
    rejectionReason: {
      type: String,
      enum: ['not_relevant', 'poor_quality', 'wrong_message', 'target_audience', 'brand_mismatch', 'other', null],
      default: null
    },
    rejectionDetails: {
      type: String,
      default: null
    },
    allowRevision: {
      type: Boolean,
      default: false
    },
    
    // מועד המשוב
    feedbackDate: {
      type: Date,
      default: null
    }
  },
  
  // מטא-דאטה נוספת
  metadata: {
    productService: String,
    targetAudience: String,
    keyMessage: String,
    tone: String
  }
}, {
  timestamps: true
});

// אינדקסים לחיפוש מהיר
pendingAdSchema.index({ companyId: 1, status: 1 });
pendingAdSchema.index({ agentId: 1, status: 1 });
pendingAdSchema.index({ campaignId: 1 });

module.exports = mongoose.models.PendingAd || mongoose.model('PendingAd', pendingAdSchema);