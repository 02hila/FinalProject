// server/services/unsharedAdsChecker.js
// בודק פרסומות מאושרות שלא שותפו ושולח תזכורת + יוצר חלופית

const PendingAd = require('../models/PendingAd');
const { sendUnsharedAdReminderEmail } = require('./emailService');

// ✅ הגדרות
const DAYS_BEFORE_REMINDER =3;  // כמה ימים לחכות לפני שליחת תזכורת
const CHECK_INTERVAL_HOURS = 6;  // כל כמה שעות לבדוק

// ✅ Helper functions (יוזרקו מ-server.js)
let createAdDesignOnServer;
let callGeminiWithRetry;
let searchPexelsImage;

function injectHelpers(helpers) {
  createAdDesignOnServer = helpers.createAdDesignOnServer;
  callGeminiWithRetry = helpers.callGeminiWithRetry;
  searchPexelsImage = helpers.searchPexelsImage;
}

/**
 * מחפש פרסומות מאושרות שלא שותפו
 * ושולח תזכורת + יוצר פרסומת חלופית
 */
async function checkUnsharedAds() {
  console.log('🔍 [UnsharedAdsChecker] Starting check...');
  
  try {
    // חשב את התאריך לפני X ימים
    const reminderThreshold = new Date();
    reminderThreshold.setDate(reminderThreshold.getDate() - DAYS_BEFORE_REMINDER);
    
    // מצא פרסומות:
    // 1. מאושרות
    // 2. אושרו לפני X ימים לפחות
    // 3. לא שותפו (shareCount = 0 או לא קיים)
    // 4. לא נשלחה תזכורת עדיין
    // 5. לא פרסומת חלופית (למנוע לופ אינסופי)
    const unsharedAds = await PendingAd.find({
      status: 'approved',
      isAlternative: { $ne: true },  // לא פרסומת חלופית
      $or: [
        { 'shareTracking.approvedAt': { $lte: reminderThreshold } },
        { 
          'shareTracking.approvedAt': { $exists: false },
          updatedAt: { $lte: reminderThreshold }  // fallback לתאריך עדכון
        }
      ],
      $or: [
        { 'shareTracking.shareCount': { $exists: false } },
        { 'shareTracking.shareCount': 0 }
      ],
      'shareTracking.reminderSent': { $ne: true }
    })
    .populate('agentId', 'fullName email')
    .populate('companyId', 'companyName fullName')
    .populate('campaignId', 'title')
    .limit(10);  // לא לעבד יותר מדי בבת אחת
    
    console.log(`📊 Found ${unsharedAds.length} unshared ads to process`);
    
    if (unsharedAds.length === 0) {
      console.log('✅ No unshared ads found - all good!');
      return { processed: 0 };
    }
    
    let processed = 0;
    let errors = 0;
    
    for (const ad of unsharedAds) {
      try {
        console.log(`\n📌 Processing ad: ${ad._id} (${ad.title})`);
        console.log(`   Agent: ${ad.agentId?.fullName || 'Unknown'}`);
        console.log(`   Company: ${ad.companyId?.companyName || ad.companyId?.fullName || 'Unknown'}`);
        
        // 1️⃣ יצירת פרסומת חלופית
        let alternativeAd = null;
        
        if (createAdDesignOnServer && callGeminiWithRetry && searchPexelsImage) {
          console.log('   🎨 Creating alternative ad...');
          alternativeAd = await createAlternativeAd(ad);
        } else {
          console.log('   ⚠️ Helper functions not available - skipping alternative creation');
        }
        
        // 2️⃣ שליחת מייל תזכורת
        console.log('   📧 Sending reminder email...');
        const emailResult = await sendUnsharedAdReminderEmail({
          agentEmail: ad.agentId?.email,
          agentName: ad.agentId?.fullName,
          companyName: ad.companyId?.companyName || ad.companyId?.fullName,
          adTitle: ad.title,
          daysSinceApproval: DAYS_BEFORE_REMINDER,
          hasAlternative: !!alternativeAd
        });
        
        // 3️⃣ עדכון הפרסומת המקורית
        ad.shareTracking = ad.shareTracking || {};
        ad.shareTracking.reminderSent = true;
        ad.shareTracking.reminderSentAt = new Date();
        
        if (alternativeAd) {
          ad.shareTracking.alternativeCreated = true;
          ad.shareTracking.alternativeAdId = alternativeAd._id;
        }
        
        await ad.save();
        
        console.log(`   ✅ Ad processed successfully`);
        console.log(`      Email: ${emailResult.success ? '✅ Sent' : '❌ Failed'}`);
        console.log(`      Alternative: ${alternativeAd ? '✅ Created' : '❌ Not created'}`);
        
        processed++;
        
      } catch (adError) {
        console.error(`   ❌ Error processing ad ${ad._id}:`, adError.message);
        errors++;
      }
      
      // המתנה קצרה בין פרסומות למניעת עומס
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n📊 [UnsharedAdsChecker] Completed:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);
    
    return { processed, errors };
    
  } catch (error) {
    console.error('❌ [UnsharedAdsChecker] Critical error:', error);
    return { processed: 0, errors: 1, criticalError: error.message };
  }
}

/**
 * יוצר פרסומת חלופית עם תמונה וטקסט שונים
 */
