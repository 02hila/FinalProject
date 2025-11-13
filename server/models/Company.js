const mongoose = require('mongoose');

const companySchema = new mongoose.Schema({
  name: { type: String, required: true },
  industry: String,
  description: String,
  languages: [String],
  brandColors: [String],
  website: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Company || mongoose.model('Company', companySchema);