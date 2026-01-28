/**
 * @file User.js
 * @description Mongoose model for application users. Supports three user types: agent, company,
 *   and admin. Agents are advertising professionals who create and share ads; companies are
 *   businesses that own campaigns and review ad submissions; admins manage the platform.
 *
 * Key fields:
 *   - email / password  -- authentication credentials (password is bcrypt-hashed via pre-save hook)
 *   - userType           -- discriminator that controls which subset of fields is relevant
 *   - stats              -- embedded sub-document holding role-specific counters (ratings, ad totals, etc.)
 *   - seenCampaignAssignments -- tracks which campaign assignments an agent has already viewed
 *
 * Relationships:
 *   - Referenced by Campaign (companyId, assignedAgents), PendingAd, Ad, Quote, Payment,
 *     AgentRating, PriceProposal, and InviteCode models.
 *   - The virtual `approvalRate` derives a percentage from stats.totalApproved / stats.totalAds.
 */
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    fullName: {
        type: String,
        required: true,
        trim: true
    },
    userType: {
        type: String,
        enum: ['agent', 'company', 'admin'],
        required: true
    },
    phone: {
        type: String,
        trim: true
    },

    // Agent-specific fields
    specialty: {
        type: String,
        enum: ['social', 'google', 'creative', 'analytics', 'general'],
        default: 'general'
    },
    bio: {
        type: String,
        maxlength: 500
    },
    skills: {
        type: String,
        maxlength: 300
    },
    socialMediaPlatform: {
        type: String,
        enum: ['', 'instagram', 'facebook', 'tiktok', 'linkedin', 'twitter', 'other'],
        default: ''
    },
    socialMediaHandle: {
        type: String,
        trim: true,
        maxlength: 200
    },

    // Company-specific fields
    companyName: {
        type: String,
        trim: true
    },
    description: {
        type: String,
        maxlength: 1000
    },
    industry: {
        type: String,
        trim: true
    },
    companySize: {
        type: String,
        enum: ['1-10', '11-50', '51-200', '201-500', '500+', '']
    },
    website: {
        type: String,
        trim: true
    },
    address: {
        type: String,
        trim: true
    },
    contactPerson: {
        type: String,
        trim: true
    },

    // Statistics
    stats: {
        // Agent stats
        averageRating: {
            type: Number,
            default: 0,
            min: 0,
            max: 5
        },
        totalRatings: {
            type: Number,
            default: 0
        },
        totalApproved: {
            type: Number,
            default: 0
        },
        totalPending: {
            type: Number,
            default: 0
        },
        totalRejected: {
            type: Number,
            default: 0
        },
        totalAds: {
            type: Number,
            default: 0
        },

        // Company stats
        activeCampaigns: {
            type: Number,
            default: 0
        },
        approvedAds: {
            type: Number,
            default: 0
        },
        pendingAds: {
            type: Number,
            default: 0
        },
        activeAgents: {
            type: Number,
            default: 0
        }
    },

    // Account settings
    isActive: {
        type: Boolean,
        default: true
    },
    isVerified: {
        type: Boolean,
        default: false
    },
    lastLogin: {
        type: Date
    },

    // Onboarding guide tracking
    hasSeenGuide: {
        type: Boolean,
        default: false
    },

    // Track which campaign assignments the agent has seen
    seenCampaignAssignments: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Campaign'
    }],

    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
  timestamps: true
});

// Indexes for better performance
userSchema.index({ email: 1 });
userSchema.index({ userType: 1 });
userSchema.index({ 'stats.averageRating': -1 });
userSchema.index({ specialty: 1 });

/**
 * Pre-save hook that hashes the password whenever it is new or modified.
 * Uses bcrypt with a cost factor of 10.
 */
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

/**
 * Compares a plain-text candidate password against the stored bcrypt hash.
 * @param {string} candidatePassword - The plain-text password to verify.
 * @returns {Promise<boolean>} True if the password matches, false otherwise.
 */
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

/**
 * Merges the provided stats object into the user's existing stats and persists the change.
 * Only keys that already exist on `this.stats` will be updated.
 * @param {Object} statsUpdate - Key-value pairs to merge (e.g. { totalApproved: 5 }).
 * @returns {Promise<void>}
 */
userSchema.methods.updateStats = async function(statsUpdate) {
    Object.keys(statsUpdate).forEach(key => {
        if (this.stats[key] !== undefined) {
            this.stats[key] = statsUpdate[key];
        }
    });
    await this.save();
};

/**
 * Recalculates the average rating and total rating count from a provided array of rating objects.
 * Updates `this.stats.averageRating` and `this.stats.totalRatings` in place (does not save).
 * @param {Array<{rating: number}>} ratings - Array of rating documents, each with a numeric `rating` field.
 */
userSchema.methods.calculateAverageRating = function(ratings) {
    if (!ratings || ratings.length === 0) {
        this.stats.averageRating = 0;
        this.stats.totalRatings = 0;
        return;
    }

    const sum = ratings.reduce((acc, rating) => acc + rating.rating, 0);
    this.stats.averageRating = Number((sum / ratings.length).toFixed(1));
    this.stats.totalRatings = ratings.length;
};

/**
 * Virtual property that computes the agent's approval rate as a whole-number percentage.
 * Returns 0 when no ads have been submitted.
 * @returns {number} Approval percentage (0-100).
 */
userSchema.virtual('approvalRate').get(function() {
    if (this.stats.totalAds === 0) return 0;
    return Math.round((this.stats.totalApproved / this.stats.totalAds) * 100);
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;
