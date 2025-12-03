// scripts/add-unique-ids-to-existing-ads.js
// Migration script to add uniqueId to existing ads

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
        // Generate unique ID (6 characters)
        let uniqueId;
        let isUnique = false;
        let attempts = 0;

        // Try to generate a unique ID (max 10 attempts)
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

        // Update the ad
        ad.uniqueId = uniqueId;
        if (ad.metadata) {
          ad.metadata.adUniqueId = uniqueId;
        }
        await ad.save();

        // Update associated QR code if exists
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