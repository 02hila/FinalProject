/**
 * Fix Companies Script
 *
 * This script fixes existing company users by setting their companyId field to their _id
 * if the companyId is missing or null. This is a one-time migration script to ensure
 * data consistency for companies created before the companyId field was introduced.
 *
 * Usage: Run this script once with: node server/scripts/fix-companies.js
 *
 * @module scripts/fix-companies
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

/**
 * Fixes existing company users by setting their companyId to their _id if missing.
 *
 * This function connects to MongoDB, finds all company users without a companyId,
 * and updates them to set companyId equal to their _id. This ensures data consistency
 * for companies that were created before the companyId field was introduced.
 *
 * @async
 * @function fixExistingCompanies
 * @returns {Promise<void>} Resolves when the fix is complete, exits the process
 * @throws {Error} If there's an error connecting to MongoDB or updating users
 */
async function fixExistingCompanies() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Find all companies that don't have companyId
    const result = await User.updateMany(
      {
        userType: 'company',
        $or: [{ companyId: null }, { companyId: { $exists: false } }]
      },
      [{ $set: { companyId: '$_id' } }]
    );

    console.log(`📊 Found and updated ${result.modifiedCount} companies.`);

    console.log('🎉 All relevant companies fixed!');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixExistingCompanies();