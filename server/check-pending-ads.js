/**
 * check-pending-ads.js -- Diagnostic Script for Pending Ads
 *
 * Purpose:
 *   Connects directly to MongoDB and dumps every document in the PendingAd
 *   collection, printing title, company, agent, status, and creation date.
 *   Intended as a developer debugging tool -- not part of the production server.
 *
 * Usage:
 *   node server/check-pending-ads.js
 *
 * Prerequisites:
 *   - A .env file with MONGODB_URI set.
 *
 * Connections:
 *   - Reads from the PendingAd model (server/models/PendingAd).
 *   - Closes the DB connection and exits when done.
 */

const mongoose = require('mongoose');
require('dotenv').config();

const PendingAd = require('./models/PendingAd');

/**
 * Fetches and logs all documents in the PendingAd collection.
 * Exits with code 0 on success, 1 on error.
 * @returns {Promise<void>}
 */
async function checkPendingAds() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    const ads = await PendingAd.find();
    console.log('\n📊 Total pending ads:', ads.length);

    ads.forEach(ad => {
      console.log('\n📝 Ad:', ad._id);
      console.log('  Title:', ad.title);
      console.log('  Company:', ad.companyId);
      console.log('  Agent:', ad.agentId);
      console.log('  Status:', ad.status);
      console.log('  Created:', ad.createdAt);
    });

    await mongoose.connection.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkPendingAds();
