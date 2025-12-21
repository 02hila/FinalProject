// server/services/lowPerformanceChecker.js
// בודק פרסומות עם ביצועי QR נמוכים ויוצר פרסומת חלופית

const PendingAd = require('../models/PendingAd');
const QRScan = require('../models/QRScan');

// ✅ הגדרות
const MIN_SCANS_THRESHOLD = 5;  // מינימום סריקות
const DAYS_TO_CHECK = 7;        // בכמה ימים לבדוק
const CHECK_INTERVAL_HOURS = 12; // כל כמה שעות לבדוק

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
 * מחפש פרסומות עם QR שיש להן ביצועים נמוכים
 * ויוצר פרסומת חלופית לאישור החברה
 */
async function checkLowPerformanceAds() {
  console.log('📊 [LowPerformanceChecker] Starting check...');
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);
  
  try {
    // חשב את התאריך לפני X ימים
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - DAYS_TO_CHECK);
    
    // 1️⃣ מצא את כל ה-QR codes עם ביצועים נמוכים
    const lowPerformanceQRs = await QRScan.find({
      scans: { $lt: MIN_SCANS_THRESHOLD },
      createdAt: { $lte: checkDate }  // נוצרו לפני לפחות X ימים
    }).lean();
    
    console.log(`📊 Found ${lowPerformanceQRs.length} QR codes with low performance`);
    
    if (lowPerformanceQRs.length === 0) {
      console.log('✅ No low performance QRs found - all good!');
      return { processed: 0 };
    }
    
    // 2️⃣ קבל את ה-adUniqueIds
    const adUniqueIds = lowPerformanceQRs
      .map(qr => qr.adUniqueId)
      .filter(Boolean);
    
    // 3️⃣ מצא את הפרסומות המתאימות
    const lowPerformanceAds = await PendingAd.find({
      uniqueId: { $in: adUniqueIds },
      status: 'approved',
      isAlternative: { $ne: true },  // לא פרסומת חלופית
      'metadata.lowPerformanceAlternativeCreated': { $ne: true }  // לא נוצרה חלופית עדיין
    })
    .populate('agentId', 'fullName email')
    .populate('companyId', 'companyName fullName')
    .populate('campaignId', 'title')
    .limit(10);  // לא לעבד יותר מדי בבת אחת
    
    console.log(`📊 Found ${lowPerformanceAds.length} ads to process`);
    
    if (lowPerformanceAds.length === 0) {
      console.log('✅ No ads need alternatives');
      return { processed: 0 };
    }
    
    let processed = 0;
    let errors = 0;
    
    for (const ad of lowPerformanceAds) {
      try {
        // מצא את ה-QR המתאים לפרסומת
        const qrData = lowPerformanceQRs.find(qr => qr.adUniqueId === ad.uniqueId);
        const currentScans = qrData?.scans || 0;
        
        console.log(`\n📌 Processing ad: ${ad._id} (${ad.title})`);
        console.log(`   Agent: ${ad.agentId?.fullName || 'Unknown'}`);
        console.log(`   Company: ${ad.companyId?.companyName || ad.companyId?.fullName || 'Unknown'}`);
        console.log(`   Current QR scans: ${currentScans} (threshold: ${MIN_SCANS_THRESHOLD})`);
        
        // יצירת פרסומת חלופית
        let alternativeAd = null;
        
        if (createAdDesignOnServer && callGeminiWithRetry && searchPexelsImage) {
          console.log('   🎨 Creating alternative ad (pending approval)...');
          alternativeAd = await createAlternativeAd(ad, currentScans);
        } else {
          console.log('   ⚠️ Helper functions not available - skipping');
        }
        
        // עדכון הפרסומת המקורית
        if (alternativeAd) {
          ad.metadata = ad.metadata || {};
          ad.metadata.lowPerformanceAlternativeCreated = true;
          ad.metadata.lowPerformanceAlternativeAdId = alternativeAd._id;
          ad.metadata.lowPerformanceCheckedAt = new Date();
          ad.metadata.scansAtCheck = currentScans;
          await ad.save();
          console.log(`   ✅ Alternative ad created and sent for company approval`);
        }
        
        console.log(`   ✅ Ad processed successfully`);
        console.log(`      Alternative: ${alternativeAd ? '✅ Created (pending)' : '❌ Not created'}`);
        
        processed++;
        
      } catch (adError) {
        console.error(`   ❌ Error processing ad ${ad._id}:`, adError.message);
        errors++;
      }
      
      // המתנה קצרה בין פרסומות
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
    console.log(`\n📊 [LowPerformanceChecker] Completed:`);
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);
    
    return { processed, errors };
    
  } catch (error) {
    console.error('❌ [LowPerformanceChecker] Critical error:', error);
    return { processed: 0, errors: 1, criticalError: error.message };
  }
}

