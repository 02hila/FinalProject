/**
 * add-unique-ids-to-existing-ads.js -- Data Migration Script
 *
 * Purpose:
 *   One-time migration that retroactively assigns a 6-character hexadecimal
 *   uniqueId to every PendingAd document that does not already have one.
 *   Also updates the corresponding QRScan documents so they reference the
 *   new uniqueId.
 *
 * Usage:
 *   node server/scripts/add-unique-ids-to-existing-ads.js
 *
 * Prerequisites:
 *   - A .env file with MONGODB_URI set.
 *
 * Algorithm:
 *   1. Query PendingAd for documents where uniqueId is missing, null, or empty.
 *   2. For each, generate a random 6-character hex string (crypto.randomBytes).
 *   3. Verify uniqueness against existing documents (up to 10 retries).
 *   4. Save the uniqueId on the ad and, if the ad has an associated QR code,
 *      update the matching QRScan document as well.
 *   5. Print a summary of successes and errors, then close the connection.
 *
 * Connections:
 *   - Writes to the PendingAd and QRScan collections.
 *   - The uniqueId field is used by the /ad/:adId redirect route on the client
 *     and the QR scan tracking endpoint on the server.
 */

require('dotenv').config();
const mongoose = require('mongoose');
const crypto = require('crypto');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected'))
.catch(err => {
  console.error('❌ MongoDB connection error:', err);
  process.exit(1);
});

const PendingAd = require('../models/PendingAd');
const QRScan = require('../models/QRScan');

/**
 * Iterates over all PendingAd documents that lack a uniqueId, generates one,
 * persists it, and optionally updates the linked QRScan record.
 *
 * @returns {Promise<void>}
 */
async function addUniqueIdsToAds() {
  console.log('🚀 Starting migration: Adding unique IDs to existing ads...\n');

  try {
    // Find all ads without a uniqueId
    const adsWithoutId = await PendingAd.find({
      $or: [
        { uniqueId: { $exists: false } },
        { uniqueId: null },
        { uniqueId: '' }
      ]
    });

    console.log(`📊 Found ${adsWithoutId.length} ads without unique IDs\n`);

    if (adsWithoutId.length === 0) {
      console.log('✅ All ads already have unique IDs!');
      return;
    }

    let successCount = 0;
    let errorCount = 0;

    for (const ad of adsWithoutId) {
      try {
        // Generate a collision-resistant 6-character hex ID
        let uniqueId;
        let isUnique = false;
        let attempts = 0;

        // Retry loop guards against the unlikely event of a collision
        while (!isUnique && attempts < 10) {
          uniqueId = crypto.randomBytes(3).toString('hex').toUpperCase();
          const existing = await PendingAd.findOne({ uniqueId });
          if (!existing) {
            isUnique = true;
          }
          attempts++;
        }

        if (!isUnique) {
          console.error(`❌ Failed to generate unique ID for ad ${ad._id} after ${attempts} attempts`);
          errorCount++;
          continue;
        }

        // Persist the new uniqueId on the ad document
        ad.uniqueId = uniqueId;
        if (ad.metadata) {
          ad.metadata.adUniqueId = uniqueId;
        }
        await ad.save();

        // Propagate the uniqueId to the associated QRScan document if one exists
        if (ad.qrCode && ad.qrCode.uniqueId) {
          await QRScan.updateOne(
            { uniqueId: ad.qrCode.uniqueId },
            { $set: { adUniqueId: uniqueId } }
          );
          console.log(`✅ Updated ad ${ad._id} → ID: ${uniqueId} (with QR)`);
        } else {
          console.log(`✅ Updated ad ${ad._id} → ID: ${uniqueId}`);
        }

        successCount++;

      } catch (err) {
        console.error(`❌ Error updating ad ${ad._id}:`, err.message);
        errorCount++;
      }
    }

    console.log('\n📊 Migration Summary:');
    console.log(`   ✅ Successfully updated: ${successCount} ads`);
    console.log(`   ❌ Errors: ${errorCount} ads`);
    console.log('\n🎉 Migration completed!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  } finally {
    await mongoose.connection.close();
    console.log('👋 Database connection closed');
    process.exit(0);
  }
}

// Run the migration
addUniqueIdsToAds();
