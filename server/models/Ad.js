const mongoose = require('mongoose');

const adSchema = new mongoose.Schema({
  businessName: String,
  productService: String,
  targetAudience: String,
  keyMessage: String,
  tone: String,
  generatedText: String,
  imageData: String,
  campaignId: { type: mongoose.Schema.Types.ObjectId, ref: 'Campaign' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Ad || mongoose.model('Ad', adSchema);