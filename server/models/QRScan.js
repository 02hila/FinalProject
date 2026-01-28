/**
 * @file QRScan.js
 * @description Mongoose model for QR code scan tracking. Each document represents a unique
 *   QR code generated for an ad, along with its cumulative scan count and detailed scan history.
 *   QR codes redirect scanners from a short URL to the campaign's target URL while recording
 *   analytics metadata (IP, user agent, referrer).
 *
 * Key fields:
 *   - uniqueId     -- unique identifier for the QR code itself
 *   - adUniqueId   -- links back to the ad that owns this QR code
 *   - scans        -- total number of times the QR code has been scanned
 *   - scanHistory  -- detailed per-scan log with timestamp and client metadata
 *   - isDeleted    -- soft-delete flag set when the parent ad is removed
 *
 * Relationships:
 *   - campaignId -> Campaign model
 *   - agentId    -> User model (the agent who created the ad)
 *   - companyId  -> Company model
 *
 * Compound indexes optimize queries for leaderboard ranking (campaignId + scans)
 * and agent activity feeds (agentId + lastScannedAt).
 */
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

  // Soft-delete flag -- set when the parent ad is removed so scan data is preserved
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

// Compound indexes for common query patterns
qrScanSchema.index({ campaignId: 1, scans: -1 });
qrScanSchema.index({ agentId: 1, lastScannedAt: -1 });
qrScanSchema.index({ adUniqueId: 1 });

/**
 * Increments the scan counter by one, updates the lastScannedAt timestamp, and saves the document.
 * @returns {Promise<void>}
 */
qrScanSchema.methods.incrementScans = async function() {
  this.scans += 1;
  this.lastScannedAt = new Date();
  await this.save();
};

module.exports = mongoose.models.QRScan || mongoose.model('QRScan', qrScanSchema);
