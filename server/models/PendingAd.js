// server/models/PendingAd.js - MINIMAL WORKING VERSION
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

// ✅ CRITICAL: Export the model correctly!
module.exports = mongoose.model('PendingAd', pendingAdSchema);