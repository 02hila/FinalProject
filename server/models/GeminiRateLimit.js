// server/models/GeminiRateLimit.js
// Tracks global daily limits for Gemini API usage (ad generation)

const mongoose = require('mongoose');

const geminiRateLimitSchema = new mongoose.Schema({
  // Use a single document to track global limits
  key: {
    type: String,
    default: 'global',
    unique: true,
    required: true
  },

  // Current date for daily reset (stored as YYYY-MM-DD string)
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

  // History of generations (for debugging/analytics)
  generations: [{
    timestamp: Date,
    source: String,  // 'manual', 'improvement', 'unshared', 'low_performance'
    adId: String
  }]
}, {
  timestamps: true
});

// Index for efficient lookup
geminiRateLimitSchema.index({ key: 1 });

module.exports = mongoose.model('GeminiRateLimit', geminiRateLimitSchema);
