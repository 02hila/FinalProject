// צור קובץ חדש: server/scripts/fix-companies.js
// הרץ אותו פעם אחת עם: node server/scripts/fix-companies.js

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');

async function fixExistingCompanies() {
  try {
    // התחבר למונגו
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // מצא את כל החברות שאין להן companyId
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