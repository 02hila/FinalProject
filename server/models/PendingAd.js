// models/PendingAd.js - UPDATED WITH REJECTION & IMPROVEMENT FEATURES

const mongoose = require('mongoose');

const pendingAdSchema = new mongoose.Schema({
  // 🆔 Unique short identifier for the ad (6 chars: A3F2B9)
  uniqueId: {
    type: String,
    unique: true,
    sparse: true,
    index: true
  },
  
  title: {
    type: String,
    required: true
  },
  
  text: {
    type: String,
    required: true
  },
  
  callToAction: {
    type: String,
    default: ''
  },
  
  imageData: {
    type: String, // base64 encoded image
    required: true
  },
  
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'improving'], // ✨ הוספנו 'improving'
    default: 'pending',
    index: true
  },
  
  qrCode: {
    enabled: { type: Boolean, default: false },
    uniqueId: { type: String },
    imageData: { type: String },
    shortUrl: { type: String },
    targetUrl: { type: String },
    scans: { type: Number, default: 0 }
  },
  
  websiteUrl: {
    type: String,
    default: ''
  },
  
  metadata: {
    businessName: String,
    productService: String,
    targetAudience: String,
    keyMessage: String,
    tone: String,
    adStyle: String,
    imageKeyword: String,
    imageStyle: String,
    adUniqueId: String
  },
  
  // ✨ NEW: Rejection & Improvement tracking
  currentRejection: {
    reason: { type: String, default: '' },
    details: { type: String, default: '' },
    rejectedAt: { type: Date },
    rejectedBy: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  
  // ✨ NEW: History of all rejections and improvements
  improvementHistory: [{
    version: { type: Number, required: true }, // גרסה 1, 2, 3...
    action: { 
      type: String, 
      enum: ['rejected', 'improved', 'approved'],
      required: true 
    },
    
    // נתונים של הדחייה
    rejectionReason: { type: String },
    rejectionDetails: { type: String },
    
    // נתונים של הפרסומת באותה נקודה
    adSnapshot: {
      title: String,
      text: String,
      callToAction: String,
      imageData: String
    },
    
    // מי ביצע ומתי
    performedBy: { 
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    performedAt: { 
      type: Date, 
      default: Date.now 
    },
    
    // הערות נוספות
    notes: { type: String }
  }],
  
  // ✨ NEW: AI Improvement status
  aiImprovement: {
    isProcessing: { type: Boolean, default: false },
    lastAttempt: { type: Date },
    attempts: { type: Number, default: 0 },
    error: { type: String }
  },
  
  // מספר פעמים שהפרסומת נדחתה
  rejectionCount: {
    type: Number,
    default: 0
  },
  
  // ✨ NEW: Email notification tracking
  notifications: {
    emailSent: { type: Boolean, default: false },
    lastEmailSent: { type: Date },
    emailError: { type: String }
  },
  
  // שדה ישן - נשאיר לתאימות אחורה
  rejectionReason: {
    type: String,
    default: ''
  },
  
  // שדות זמן
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Indexes for efficient queries
pendingAdSchema.index({ campaignId: 1, status: 1 });
pendingAdSchema.index({ agentId: 1, createdAt: -1 });
pendingAdSchema.index({ uniqueId: 1 });
pendingAdSchema.index({ status: 1, createdAt: -1 });

// ✨ Method: Add rejection to history
pendingAdSchema.methods.addRejection = function(rejectionData) {
  const version = this.improvementHistory.length + 1;
  
  this.improvementHistory.push({
    version,
    action: 'rejected',
    rejectionReason: rejectionData.reason,
    rejectionDetails: rejectionData.details,
    adSnapshot: {
      title: this.title,
      text: this.text,
      callToAction: this.callToAction,
      imageData: this.imageData
    },
    performedBy: rejectionData.rejectedBy,
    performedAt: new Date(),
    notes: rejectionData.notes || ''
  });
  
  this.currentRejection = {
    reason: rejectionData.reason,
    details: rejectionData.details,
    rejectedAt: new Date(),
    rejectedBy: rejectionData.rejectedBy
  };
  
  this.rejectionCount += 1;
  this.status = 'rejected';
};

// ✨ Method: Add improvement to history
pendingAdSchema.methods.addImprovement = function(improvedAdData) {
  const version = this.improvementHistory.length + 1;
  
  this.improvementHistory.push({
    version,
    action: 'improved',
    adSnapshot: {
      title: improvedAdData.title,
      text: improvedAdData.text,
      callToAction: improvedAdData.callToAction,
      imageData: improvedAdData.imageData
    },
    performedAt: new Date(),
    notes: 'AI-generated improvement based on company feedback'
  });
  
  // עדכון הפרסומת עצמה
  this.title = improvedAdData.title;
  this.text = improvedAdData.text;
  this.callToAction = improvedAdData.callToAction;
  this.imageData = improvedAdData.imageData;
  
  // שינוי סטטוס חזרה ל-pending
  this.status = 'pending';
};

module.exports = mongoose.model('PendingAd', pendingAdSchema);