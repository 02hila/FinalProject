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

// מתודה סטטית לחישוב דירוג ממוצע
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