/**
 * Low Performance Ad Checker
 *
 * A scheduled background service that identifies approved ads whose QR codes have
 * received fewer scans than a minimum threshold within a configurable time window.
 * For each qualifying ad, the checker automatically generates an improved alternative
 * ad using Gemini AI and Pexels imagery, saves it in "pending" status for company
 * approval, and sends an email notification to the company.
 *
 * Key exports:
 *  - checkLowPerformanceAds -- runs one check cycle (can also be triggered manually)
 *  - startScheduledChecker  -- starts the recurring interval timer
 *  - injectHelpers          -- receives references to createAdDesignOnServer, callGeminiWithRetry,
 *                              and searchPexelsImage (avoids circular dependency with other services)
 *  - MIN_SCANS_THRESHOLD / DAYS_TO_CHECK -- tunable constants
 *
 * Called by:
 *  - Server startup (startScheduledChecker is called during boot)
 *  - Admin routes (optional manual trigger via checkLowPerformanceAds)
 *
 * Depends on:
 *  - PendingAd and QRScan Mongoose models
 *  - geminiRateLimiter (to respect daily generation quotas)
 *  - emailService (sendAlternativeAdCreatedToCompanyEmail)
 *  - Injected helpers: createAdDesignOnServer (canvasService), callGeminiWithRetry (geminiService),
 *    searchPexelsImage (pexelsService)
 */
const PendingAd = require('../models/PendingAd');
const QRScan = require('../models/QRScan');
const { sendAlternativeAdCreatedToCompanyEmail } = require('./emailService');
const geminiRateLimiter = require('./geminiRateLimiter');

/** Minimum QR scans an ad must receive to be considered "performing". */
const MIN_SCANS_THRESHOLD = 5;

/** Number of days after creation before an ad is eligible for the low-performance check. */
const DAYS_TO_CHECK = 7;

/** How often the scheduled check runs (in hours). */
const CHECK_INTERVAL_HOURS = 12;

/** Maximum number of ads to process per check cycle (to bound resource usage). */
const MAX_ADS_PER_CHECK = 3;

/** Delay between processing individual ads to avoid overloading external APIs. */
const DELAY_BETWEEN_ADS_MS = 5000;

// These are injected at runtime via injectHelpers() to break circular dependencies.
let createAdDesignOnServer;
let callGeminiWithRetry;
let searchPexelsImage;

/**
 * Receives external helper functions that this module needs but cannot import
 * directly due to circular dependency constraints. Must be called once at startup.
 *
 * @param {Object} helpers
 * @param {Function} helpers.createAdDesignOnServer - From canvasService.
 * @param {Function} helpers.callGeminiWithRetry - From geminiService.
 * @param {Function} helpers.searchPexelsImage - From pexelsService.
 */
function injectHelpers(helpers) {
  createAdDesignOnServer = helpers.createAdDesignOnServer;
  callGeminiWithRetry = helpers.callGeminiWithRetry;
  searchPexelsImage = helpers.searchPexelsImage;
}

/**
 * Main check cycle: finds approved ads with low QR scan counts and creates
 * alternative versions for company review.
 *
 * Workflow:
 *  1. Query QRScan records older than DAYS_TO_CHECK days with fewer than MIN_SCANS_THRESHOLD scans.
 *  2. Match those QR codes to their parent PendingAd documents (only originals, not alternatives).
 *  3. For each qualifying ad (up to MAX_ADS_PER_CHECK):
 *     a. Wait for rate-limit clearance.
 *     b. Generate an alternative ad via Gemini + Pexels + canvas.
 *     c. Save the alternative with status "pending" and mark the original as processed.
 *     d. Send an email notification to the company.
 *
 * @returns {Promise<{processed: number, errors?: number, criticalError?: string}>}
 */
async function checkLowPerformanceAds() {
  console.log('[LowPerformanceChecker] Starting check...');
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);

  try {
    // Calculate the cutoff date: only consider QR codes created at least DAYS_TO_CHECK ago
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

    // Find original ads that haven't already had an alternative created for low performance
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
          // Wait for rate limiter clearance before using the Gemini API
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
          // Mark the original ad so it is not re-processed in future check cycles
          ad.metadata = ad.metadata || {};
          ad.metadata.lowPerformanceAlternativeCreated = true;
          ad.metadata.lowPerformanceAlternativeAdId = alternativeAd._id;
          ad.metadata.lowPerformanceCheckedAt = new Date();
          ad.metadata.scansAtCheck = currentScans;
          await ad.save();
          console.log('   Alternative ad created and sent for company approval');

          // Notify the company about the new alternative ad
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

      // Delay between ads to spread out API calls
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

/**
 * Generates an alternative ad for a low-performing original.
 *
 * Steps:
 *  1. Build a Gemini prompt requesting more engaging copy (language-aware).
 *  2. Parse the JSON response for new title, text, CTA, and image keywords.
 *  3. Search Pexels for a different image than the original (retries up to 3 times
 *     with modified keywords to avoid duplicates).
 *  4. Render the new ad on canvas via createAdDesignOnServer.
 *  5. Save as a new PendingAd document with status "pending" and isAlternative=true.
 *  6. Record the generation in the rate limiter.
 *
 * @param {Object} originalAd - The Mongoose PendingAd document of the underperforming ad.
 * @param {number} currentScans - Current QR scan count for context in the prompt.
 * @returns {Promise<Object|null>} The saved alternative PendingAd document, or null on failure.
 */
async function createAlternativeAd(originalAd, currentScans) {
  try {
    const adLanguage = originalAd.metadata?.language || 'Hebrew';
    const adWebsiteUrl = originalAd.campaignId?.websiteUrl || '';

    // Construct a language-appropriate prompt asking Gemini to improve the ad
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

    // Parse JSON from Gemini response, stripping markdown fences if present
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

    // Search for a background image different from the original to visually differentiate the alternative
    const currentImageId = originalAd.metadata?.lastImageUrl?.match(/photos\/(\d+)\//)?.[1];
    let newImageUrl = null;
    let attempts = 0;

    // Retry up to 3 times with progressively modified search terms to find a distinct image
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
          // Same image as original -- modify keywords for the next attempt
          console.log('      Same image - trying different search');
          newContent.image_keyword = `${searchTerm} ${['vibrant', 'professional', 'attractive'][attempts - 1]}`;
        }
      }
    }

    // Render the final ad banner image
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

    // Persist the alternative ad with "pending" status for company review
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

/**
 * Starts the recurring background checker.
 * Runs the first check after a 2-minute warm-up delay, then repeats every
 * CHECK_INTERVAL_HOURS hours.
 */
function startScheduledChecker() {
  console.log(`[LowPerformanceChecker] Starting scheduled checker (every ${CHECK_INTERVAL_HOURS} hours)`);
  console.log(`   Threshold: < ${MIN_SCANS_THRESHOLD} scans in ${DAYS_TO_CHECK} days`);

  // Initial delay (2 min) allows other services to finish initialization
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
