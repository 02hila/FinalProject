// models/QRScan.js

const mongoose = require('mongoose');

const qrScanSchema = new mongoose.Schema({
  uniqueId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
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
    type: String
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
  
  metadata: {
    type: Object,
    default: {}
  },

  // Flag to mark QRScans for deleted ads
  isDeleted: {
    type: Boolean,
    default: false,
    index: true
  },

  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

qrScanSchema.index({ campaignId: 1, scans: -1 });
qrScanSchema.index({ agentId: 1, lastScannedAt: -1 });
qrScanSchema.index({ adUniqueId: 1 });

qrScanSchema.methods.incrementScans = async function() {
  this.scans += 1;
  this.lastScannedAt = new Date();
  await this.save();
};

module.exports = mongoose.models.QRScan || mongoose.model('QRScan', qrScanSchema);