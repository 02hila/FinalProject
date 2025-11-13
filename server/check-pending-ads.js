// server/check-pending-ads.js
const mongoose = require('mongoose');
require('dotenv').config();

const PendingAd = require('./models/PendingAd');

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