/**
 * יוצר פרסומת חלופית עם גישה שיווקית שונה
 * מבוסס על ניתוח הביצועים הנמוכים
 */
async function createAlternativeAd(originalAd, currentScans) {
  try {
    // 1️⃣ יצירת טקסט חדש עם Gemini - עם דגש על שיפור ביצועים
    const textPrompt = `
אתה מעצב פרסומות מקצועי ומומחה בשיפור ביצועים.

פרסומת קיימת עם ביצועים נמוכים (${currentScans} סריקות QR בלבד):
- עסק: ${originalAd.metadata?.businessName || ''}
- מוצר/שירות: ${originalAd.metadata?.productService || ''}
- כותרת נוכחית: ${originalAd.title}
- טקסט נוכחי: ${originalAd.text}
- קריאה לפעולה: ${originalAd.callToAction || ''}

צור גרסה חדשה עם:
1. כותרת יותר מושכת וסקרנית
2. טקסט שיווקי יותר אגרסיבי
3. קריאה לפעולה דחופה יותר
4. מילות מפתח שונות לתמונה

צור JSON:
{
  "title": "כותרת חדשה מושכת יותר (עד 10 מילים)",
  "ad_text": "טקסט שיווקי אגרסיבי יותר (2-3 משפטים)",
  "call_to_action": "קריאה לפעולה דחופה (3-5 מילים)",
  "image_keyword": "2-3 מילים באנגלית לתמונה מושכת יותר"
}

כללים:
- הכותרת חייבת להיות שונה ויותר מושכת תשומת לב
- הטקסט צריך ליצור תחושת דחיפות
- הקריאה לפעולה צריכה להיות ברורה ודחופה
- JSON תקין בלבד
    `.trim();

    const geminiResponse = await callGeminiWithRetry(textPrompt, 3, 'gemini-2.0-flash');
    
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
    
    // 2️⃣ חיפוש תמונה חדשה ומושכת יותר
    const currentImageId = originalAd.metadata?.lastImageUrl?.match(/photos\/(\d+)\//)?.[1];
    let newImageUrl = null;
    let attempts = 0;
    
    while (!newImageUrl && attempts < 3) {
      attempts++;
      const searchTerm = newContent.image_keyword || `${originalAd.metadata?.businessName} premium`;
      console.log(`      🔍 Searching for image: "${searchTerm}" (attempt ${attempts})`);
      
      const foundUrl = await searchPexelsImage(searchTerm, originalAd.metadata?.imageStyle);
      
      if (foundUrl) {
        const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
        if (foundImageId !== currentImageId) {
          newImageUrl = foundUrl;
          console.log(`      ✅ Found different image`);
        } else {
          console.log(`      ⚠️ Same image - trying different search`);
          newContent.image_keyword = `${searchTerm} ${['vibrant', 'professional', 'attractive'][attempts - 1]}`;
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
    
    // 4️⃣ שמירת הפרסומת החלופית - בסטטוס PENDING!
    const alternativeAd = new PendingAd({
      uniqueId: require('crypto').randomBytes(3).toString('hex').toUpperCase(),
      title: newContent.title,
      text: newContent.ad_text,
      callToAction: newContent.call_to_action,
      imageData,
      companyId: originalAd.companyId,
      campaignId: originalAd.campaignId,
      agentId: originalAd.agentId,
      status: 'pending',  // ✅ ממתין לאישור החברה!
      isAlternative: true,
      originalAdId: originalAd._id,
      metadata: {
        ...originalAd.metadata,
        lastImageUrl: newImageUrl,
        imageKeyword: newContent.image_keyword,
        isAlternativeFor: originalAd._id,
        createdReason: 'low_performance_qr',
        originalAdTitle: originalAd.title,
        originalScans: currentScans,
        performanceThreshold: MIN_SCANS_THRESHOLD
      }
    });
    
    await alternativeAd.save();
    console.log(`      ✅ Alternative ad saved (PENDING approval): ${alternativeAd._id}`);
    
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
  console.log(`📊 [LowPerformanceChecker] Starting scheduled checker (every ${CHECK_INTERVAL_HOURS} hours)`);
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);
  
  // הפעלה ראשונית אחרי 2 דקות
  setTimeout(() => {
    checkLowPerformanceAds();
  }, 120000);
  
  // הפעלה מתוזמנת כל X שעות
  setInterval(() => {
    checkLowPerformanceAds();
  }, CHECK_INTERVAL_HOURS * 60 * 60 * 1000);
}

module.exports = {
  checkLowPerformanceAds,
  startScheduledChecker,
  injectHelpers,
  MIN_SCANS_THRESHOLD,
  DAYS_TO_CHECK
};