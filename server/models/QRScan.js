// models/QRScan.js - UPDATED WITH metadata FIELD

const mongoose = require('mongoose');

const qrScanSchema = new mongoose.Schema({
  // QR's own unique ID (for the short URL)
  uniqueId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // 🆔 Link to the ad's unique ID (6 chars: A3F2B9)
  adUniqueId: {
    type: String,
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
  
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Company',
    required: true,
    index: true
  },
  
  fullUrl: {
    type: String,
    required: true
  },
  
  targetUrl: {
    type: String,
    required: true
  },
  
  qrImageData: {
    type: String // base64 QR image
  },
  
  scans: {
    type: Number,
    default: 0
  },
  
  lastScannedAt: {
    type: Date
  },
  
  scanHistory: [{
    timestamp: { type: Date, default: Date.now },
    ipAddress: String,
    userAgent: String,
    referrer: String
  }],
  
  // ✅ הוספת metadata
  metadata: {
    type: Object,
    default: {}
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Compound indexes for efficient queries
qrScanSchema.index({ campaignId: 1, scans: -1 });
qrScanSchema.index({ agentId: 1, lastScannedAt: -1 });
qrScanSchema.index({ adUniqueId: 1 }); // 🆔 Index for ad-based queries

// Method to increment scans
qrScanSchema.methods.incrementScans = async function() {
  this.scans += 1;
  this.lastScannedAt = new Date();
  await this.save();
};

module.exports = mongoose.model('QRScan', qrScanSchema);