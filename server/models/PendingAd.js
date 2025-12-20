// server/models/PendingAd.js - WITH SHARE TRACKING
const mongoose = require('mongoose');

const pendingAdSchema = new mongoose.Schema({
  uniqueId: { type: String, index: true },
  title: String,
  text: String,
  callToAction: String,
  imageData: String,
  companyId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  status: { type: String, default: 'pending', enum: ['pending', 'approved', 'rejected'] },
  rejectionReason: String,
  companyFeedback: {
    rating: Number,
    comment: String,
    feedbackDate: Date
  },
  qrCode: {
    enabled: Boolean,
    uniqueId: String,
    imageData: String,
    shortUrl: String,
    targetUrl: String,
    scans: { type: Number, default: 0 }
  },
  websiteUrl: String,
  metadata: mongoose.Schema.Types.Mixed,
  
  // ✅ NEW: Share tracking
  shareTracking: {
    approvedAt: Date,              // מתי אושרה הפרסומת
    firstSharedAt: Date,           // מתי שותפה לראשונה
    shareCount: { type: Number, default: 0 },  // כמה פעמים שותפה
    sharePlatforms: [String],      // לאיפה שותפה (facebook, whatsapp, etc)
    reminderSent: { type: Boolean, default: false },  // האם נשלחה תזכורת
    reminderSentAt: Date,          // מתי נשלחה התזכורת
    alternativeCreated: { type: Boolean, default: false },  // האם נוצרה חלופית
    alternativeAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingAd' }  // קישור לפרסומת החלופית
  },
  
  // ✅ NEW: Is this an alternative ad?
  isAlternative: { type: Boolean, default: false },
  originalAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingAd' },  // קישור לפרסומת המקורית
  
  // For improvement history
  improvementHistory: [{
    version: Number,
    title: String,
    text: String,
    imageData: String,
    rejectedAt: Date,
    rejectionReasons: [String],
    rejectionDetails: String
  }],
  
  currentRejection: {
    reason: String,
    details: String,
    rejectedBy: mongoose.Schema.Types.ObjectId,
    rejectedAt: Date,
    notes: String
  }
}, { 
  timestamps: true 
});

// ✅ Method: addRejection
pendingAdSchema.methods.addRejection = function(rejectionData) {
  this.currentRejection = {
    reason: rejectionData.reason,
    details: rejectionData.details,
    rejectedBy: rejectionData.rejectedBy,
    rejectedAt: new Date(),
    notes: rejectionData.notes || ''
  };
  
  this.status = 'rejected';
  
  // Add to history
  if (!this.improvementHistory) {
    this.improvementHistory = [];
  }
  
  this.improvementHistory.push({
    version: this.improvementHistory.length + 1,
    title: this.title,
    text: this.text,
    imageData: this.imageData,
    rejectedAt: new Date(),
    rejectionReasons: rejectionData.reason ? rejectionData.reason.split(', ') : [],
    rejectionDetails: rejectionData.details
  });
};

// ✅ Method: addImprovement
pendingAdSchema.methods.addImprovement = function(improvementData) {
  if (improvementData.title) this.title = improvementData.title;
  if (improvementData.text) this.text = improvementData.text;
  if (improvementData.callToAction) this.callToAction = improvementData.callToAction;
  if (improvementData.imageData) this.imageData = improvementData.imageData;
  
  this.status = 'pending';
  this.currentRejection = undefined;
};

// ✅ NEW Method: Record share
pendingAdSchema.methods.recordShare = function(platform) {
  if (!this.shareTracking) {
    this.shareTracking = {};
  }
  
  // First share
  if (!this.shareTracking.firstSharedAt) {
    this.shareTracking.firstSharedAt = new Date();
  }
  
  // Increment count
  this.shareTracking.shareCount = (this.shareTracking.shareCount || 0) + 1;
  
  // Track platform
  if (!this.shareTracking.sharePlatforms) {
    this.shareTracking.sharePlatforms = [];
  }
  if (platform && !this.shareTracking.sharePlatforms.includes(platform)) {
    this.shareTracking.sharePlatforms.push(platform);
  }
};

// ✅ NEW Method: Mark approved (called when company approves)
pendingAdSchema.methods.markApproved = function() {
  this.status = 'approved';
  if (!this.shareTracking) {
    this.shareTracking = {};
  }
  this.shareTracking.approvedAt = new Date();
};

// ✅ CRITICAL: Export the model correctly!
module.exports = mongoose.model('PendingAd', pendingAdSchema);