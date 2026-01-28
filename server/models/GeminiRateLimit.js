/**
 * @file GeminiRateLimit.js
 * @description Mongoose model that enforces a global daily rate limit on Gemini API calls
 *   used for AI-powered ad generation. A single document (keyed by "global") tracks how many
 *   ads have been generated today and when the last generation occurred. The `currentDate`
 *   field (stored as a YYYY-MM-DD string) enables a simple daily reset mechanism -- when the
 *   date rolls over, the counter can be reset to zero.
 *
 * Key fields:
 *   - key              -- always "global"; ensures a single rate-limit document
 *   - currentDate      -- the date string for the current counting window
 *   - dailyCount       -- number of Gemini API calls made today
 *   - lastGenerationAt -- timestamp of the most recent API call
 *   - generations      -- audit log of each generation event (source, timestamp, adId)
 *
 * Relationships:
 *   - This model is standalone and does not reference other models directly.
 *     The `generations[].adId` is stored as a plain string rather than an ObjectId reference.
 */
const mongoose = require('mongoose');

const geminiRateLimitSchema = new mongoose.Schema({
  // Singleton key -- only one document exists with key="global"
  key: {
    type: String,
    default: 'global',
    unique: true,
    required: true
  },

  // Date string (YYYY-MM-DD) used to detect day rollover and reset the counter
  currentDate: {
    type: String,
    required: true
  },

  // Number of ads generated today
  dailyCount: {
    type: Number,
    default: 0
  },

  // Timestamp of last ad generation
  lastGenerationAt: {
    type: Date,
    default: null
  },

  // Audit log of generation events for debugging and analytics
  generations: [{
    timestamp: Date,
    source: String,  // e.g. 'manual', 'improvement', 'unshared', 'low_performance'
    adId: String
  }]
}, {
  timestamps: true
});

geminiRateLimitSchema.index({ key: 1 });

module.exports = mongoose.model('GeminiRateLimit', geminiRateLimitSchema);