async function createAlternativeAd(originalAd) {
  try {
    // 1️⃣ יצירת טקסט חדש עם Gemini
    const textPrompt = `
אתה מעצב פרסומות מקצועי. צור גרסה חדשה ושונה לפרסומת קיימת.

פרטי הפרסומת המקורית:
- עסק: ${originalAd.metadata?.businessName || ''}
- מוצר/שירות: ${originalAd.metadata?.productService || ''}
- כותרת נוכחית: ${originalAd.title}
- טקסט נוכחי: ${originalAd.text}

צור גרסה חדשה ושונה לגמרי - כותרת אחרת, ניסוח אחר, זווית שיווקית אחרת.

צור JSON:
{
  "title": "כותרת חדשה ושונה לגמרי (עד 10 מילים)",
  "ad_text": "טקסט חדש עם גישה שיווקית אחרת (2-3 משפטים)",
  "call_to_action": "קריאה לפעולה חדשה (3-5 מילים)",
  "image_keyword": "2-3 מילים באנגלית לחיפוש תמונה שונה"
}

כללים:
- הכותרת והטקסט חייבים להיות שונים לגמרי מהמקור
- שמור על טון ${originalAd.metadata?.tone || 'מקצועי'}
- JSON תקין בלבד
    `.trim();

    const geminiResponse = await callGeminiWithRetry(textPrompt, 3, 'gemini-2.5-flash');
    
    // Parse JSON
    let newContent;
    try {
      let jsonString = geminiResponse.trim();
      const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
      if (fencedMatch) jsonString = fencedMatch[1];
      else {
        const braceMatch = jsonString.match(/\{[\s\S]*\}/);
        if (braceMatch) jsonString = braceMatch[0];
      }
      newContent = JSON.parse(jsonString);
      console.log('      ✅ New content generated:', newContent.title);
    } catch (parseErr) {
      console.error('      ❌ JSON parsing failed:', parseErr.message);
      throw new Error('Failed to parse Gemini response');
    }
    
    // 2️⃣ חיפוש תמונה חדשה
    const currentImageId = originalAd.metadata?.lastImageUrl?.match(/photos\/(\d+)\//)?.[1];
    let newImageUrl = null;
    let attempts = 0;
    
    while (!newImageUrl && attempts < 3) {
      attempts++;
      const searchTerm = newContent.image_keyword || `${originalAd.metadata?.businessName} alternative`;
      console.log(`      🔍 Searching for image: "${searchTerm}" (attempt ${attempts})`);
      
      const foundUrl = await searchPexelsImage(searchTerm, originalAd.metadata?.imageStyle);
      
      if (foundUrl) {
        const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
        if (foundImageId !== currentImageId) {
          newImageUrl = foundUrl;
          console.log(`      ✅ Found different image`);
        } else {
          console.log(`      ⚠️ Same image - trying different search`);
          newContent.image_keyword = `${searchTerm} ${['fresh', 'new', 'modern'][attempts - 1]}`;
        }
      }
    }
    
    // 3️⃣ יצירת העיצוב
    const imageData = await createAdDesignOnServer({
      businessName: originalAd.metadata?.businessName,
      adText: newContent.ad_text,
      title: newContent.title,
      callToAction: newContent.call_to_action,
      productService: originalAd.metadata?.productService,
      adStyle: originalAd.metadata?.adStyle || 'modern',
      imageUrl: newImageUrl,
      agentName: originalAd.agentId?.fullName || 'Ads Maker'
    });
    
    // 4️⃣ שמירת הפרסומת החלופית
    const alternativeAd = new PendingAd({
      uniqueId: require('crypto').randomBytes(3).toString('hex').toUpperCase(),
      title: newContent.title,
      text: newContent.ad_text,
      callToAction: newContent.call_to_action,
      imageData,
      companyId: originalAd.companyId,
      campaignId: originalAd.campaignId,
      agentId: originalAd.agentId,
      status: 'approved',  // מאושרת אוטומטית
      isAlternative: true,
      originalAdId: originalAd._id,
      metadata: {
        ...originalAd.metadata,
        lastImageUrl: newImageUrl,
        imageKeyword: newContent.image_keyword,
        isAlternativeFor: originalAd._id,
        createdReason: 'unshared_reminder'
      },
      shareTracking: {
        approvedAt: new Date()
      }
    });
    
    await alternativeAd.save();
    console.log(`      ✅ Alternative ad saved: ${alternativeAd._id}`);
    
    return alternativeAd;
    
  } catch (error) {
    console.error('      ❌ Error creating alternative ad:', error.message);
    return null;
  }
}

/**
 * מפעיל את הבדיקה בצורה מתוזמנת
 */
function startScheduledChecker() {
  console.log(`🕐 [UnsharedAdsChecker] Starting scheduled checker (every ${CHECK_INTERVAL_HOURS} hours)`);
  
  // הפעלה ראשונית אחרי דקה
  setTimeout(() => {
    checkUnsharedAds();
  }, 60000);
  
  // הפעלה מתוזמנת כל X שעות
  setInterval(() => {
    checkUnsharedAds();
  }, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
}

module.exports = {
  checkUnsharedAds,
  startScheduledChecker,
  injectHelpers,
  DAYS_BEFORE_REMINDER
};