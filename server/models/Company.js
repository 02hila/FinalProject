/**
 * @file Company.js
 * @description Mongoose model for company profile metadata. This is a lightweight document
 *   that stores branding and identity information for a company (name, industry, brand colors,
 *   supported languages, etc.). It is separate from the User model's company-specific fields
 *   and is primarily referenced by QRScan for linking scans to a company entity.
 *
 * Key fields:
 *   - name        -- the company's display name
 *   - industry    -- business sector / vertical
 *   - languages   -- array of languages the company supports for ad content
 *   - brandColors -- array of hex or named color values representing the brand palette
 *   - website     -- the company's public website URL
 *
 * Relationships:
 *   - Referenced by QRScan.companyId.
 */
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
