// models/PendingAd.js - UPDATED WITH uniqueId FIELD

const mongoose = require('mongoose');

const pendingAdSchema = new mongoose.Schema({
  // 🆔 Unique short identifier for the ad (6 chars: A3F2B9)
  uniqueId: {
    type: String,
    unique: true,
    sparse: true, // allows existing docs without this field
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
    enum: ['pending', 'approved', 'rejected'],
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
    adUniqueId: String // 🆔 Duplicate for easy metadata access
  },
  
  rejectionReason: {
    type: String,
    default: ''
  },
  
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

// Index for efficient queries
pendingAdSchema.index({ campaignId: 1, status: 1 });
pendingAdSchema.index({ agentId: 1, createdAt: -1 });
pendingAdSchema.index({ uniqueId: 1 }); // 🆔 Index for uniqueId searches

module.exports = mongoose.model('PendingAd', pendingAdSchema);