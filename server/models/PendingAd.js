/**
 * @file PendingAd.js
 * @description Mongoose model for advertisements that are awaiting company review.
 *   When an agent creates an ad for a campaign, it starts here with status "pending".
 *   Companies can approve or reject the ad. Rejected ads may be improved and resubmitted.
 *
 * Key fields:
 *   - uniqueId          -- application-level unique identifier (separate from _id)
 *   - status             -- lifecycle state: pending -> approved | rejected
 *   - shareTracking      -- tracks when and where an approved ad has been shared on social platforms
 *   - improvementHistory -- versioned history of each rejection cycle for iterative feedback
 *   - currentRejection   -- the latest rejection details (cleared when the agent submits an improvement)
 *
 * Relationships:
 *   - companyId, agentId  -> User model
 *   - campaignId          -> Campaign model
 *   - originalAdId / alternativeAdId -> self-referencing PendingAd (for alternative ad chains)
 */
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

  // Share tracking -- monitors distribution of approved ads across social platforms
  shareTracking: {
    approvedAt: Date,
    firstSharedAt: Date,
    shareCount: { type: Number, default: 0 },
    sharePlatforms: [String],
    reminderSent: { type: Boolean, default: false },
    reminderSentAt: Date,
    alternativeCreated: { type: Boolean, default: false },
    alternativeAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingAd' }
  },

  // Flags for alternative-ad relationships
  isAlternative: { type: Boolean, default: false },
  originalAdId: { type: mongoose.Schema.Types.ObjectId, ref: 'PendingAd' },

  // Versioned improvement history -- each entry captures the ad state at the time of rejection
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

/**
 * Records a rejection, sets the ad status to "rejected", and appends the current
 * ad content to the improvement history so the agent can reference it when revising.
 * @param {Object} rejectionData - Rejection details from the company reviewer.
 * @param {string} rejectionData.reason - Comma-separated rejection reason(s).
 * @param {string} rejectionData.details - Free-text explanation.
 * @param {mongoose.Types.ObjectId} rejectionData.rejectedBy - The reviewing user's ID.
 * @param {string} [rejectionData.notes] - Optional internal notes.
 */
pendingAdSchema.methods.addRejection = function(rejectionData) {
  this.currentRejection = {
    reason: rejectionData.reason,
    details: rejectionData.details,
    rejectedBy: rejectionData.rejectedBy,
    rejectedAt: new Date(),
    notes: rejectionData.notes || ''
  };

  this.status = 'rejected';

  if (!this.improvementHistory) {
    this.improvementHistory = [];
  }

  // Snapshot the current ad content before the agent overwrites it with an improvement
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

/**
 * Applies an improvement submitted by the agent after a rejection.
 * Updates the ad's content fields with the new values and resets the status to "pending".
 * @param {Object} improvementData - Updated ad content.
 * @param {string} [improvementData.title] - New title.
 * @param {string} [improvementData.text] - New body text.
 * @param {string} [improvementData.callToAction] - New call-to-action text.
 * @param {string} [improvementData.imageData] - New image data (base64 or URL).
 */
pendingAdSchema.methods.addImprovement = function(improvementData) {
  if (improvementData.title) this.title = improvementData.title;
  if (improvementData.text) this.text = improvementData.text;
  if (improvementData.callToAction) this.callToAction = improvementData.callToAction;
  if (improvementData.imageData) this.imageData = improvementData.imageData;

  this.status = 'pending';
  this.currentRejection = undefined;
};

/**
 * Records that the ad was shared on a given platform. Tracks the first share timestamp,
 * increments the cumulative share count, and maintains a deduplicated list of platforms used.
 * @param {string} platform - The platform name (e.g. "facebook", "whatsapp", "instagram").
 */
pendingAdSchema.methods.recordShare = function(platform) {
  if (!this.shareTracking) {
    this.shareTracking = {};
  }

  // Record the very first share timestamp
  if (!this.shareTracking.firstSharedAt) {
    this.shareTracking.firstSharedAt = new Date();
  }

  this.shareTracking.shareCount = (this.shareTracking.shareCount || 0) + 1;

  // Add platform to the list only if it has not been recorded before
  if (!this.shareTracking.sharePlatforms) {
    this.shareTracking.sharePlatforms = [];
  }
  if (platform && !this.shareTracking.sharePlatforms.includes(platform)) {
    this.shareTracking.sharePlatforms.push(platform);
  }
};

/**
 * Marks the ad as approved and records the approval timestamp in shareTracking.
 * Typically called when a company reviewer approves the submission.
 */
pendingAdSchema.methods.markApproved = function() {
  this.status = 'approved';
  if (!this.shareTracking) {
    this.shareTracking = {};
  }
  this.shareTracking.approvedAt = new Date();
};

module.exports = mongoose.model('PendingAd', pendingAdSchema);
