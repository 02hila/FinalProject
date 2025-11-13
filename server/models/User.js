// server/models/User.js
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

    // ===== Agent-specific fields =====
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
    
    // ===== Company-specific fields =====
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

    // ===== Statistics =====
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

    // ===== Account settings =====
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

// Password hashing before saving
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

// Password comparison method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

// Method to update stats
userSchema.methods.updateStats = async function(statsUpdate) {
    Object.keys(statsUpdate).forEach(key => {
        if (this.stats[key] !== undefined) {
            this.stats[key] = statsUpdate[key];
        }
    });
    await this.save();
};

// Method to calculate average rating
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

// Virtual for approval rate
userSchema.virtual('approvalRate').get(function() {
    if (this.stats.totalAds === 0) return 0;
    return Math.round((this.stats.totalApproved / this.stats.totalAds) * 100);
});

// Ensure virtuals are included in JSON
userSchema.set('toJSON', { virtuals: true });
userSchema.set('toObject', { virtuals: true });

const User = mongoose.model('User', userSchema);

module.exports = User;