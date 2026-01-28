/**
 * @file InviteCode.js
 * @description Mongoose model for single-use invitation codes that companies generate
 *   to onboard new agents. Each code is tied to a specific company and can only be
 *   redeemed once. After an agent uses the code during registration, `isUsed` is set
 *   to true and `usedBy` records which agent redeemed it.
 *
 * Key fields:
 *   - code    -- the unique invitation string shared with a prospective agent
 *   - isUsed  -- whether the code has already been redeemed
 *   - usedBy  -- the User (agent) who redeemed the code
 *
 * Relationships:
 *   - companyId -> User model (the company that generated the invite)
 *   - usedBy    -> User model (the agent who redeemed the invite)
 */
const mongoose = require('mongoose');

const inviteCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true
  },
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isUsed: {
    type: Boolean,
    default: false
  },
  usedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

module.exports = mongoose.models.InviteCode || mongoose.model('InviteCode', inviteCodeSchema);
