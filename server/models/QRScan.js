// models/QRScan.js - MongoDB model for QR code tracking

const mongoose = require('mongoose');

const qrScanSchema = new mongoose.Schema({
  // מזהה ייחודי ל-QR (משמש ב-URL הקצר)
  uniqueId: { 
    type: String, 
    required: true, 
    unique: true,
    index: true 
  },
  
  // קישורים לישויות אחרות
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
  
  // URLs
  fullUrl: { 
    type: String, 
    required: true 
  }, // https://yoursite.com/r/abc123
  
  targetUrl: { 
    type: String, 
    required: true 
  }, // https://example.com?utm_...
  
  // QR code image data (base64)
  qrImageData: { 
    type: String 
  },
  
  // מעקב
  scans: { 
    type: Number, 
    default: 0 
  },
  
  lastScannedAt: { 
    type: Date 
  },
  
  // מטא-דאטה נוספת
  metadata: {
    userAgent: String,
    ip: String,
    location: {
      country: String,
      city: String
    }
  }
  
}, { 
  timestamps: true // createdAt, updatedAt
});

// אינדקסים לביצועים
qrScanSchema.index({ createdAt: -1 });
qrScanSchema.index({ scans: -1 });
qrScanSchema.index({ campaignId: 1, scans: -1 });

// מתודה להגדלת מספר הסריקות
qrScanSchema.methods.incrementScans = function() {
  this.scans = (this.scans || 0) + 1;
  this.lastScannedAt = new Date();
  return this.save();
};

// סטטיסטיקות לקמפיין
qrScanSchema.statics.getCampaignStats = async function(campaignId) {
  return this.aggregate([
    { $match: { campaignId: mongoose.Types.ObjectId(campaignId) } },
    {
      $group: {
        _id: '$campaignId',
        totalQRs: { $sum: 1 },
        totalScans: { $sum: '$scans' },
        avgScans: { $avg: '$scans' },
        lastScan: { $max: '$lastScannedAt' }
      }
    }
  ]);
};

// סטטיסטיקות לסוכן
qrScanSchema.statics.getAgentStats = async function(agentId) {
  return this.aggregate([
    { $match: { agentId: mongoose.Types.ObjectId(agentId) } },
    {
      $group: {
        _id: '$agentId',
        totalQRs: { $sum: 1 },
        totalScans: { $sum: '$scans' },
        avgScans: { $avg: '$scans' }
      }
    }
  ]);
};

// מחיקת QRs ישנים (אופציונלי - לניקוי)
qrScanSchema.statics.cleanupOldScans = async function(daysOld = 90) {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - daysOld);
  
  return this.deleteMany({
    createdAt: { $lt: cutoffDate },
    scans: 0 // רק QRs שלא נסרקו מעולם
  });
};

const QRScan = mongoose.model('QRScan', qrScanSchema);

module.exports = QRScan;