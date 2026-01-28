/**
 * @file AgentRating.js
 * @description Mongoose model for ratings that companies give to agents.
 *   Each document represents a single rating event (1-5 stars plus an optional comment).
 *   The static helper `getAgentAverageRating` aggregates all ratings for a given agent.
 *
 * Key fields:
 *   - rating   -- numeric score from 1 to 5
 *   - comment  -- optional free-text feedback from the company
 *
 * Relationships:
 *   - agentId   -> User model (the agent being rated)
 *   - companyId -> User model (the company providing the rating)
 *   - The computed average is also cached on User.stats.averageRating / totalRatings.
 */
const mongoose = require('mongoose');

const agentRatingSchema = new mongoose.Schema({
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  comment: {
    type: String,
    default: ''
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

/**
 * Calculates the average rating and total number of ratings for a specific agent.
 * Fetches all AgentRating documents for the given agentId and computes the mean.
 * @param {mongoose.Types.ObjectId} agentId - The agent's User ID.
 * @returns {Promise<{avgRating: number, totalRatings: number}>} The average rating (0 if none) and count.
 */
agentRatingSchema.statics.getAgentAverageRating = async function(agentId) {
  const ratings = await this.find({ agentId });

  if (ratings.length === 0) {
    return {
      avgRating: 0,
      totalRatings: 0
    };
  }

  const sum = ratings.reduce((acc, r) => acc + r.rating, 0);
  const avg = sum / ratings.length;

  return {
    avgRating: avg,
    totalRatings: ratings.length
  };
};

module.exports = mongoose.models.AgentRating || mongoose.model('AgentRating', agentRatingSchema);
