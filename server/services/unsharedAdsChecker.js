/**
 * Unshared Ads Checker
 *
 * A scheduled background service that identifies approved ads that agents have not shared
 * within a configurable time window after approval. For each qualifying ad, the checker
 * sends a reminder email to the agent and automatically generates an improved alternative
 * ad using Gemini AI and Pexels imagery, saving it in "pending" status for company approval.
 *
 * Key exports:
 *  - checkUnsharedAds -- runs one check cycle (can also be triggered manually)
 *  - startScheduledChecker -- starts the recurring interval timer
 *  - injectHelpers -- receives references to createAdDesignOnServer, callGeminiWithRetry,
 *                     and searchPexelsImage (avoids circular dependency with other services)
 *  - DAYS_BEFORE_REMINDER -- tunable constant for days before sending reminder
 *
 * Called by:
 *  - Server startup (startScheduledChecker is called during boot)
 *  - Admin routes (optional manual trigger via checkUnsharedAds)
 *
 * Depends on:
 *  - PendingAd and QRScan Mongoose models
 *  - geminiRateLimiter (to respect daily generation quotas)
 *  - emailService (sendUnsharedAdReminderEmail, sendAlternativeAdCreatedToCompanyEmail)
 *  - Injected helpers: createAdDesignOnServer (canvasService), callGeminiWithRetry (geminiService),
 *    searchPexelsImage (pexelsService)
 */
const PendingAd = require('../models/PendingAd');
const {
  sendAlternativeAdCreatedToCompanyEmail,
  sendUnsharedAdReminderEmail
} = require('./emailService');
const geminiRateLimiter = require('./geminiRateLimiter');

const DAYS_BEFORE_REMINDER = 5;
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

async function checkUnsharedAds() {
  console.log('[UnsharedAdsChecker] Starting check...');
  console.log(`   Looking for ads approved ${DAYS_BEFORE_REMINDER}+ days ago that weren't shared`);

  try {
    const reminderThreshold = new Date();
    reminderThreshold.setDate(reminderThreshold.getDate() - DAYS_BEFORE_REMINDER);

    const unsharedAds = await PendingAd.find({
      status: 'approved',
      isAlternative: { $ne: true },
      'shareTracking.alternativeCreated': { $ne: true },
      $and: [
        {
          $or: [
            { 'shareTracking.approvedAt': { $lte: reminderThreshold } },
            {
              'shareTracking.approvedAt': { $exists: false },
              updatedAt: { $lte: reminderThreshold }
            }
          ]
        },
        {
          $or: [
            { 'shareTracking.shareCount': { $exists: false } },
            { 'shareTracking.shareCount': 0 }
          ]
        }
      ]
    })
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName email')
      .populate('campaignId', 'title websiteUrl')
      .limit(MAX_ADS_PER_CHECK);

    console.log(`Found ${unsharedAds.length} unshared ads to process`);

    if (unsharedAds.length === 0) {
      console.log('No unshared ads found - all good!');
      return { processed: 0 };
    }

    let processed = 0;
    let errors = 0;

    for (const ad of unsharedAds) {
      try {
        const approvedAt = ad.shareTracking?.approvedAt || ad.updatedAt;
        const daysSinceApproval = Math.floor((Date.now() - new Date(approvedAt).getTime()) / (1000 * 60 * 60 * 24));

        console.log(`\nProcessing ad: ${ad._id} (${ad.title})`);
        console.log(`   Agent: ${ad.agentId?.fullName || 'Unknown'}`);
        console.log(`   Company: ${ad.companyId?.companyName || ad.companyId?.fullName || 'Unknown'}`);
        console.log(`   Days since approval: ${daysSinceApproval}`);

        if (daysSinceApproval < DAYS_BEFORE_REMINDER) {
          console.log(`   Skipping - only ${daysSinceApproval} days passed (need ${DAYS_BEFORE_REMINDER})`);
          continue;
        }

        const agentEmail = ad.agentId?.email;
        if (agentEmail) {
          console.log(`   Sending reminder to agent: ${agentEmail}`);
          try {
            await sendUnsharedAdReminderEmail({
              agentEmail,
              agentName: ad.agentId?.fullName || 'Agent',
              companyName: ad.companyId?.companyName || ad.companyId?.fullName || 'Company',
              adTitle: ad.title,
              daysSinceApproval,
              hasAlternative: false
            });
            console.log('   Reminder sent to agent');
          } catch (emailError) {
            console.error('   Agent email failed:', emailError.message);
          }
        }

        let alternativeAd = null;

        if (createAdDesignOnServer && callGeminiWithRetry && searchPexelsImage) {
          const rateLimitResult = await geminiRateLimiter.waitUntilAllowed();
          if (!rateLimitResult.allowed) {
            console.log(`   Rate limit: ${rateLimitResult.error}`);
            console.log('   Skipping alternative creation due to rate limit');
          } else {
            console.log('   Creating alternative ad (pending approval)...');
            alternativeAd = await createAlternativeAd(ad);
          }
        } else {
          console.log('   Helper functions not available - skipping alternative creation');
        }

        if (alternativeAd) {
          ad.shareTracking = ad.shareTracking || {};
          ad.shareTracking.alternativeCreated = true;
          ad.shareTracking.alternativeAdId = alternativeAd._id;
          ad.shareTracking.alternativeCreatedAt = new Date();
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
                reason: 'unshared',
                currentScans: 0
              });
              console.log('   Email sent to company');
            } catch (emailError) {
              console.error('   Company email failed:', emailError.message);
            }
          } else {
            console.log('   No company email found - skipping notification');
          }

          if (agentEmail) {
            try {
              await sendUnsharedAdReminderEmail({
                agentEmail,
                agentName: ad.agentId?.fullName || 'Agent',
                companyName: ad.companyId?.companyName || ad.companyId?.fullName || 'Company',
                adTitle: ad.title,
                daysSinceApproval,
                hasAlternative: true
              });
            } catch (e) {
              // Non-critical
            }
          }
        }

        console.log('   Ad processed successfully');
        console.log(`      Alternative: ${alternativeAd ? 'Created (pending company approval)' : 'Not created'}`);

        processed++;

      } catch (adError) {
        console.error(`   Error processing ad ${ad._id}:`, adError.message);
        errors++;
      }

      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_ADS_MS));
    }

    console.log('\n[UnsharedAdsChecker] Completed:');
    console.log(`   Processed: ${processed}`);
    console.log(`   Errors: ${errors}`);

    return { processed, errors };

  } catch (error) {
    console.error('[UnsharedAdsChecker] Critical error:', error);
    return { processed: 0, errors: 1, criticalError: error.message };
  }
}

