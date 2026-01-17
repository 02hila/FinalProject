const PendingAd = require('../models/PendingAd');
const QRScan = require('../models/QRScan');
const { sendAlternativeAdCreatedToCompanyEmail } = require('./emailService');
const geminiRateLimiter = require('./geminiRateLimiter');

const MIN_SCANS_THRESHOLD = 5;
const DAYS_TO_CHECK = 7;
const CHECK_INTERVAL_HOURS = 12;
const MAX_ADS_PER_CHECK = 3;
const DELAY_BETWEEN_ADS_MS = 5000;

let createAdDesignOnServer;
let callGeminiWithRetry;
let searchPexelsImage;

function injectHelpers(helpers) {
  createAdDesignOnServer = helpers.createAdDesignOnServer;
  callGeminiWithRetry = helpers.callGeminiWithRetry;
  searchPexelsImage = helpers.searchPexelsImage;
}

async function checkLowPerformanceAds() {
  console.log('[LowPerformanceChecker] Starting check...');
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);

  try {
    const checkDate = new Date();
    checkDate.setDate(checkDate.getDate() - DAYS_TO_CHECK);

    const lowPerformanceQRs = await QRScan.find({
      scans: { $lt: MIN_SCANS_THRESHOLD },
      createdAt: { $lte: checkDate }
    }).lean();

    console.log(`Found ${lowPerformanceQRs.length} QR codes with low performance`);

    if (lowPerformanceQRs.length === 0) {
      console.log('No low performance QRs found - all good!');
      return { processed: 0 };
    }

    const adUniqueIds = lowPerformanceQRs
      .map(qr => qr.adUniqueId)
      .filter(Boolean);

    const lowPerformanceAds = await PendingAd.find({
      uniqueId: { $in: adUniqueIds },
      status: 'approved',
      isAlternative: { $ne: true },
      'metadata.lowPerformanceAlternativeCreated': { $ne: true }
    })
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName email')
      .populate('campaignId', 'title websiteUrl')
      .limit(MAX_ADS_PER_CHECK);

    console.log(`Found ${lowPerformanceAds.length} ads to process`);

    if (lowPerformanceAds.length === 0) {
      console.log('No ads need alternatives');
      return { processed: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const ad of lowPerformanceAds) {
      try {
        const qrData = lowPerformanceQRs.find(qr => qr.adUniqueId === ad.uniqueId);
        const currentScans = qrData?.scans || 0;

        console.log(`\nProcessing ad: ${ad._id} (${ad.title})`);
        console.log(`   Agent: ${ad.agentId?.fullName || 'Unknown'}`);
        console.log(`   Company: ${ad.companyId?.companyName || ad.companyId?.fullName || 'Unknown'}`);
        console.log(`   Current QR scans: ${currentScans} (threshold: ${MIN_SCANS_THRESHOLD})`);

        let alternativeAd = null;

        if (createAdDesignOnServer && callGeminiWithRetry && searchPexelsImage) {
          const rateLimitResult = await geminiRateLimiter.waitUntilAllowed();
          if (!rateLimitResult.allowed) {
            console.log(`   Rate limit: ${rateLimitResult.error}`);
            console.log('   Skipping alternative creation due to rate limit');
          } else {
            console.log('   Creating alternative ad (pending approval)...');
            alternativeAd = await createAlternativeAd(ad, currentScans);
          }
        } else {
          console.log('   Helper functions not available - skipping');
        }

        if (alternativeAd) {
          ad.metadata = ad.metadata || {};
          ad.metadata.lowPerformanceAlternativeCreated = true;
          ad.metadata.lowPerformanceAlternativeAdId = alternativeAd._id;
          ad.metadata.lowPerformanceCheckedAt = new Date();
          ad.metadata.scansAtCheck = currentScans;
          await ad.save();
          console.log('   Alternative ad created and sent for company approval');

          const companyEmail = ad.companyId?.email;
          if (companyEmail) {
            console.log(`   Sending notification to company: ${companyEmail}`);
            try {
              await sendAlternativeAdCreatedToCompanyEmail({
                companyEmail,
                companyName: ad.companyId?.companyName || ad.companyId?.fullName || 'Company',
                agentName: ad.agentId?.fullName || 'Agent',
                originalAdTitle: ad.title,
                reason: 'low_performance_qr',
                currentScans
              });
              console.log('   Email sent to company');
            } catch (emailError) {
              console.error('   Email failed:', emailError.message);
            }
          } else {
            console.log('   No company email found - skipping notification');
          }
        }

        console.log('   Ad processed successfully');
        console.log(`      Alternative: ${alternativeAd ? 'Created (pending)' : 'Not created'}`);

        processed++;

      } catch (adError) {
        console.error(`   Error processing ad ${ad._id}:`, adError.message);
        errors++;
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ADS_MS));
    }

    console.log('\n[LowPerformanceChecker] Completed:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);

    return { processed, errors };

  } catch (error) {
    console.error('[LowPerformanceChecker] Critical error:', error);
    return { processed: 0, errors: 1, criticalError: error.message };
  }
}

async function createAlternativeAd(originalAd, currentScans) {
  try {
    const adLanguage = originalAd.metadata?.language || 'Hebrew';
    const adWebsiteUrl = originalAd.campaignId?.websiteUrl || '';

    const textPrompt = adLanguage === 'Hebrew' ? `
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
- כתוב בעברית בלבד
- JSON תקין בלבד
    `.trim() : `
You are a professional ad designer and performance improvement expert.

Existing ad with low performance (only ${currentScans} QR scans):
- Business: ${originalAd.metadata?.businessName || ''}
- Product/Service: ${originalAd.metadata?.productService || ''}
- Current title: ${originalAd.title}
- Current text: ${originalAd.text}
- Call to action: ${originalAd.callToAction || ''}

Create a new version with:
1. A more engaging and attention-grabbing title
2. More aggressive marketing text
3. A more urgent call to action
4. Different image keywords

Create JSON:
{
  "title": "New more engaging title (max 10 words)",
  "ad_text": "More aggressive marketing text (2-3 sentences)",
  "call_to_action": "Urgent call to action (3-5 words)",
  "image_keyword": "2-3 English words for a more attractive image"
}

Rules:
- The title must be different and more attention-grabbing
- The text should create a sense of urgency
- The call to action should be clear and urgent
- Write in ${adLanguage} only
- Valid JSON only
    `.trim();

    const geminiResponse = await callGeminiWithRetry(textPrompt, 3);

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
      console.log('      New content generated:', newContent.title);
    } catch (parseErr) {
      console.error('      JSON parsing failed:', parseErr.message);
      throw new Error('Failed to parse Gemini response');
    }

    const currentImageId = originalAd.metadata?.lastImageUrl?.match(/photos\/(\d+)\//)?.[1];
    let newImageUrl = null;
    let attempts = 0;

    while (!newImageUrl && attempts < 3) {
      attempts++;
      const searchTerm = newContent.image_keyword || `${originalAd.metadata?.businessName} premium`;
      console.log(`      Searching for image: "${searchTerm}" (attempt ${attempts})`);

      const foundUrl = await searchPexelsImage(searchTerm, originalAd.metadata?.imageStyle);

      if (foundUrl) {
        const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
        if (foundImageId !== currentImageId) {
          newImageUrl = foundUrl;
          console.log('      Found different image');
        } else {
          console.log('      Same image - trying different search');
          newContent.image_keyword = `${searchTerm} ${['vibrant', 'professional', 'attractive'][attempts - 1]}`;
        }
      }
    }

    const imageData = await createAdDesignOnServer({
      businessName: originalAd.metadata?.businessName,
      adText: newContent.ad_text,
      title: newContent.title,
      callToAction: newContent.call_to_action,
      productService: originalAd.metadata?.productService,
      adStyle: originalAd.metadata?.adStyle || 'modern',
      imageUrl: newImageUrl,
      agentName: originalAd.agentId?.fullName || 'Ads Maker',
      language: adLanguage,
      websiteUrl: adWebsiteUrl
    });

    const alternativeAd = new PendingAd({
      uniqueId: require('crypto').randomBytes(3).toString('hex').toUpperCase(),
      title: newContent.title,
      text: newContent.ad_text,
      callToAction: newContent.call_to_action,
      imageData,
      companyId: originalAd.companyId,
      campaignId: originalAd.campaignId,
      agentId: originalAd.agentId,
      status: 'pending',
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
    console.log(`      Alternative ad saved (PENDING approval): ${alternativeAd._id}`);

    await geminiRateLimiter.recordGeneration('low_performance', alternativeAd._id?.toString());

    return alternativeAd;

  } catch (error) {
    console.error('      Error creating alternative ad:', error.message);
    return null;
  }
}

function startScheduledChecker() {
  console.log(`[LowPerformanceChecker] Starting scheduled checker (every ${CHECK_INTERVAL_HOURS} hours)`);
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);

  setTimeout(() => {
    checkLowPerformanceAds();
  }, 120000);

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
