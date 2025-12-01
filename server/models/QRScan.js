// server/models/QRScan.js
const mongoose = require('mongoose');

const qrScanSchema = new mongoose.Schema({
  // מזהה ייחודי לכל QR
  uniqueId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // קישור למודעה
  adId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PendingAd',
    required: true,
    index: true
  },
  
  // קישור לקמפיין
  campaignId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Campaign',
    required: true,
    index: true
  },
  
  // קישור לסוכן
  agentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // קישור לחברה
  companyId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  
  // כתובת היעד הסופית (אתר החברה)
  targetUrl: {
    type: String,
    required: true
  },
  
  // כתובת ה-QR המלאה (עם UTM parameters)
  fullUrl: {
    type: String,
    required: true
  },
  
  // תמונת ה-QR (Base64)
  qrImageData: {
    type: String,
    required: true
  },
  
  // סטטיסטיקות סריקות
  totalScans: {
    type: Number,
    default: 0
  },
  
  // רשימת סריקות (מוגבלת למקרים מיוחדים)
  scans: [{
    timestamp: { type: Date, default: Date.now },
    userAgent: String,
    ipAddress: String,
    referer: String
  }],
  
  // מטא-דאטה
  metadata: {
    adTitle: String,
    campaignTitle: String,
    agentName: String,
    companyName: String
  },
  
  // סטטוס
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// אינדקסים לשאילתות מהירות
qrScanSchema.index({ createdAt: -1 });
qrScanSchema.index({ agentId: 1, createdAt: -1 });
qrScanSchema.index({ companyId: 1, createdAt: -1 });
qrScanSchema.index({ campaignId: 1, createdAt: -1 });

// Virtual למספר הסריקות היומיות
qrScanSchema.virtual('todayScans').get(function() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return this.scans.filter(scan => scan.timestamp >= today).length;
});

module.exports = mongoose.models.QRScan || mongoose.model('QRScan', qrScanSchema);