async function createAlternativeAd(originalAd) {
  try {
    const adLanguage = originalAd.metadata?.language || 'Hebrew';
    const adWebsiteUrl = originalAd.campaignId?.websiteUrl || '';

    const textPrompt = adLanguage === 'Hebrew' ? `
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
- כתוב בעברית בלבד
- JSON תקין בלבד
    `.trim() : `
You are a professional ad designer. Create a new and different version of an existing ad.

Original ad details:
- Business: ${originalAd.metadata?.businessName || ''}
- Product/Service: ${originalAd.metadata?.productService || ''}
- Current title: ${originalAd.title}
- Current text: ${originalAd.text}

Create a completely different version - different title, different wording, different marketing angle.

Create JSON:
{
  "title": "Completely new and different title (max 10 words)",
  "ad_text": "New text with a different marketing approach (2-3 sentences)",
  "call_to_action": "New call to action (3-5 words)",
  "image_keyword": "2-3 English words for a different image search"
}

Rules:
- The title and text must be completely different from the original
- Maintain ${originalAd.metadata?.tone || 'professional'} tone
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
      const searchTerm = newContent.image_keyword || `${originalAd.metadata?.businessName} alternative`;
      console.log(`      Searching for image: "${searchTerm}" (attempt ${attempts})`);

      const foundUrl = await searchPexelsImage(searchTerm, originalAd.metadata?.imageStyle);

      if (foundUrl) {
        const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
        if (foundImageId !== currentImageId) {
          newImageUrl = foundUrl;
          console.log('      Found different image');
        } else {
          console.log('      Same image - trying different search');
          newContent.image_keyword = `${searchTerm} ${['fresh', 'new', 'modern'][attempts - 1]}`;
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
        createdReason: 'unshared_auto_alternative',
        originalAdTitle: originalAd.title
      }
    });

    await alternativeAd.save();
    console.log(`      Alternative ad saved (PENDING approval): ${alternativeAd._id}`);

    await geminiRateLimiter.recordGeneration('unshared', alternativeAd._id?.toString());

    return alternativeAd;

  } catch (error) {
    console.error('      Error creating alternative ad:', error.message);
    return null;
  }
}

function startScheduledChecker() {
  console.log(`[UnsharedAdsChecker] Starting scheduled checker (every ${CHECK_INTERVAL_HOURS} hours)`);
  console.log(`   Will check ads approved ${DAYS_BEFORE_REMINDER}+ days ago`);

  setTimeout(() => {
    checkUnsharedAds();
  }, 60000);

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
