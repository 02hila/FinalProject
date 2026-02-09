// server/routes/adImprovement.js - Updated for multiple component selection
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendAlternativeAdEmail } = require('../services/emailService');
const axios = require('axios');
const geminiRateLimiter = require('../services/geminiRateLimiter');
const { embedQrInAd } = require('../controllers/adController');

// Import functions from server.js
let createAdDesignOnServer;
let callGeminiWithRetry;
let buildGeminiAdAndImagePrompt;
let searchPexelsImage;


function injectHelpers(helpers) {
  createAdDesignOnServer = helpers.createAdDesignOnServer;
  callGeminiWithRetry = helpers.callGeminiWithRetry;
  buildGeminiAdAndImagePrompt = helpers.buildGeminiAdAndImagePrompt;
  searchPexelsImage = helpers.searchPexelsImage;
}

/**
 * POST - Reject ad and create alternative (updated for multiple component selection)
 *
 * This endpoint handles ad rejection and generates an improved version based on company feedback.
 * It supports selective component improvement (title, text, or image) rather than regenerating everything.
 *
 * Process:
 * 1. Validates the ad exists and user has permission
 * 2. Checks AI rate limits to prevent abuse
 * 3. Saves current ad state to history for rollback
 * 4. Determines which components need improvement
 * 5. Uses AI to generate new content for selected components
 * 6. Updates the ad with improved components
 * 7. Sends notification email to agent
 *
 * @param {string} adId - The ID of the ad to reject and improve
 * @param {string} [rejectionReason] - Backwards compatibility - single reason (deprecated)
 * @param {string[]} [rejectionReasons] - Array of components to improve: ['title', 'text', 'image']
 * @param {string} rejectionDetails - Detailed feedback from the company
 * @param {boolean} [allowRevision] - Whether to allow further revisions
 *
 * @returns {Object} Response with success status, updated ad data, and email send status
 */
router.post('/reject-and-improve', authMiddleware, async (req, res) => {
  try {
    const {
      adId,
      rejectionReason,      // Backwards compatibility - single reason
      rejectionReasons,     // Array of components
      rejectionDetails,
      allowRevision
    } = req.body;

    console.log('🚫 Rejecting ad:', adId);
    console.log('📋 Rejection reasons:', rejectionReasons || rejectionReason);

    // Backwards compatibility - if we received a single rejectionReason, convert to array
    let componentsToChange = rejectionReasons;
    if (!componentsToChange && rejectionReason) {
      // Old format - all components change
      componentsToChange = ['title', 'text', 'image'];
      console.log('⚠️ Old format detected, changing all components');
    }

    // Find the ad
    const ad = await PendingAd.findById(adId)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title websiteUrl');

    if (!ad) {
      return res.status(404).json({
        success: false,
        error: 'פרסומת לא נמצאה'
      });
    }

    // Check Gemini rate limits before proceeding
    const rateLimitCheck = await geminiRateLimiter.canGenerateAd();
    if (!rateLimitCheck.allowed) {
      console.log(`⛔ Rate limit blocked: ${rateLimitCheck.errorCode}`);
      return res.status(429).json({
        success: false,
        error: rateLimitCheck.error,
        errorCode: rateLimitCheck.errorCode,
        remaining: rateLimitCheck.remaining || 0,
        waitTime: rateLimitCheck.waitTime || null
      });
    }
    console.log(`📊 Rate limit OK. Remaining: ${rateLimitCheck.remaining}/${geminiRateLimiter.DAILY_LIMIT}`);

    // Save to history
    if (!ad.history) {
      ad.history = [];
    }

    ad.history.push({
      version: ad.history.length + 1,
      title: ad.title,
      text: ad.text,
      imageData: ad.imageData,
      rejectedAt: new Date(),
      rejectionReasons: componentsToChange,
      rejectionDetails
    });

    await ad.save();
    console.log('✅ Saved to history, version:', ad.history.length);

    // Determine what needs to change
    const needsNewTitle = componentsToChange?.includes('title');
    const needsNewText = componentsToChange?.includes('text');
    const needsNewImage = componentsToChange?.includes('image');

    console.log('🔍 Components to change:', {
      title: needsNewTitle ? '✅' : '❌',
      text: needsNewText ? '✅' : '❌',
      image: needsNewImage ? '✅' : '❌'
    });

    let newTitle = ad.title;
    let newText = ad.text;
    let newCallToAction = ad.callToAction;
    let alternativeAdImage = ad.imageData;

    // Get language from metadata (default to Hebrew for backwards compatibility)
    const adLanguage = ad.metadata?.language || 'Hebrew';
    const isRTL = adLanguage === 'Hebrew' || adLanguage === 'Arabic';

    // Get website URL from campaign for QR code section decision
    const adWebsiteUrl = ad.campaignId?.websiteUrl || '';

    try {
      if (needsNewTitle || needsNewText) {
        console.log(`📝 Generating new text content in ${adLanguage}...`);

        // Build language-appropriate prompt
        const textPrompt = adLanguage === 'Hebrew' ? `
אתה מעצב פרסומות מקצועי. קיבלת משוב על פרסומת ועליך לשפר רכיבים ספציפיים.

פרטי הפרסומת המקורית:
- עסק: ${ad.metadata?.businessName || ''}
- מוצר/שירות: ${ad.metadata?.productService || ''}
- כותרת נוכחית: ${ad.title}
- טקסט נוכחי: ${ad.text}
- קריאה לפעולה: ${ad.callToAction || ''}

רכיבים שצריך לשנות:
${needsNewTitle ? '✅ כותרת - צור כותרת חדשה ומשופרת' : '❌ כותרת - השאר כמו שהיא'}
${needsNewText ? '✅ טקסט - צור טקסט חדש ומשופר' : '❌ טקסט - השאר כמו שהוא'}

משוב מהחברה:
${rejectionDetails}

צור JSON:
{
  "title": "${needsNewTitle ? 'כותרת חדשה ומשופרת (עד 10 מילים)' : ad.title}",
  "ad_text": "${needsNewText ? 'טקסט חדש ומשופר (2-3 משפטים)' : ad.text}",
  "call_to_action": "${needsNewText ? 'קריאה לפעולה משופרת (3-5 מילים)' : ad.callToAction || 'לחץ כאן'}"
}

כללים:
- ${needsNewTitle ? 'הכותרת חייבת להיות מושכת ורלוונטית' : 'השאר את הכותרת המקורית בדיוק'}
- ${needsNewText ? 'הטקסט חייב לתקן את הבעיות שצוינו' : 'השאר את הטקסט המקורי בדיוק'}
- שמור על טון ${ad.metadata?.tone || 'מקצועי'}
- כתוב בעברית בלבד
- JSON תקין בלבד
        `.trim() : `
You are a professional ad designer. You received feedback on an advertisement and need to improve specific components.

Original ad details:
- Business: ${ad.metadata?.businessName || ''}
- Product/Service: ${ad.metadata?.productService || ''}
- Current title: ${ad.title}
- Current text: ${ad.text}
- Call to action: ${ad.callToAction || ''}

Components to change:
${needsNewTitle ? '✅ Title - Create a new and improved title' : '❌ Title - Keep as is'}
${needsNewText ? '✅ Text - Create new and improved text' : '❌ Text - Keep as is'}

Company feedback:
${rejectionDetails}

Create JSON:
{
  "title": "${needsNewTitle ? 'New improved title (max 10 words)' : ad.title}",
  "ad_text": "${needsNewText ? 'New improved text (2-3 sentences)' : ad.text}",
  "call_to_action": "${needsNewText ? 'Improved call to action (3-5 words)' : ad.callToAction || 'Click here'}"
}

Rules:
- ${needsNewTitle ? 'The title must be engaging and relevant' : 'Keep the original title exactly'}
- ${needsNewText ? 'The text must address the issues mentioned' : 'Keep the original text exactly'}
- Maintain ${ad.metadata?.tone || 'professional'} tone
- Write in ${adLanguage} only
- Valid JSON only
        `.trim();

        const geminiResponse = await callGeminiWithRetry(textPrompt, 3);
        
        let geminiJson;
        try {
          let jsonString = geminiResponse.trim();
          const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
          if (fencedMatch) jsonString = fencedMatch[1];
          else {
            const braceMatch = jsonString.match(/\{[\s\S]*\}/);
            if (braceMatch) jsonString = braceMatch[0];
          }
          geminiJson = JSON.parse(jsonString);
          console.log('✅ Text content parsed:', geminiJson);

          if (needsNewTitle) {
            newTitle = geminiJson.title;
            console.log('   New title:', newTitle);
          }
          if (needsNewText) {
            newText = geminiJson.ad_text;
            newCallToAction = geminiJson.call_to_action || ad.callToAction;
            console.log('   New text length:', newText.length);
          }

        } catch (parseErr) {
          console.error('❌ JSON parsing failed:', parseErr.message);
          console.log('📄 Raw response:', geminiResponse.substring(0, 200));
          
        }
      } else {
        console.log('ℹ️ No text changes needed - keeping original');
      }

if (needsNewImage) {
  console.log('🖼️ Generating new image search query...');
  
  const currentImageUrl = ad.metadata?.lastImageUrl || null;
  const currentImageId = currentImageUrl ? currentImageUrl.match(/photos\/(\d+)\//)?.[1] : null;
  
  if (currentImageId) {
    console.log(`   📌 Current image ID: ${currentImageId} - will avoid this image`);
  }
  
  const searchPrompt = `
Generate a simple 2-3 word English search query for a high-quality professional stock photo based on:
Business: ${ad.metadata?.businessName}
Product: ${ad.metadata?.productService}
Feedback: ${rejectionDetails}
Previous search term was: ${ad.metadata?.imageKeyword || 'unknown'}
Generate a DIFFERENT search term to get different results.
Return ONLY the search terms, nothing else.`.trim();

  let imageKeyword = await callGeminiWithRetry(searchPrompt, 2).catch(() => {
    return ad.metadata?.imageKeyword || `${ad.metadata?.businessName} ${ad.metadata?.productService}`;
  });

  console.log(`🖼️ Searching Pexels for: "${imageKeyword.trim()}"`);

  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 3;
  const triedKeywords = new Set();
  
  while (!imageUrl && attempts < maxAttempts) {
    attempts++;
    const searchTerm = imageKeyword.trim();
    
    if (triedKeywords.has(searchTerm)) {
      imageKeyword = searchTerm + ' ' + ['fresh', 'natural', 'cold', 'summer'][Math.floor(Math.random() * 4)];
      continue;
    }
    triedKeywords.add(searchTerm);
    
    console.log(`   🔍 Attempt ${attempts}: "${searchTerm}"`);
    
    const foundUrl = await searchPexelsImage(
      searchTerm, 
      ad.metadata?.imageStyle || ad.metadata?.adStyle || 'professional'
    );

    if (foundUrl) {
      const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
      
      if (foundImageId && foundImageId === currentImageId) {
        console.log(`   ⚠️ Same image returned (ID: ${foundImageId}) - trying different search...`);
        imageKeyword = searchTerm + ' ' + ['glass', 'bottle', 'tropical', 'citrus'][attempts - 1];
      } else {
        imageUrl = foundUrl;
        console.log(`   ✅ Found different image (ID: ${foundImageId})`);
      }
    } else {
      console.log(`   ❌ No results for "${searchTerm}"`);
      imageKeyword = `${ad.metadata?.businessName || 'drink'} beverage`;
    }
  }

  if (imageUrl) {
    console.log('✅ Found new image, creating design...');

    ad.metadata.lastImageUrl = imageUrl;

    alternativeAdImage = await createAdDesignOnServer({
      businessName: ad.metadata?.businessName,
      adText: newText,
      title: newTitle,
      callToAction: newCallToAction,
      productService: ad.metadata?.productService,
      adStyle: ad.metadata?.adStyle || 'modern',
      imageUrl,
      agentName: ad.agentId?.fullName || 'Ads Maker',
      language: adLanguage,
      websiteUrl: adWebsiteUrl
    });

    // Preserve the original QR code if it exists
    if (ad.qrCode?.imageData) {
      console.log('   📱 Re-embedding original QR code...');
      try {
        const adBuffer = Buffer.from(alternativeAdImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const result = await embedQrInAd(adBuffer, ad.qrCode.imageData, adLanguage);
        alternativeAdImage = result.imageData;
        console.log('   ✅ QR code preserved successfully');
      } catch (qrError) {
        console.error('   ⚠️ Failed to embed QR code:', qrError.message);
      }
    }
  } else {
    console.warn('⚠️ No new image found in Pexels, keeping original design');
  }

  console.log('✅ New image process completed');
} else if (needsNewTitle || needsNewText) {
    
    console.log('🎨 Updating design with new text on existing background...');

    const existingImageUrl = ad.metadata?.lastImageUrl || ad.metadata?.imageUrl || null;

    if (existingImageUrl) {
        console.log('   ✅ Using existing background image URL:', existingImageUrl.substring(0, 80) + '...');
    } else {
        console.warn('   ⚠️ No existing background image URL found in metadata - will use gradient');
        console.log('   Available metadata keys:', Object.keys(ad.metadata || {}));
    }

      alternativeAdImage = await createAdDesignOnServer({
      businessName: ad.metadata?.businessName || ad.companyId?.companyName,
      adText: newText,
      title: newTitle,
      callToAction: newCallToAction,
      productService: ad.metadata?.productService,
      adStyle: ad.metadata?.adStyle || 'modern',
      imageUrl: existingImageUrl,  
      agentName: ad.agentId?.fullName || 'Ads Maker',
      language: adLanguage,
      websiteUrl: adWebsiteUrl
    });

    // Preserve the original QR code if it exists
    if (ad.qrCode?.imageData) {
      console.log('   📱 Re-embedding original QR code...');
      try {
        const adBuffer = Buffer.from(alternativeAdImage.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const result = await embedQrInAd(adBuffer, ad.qrCode.imageData, adLanguage);
        alternativeAdImage = result.imageData;
        console.log('   ✅ QR code preserved successfully');
      } catch (qrError) {
        console.error('   ⚠️ Failed to embed QR code:', qrError.message);
      }
    }

    console.log('✅ Design updated with new content on existing background');
}else {
        console.log('ℹ️ No changes needed - keeping original design');
      }

    } catch (aiError) {
      console.error('⚠️ AI generation failed:', aiError.message);
      console.log('   Keeping original content');
    }

    ad.title = newTitle;
    ad.text = newText;
    ad.callToAction = newCallToAction;
    ad.imageData = alternativeAdImage;
    ad.status = 'pending'; 
    ad.updatedAt = new Date();

    await ad.save();
    console.log('✅ Ad updated with new components');

    // Record successful generation for rate limiting (only if AI was used)
    if (needsNewTitle || needsNewText || needsNewImage) {
      await geminiRateLimiter.recordGeneration('improvement', ad._id?.toString());
    }

    console.log('📧 Sending email to agent...');
    const emailResult = await sendAlternativeAdEmail({
      agentEmail: ad.agentId?.email,
      agentName: ad.agentId?.fullName,
      companyName: ad.companyId?.companyName || ad.companyId?.fullName,
      rejectionReason: componentsToChange, 
      rejectionDetails,
      alternativeAdImage,
      websiteUrl: ad.campaignId?.websiteUrl || process.env.BASE_URL || 'https://adsmaker-frontend.vercel.app'
    });

    console.log(`📧 Email result: ${emailResult.success ? '✅ Sent' : '❌ Failed'}`);

    return res.json({
      success: true,
      message: 'המודעה נדחתה ופרסומת חלופית נוצרה',
      ad: {
        _id: ad._id,
        title: ad.title,
        text: ad.text,
        imageData: ad.imageData,
        status: ad.status
      },
      emailSent: emailResult.success,
      updatedComponents: componentsToChange,
      changes: {
        title: needsNewTitle ? 'שונה' : 'נשאר זהה',
        text: needsNewText ? 'שונה' : 'נשאר זהה',
        image: needsNewImage ? 'שונה' : 'נשאר זהה'
      }
    });

  } catch (error) {
    console.error('❌ Error in reject-and-improve:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת',
      details: error.message
    });
  }
});

/**
 * POST - Regenerate ad (regenerate)
 * For direct call from pendingAds route
 *
 * This endpoint provides an alternative way to trigger ad regeneration
 * by delegating to the main reject-and-improve endpoint.
 *
 * @param {string} adId - The ID of the ad to regenerate
 * @param {string[]} rejectionReasons - Array of components to improve
 * @param {string} rejectionDetails - Detailed feedback for improvement
 *
 * @returns {Object} Response from the main reject-and-improve endpoint
 */
router.post('/regenerate', authMiddleware, async (req, res) => {
  try {
    const { adId, rejectionReasons, rejectionDetails } = req.body;

    console.log('🔄 Regenerating ad:', adId);
    console.log('📋 Components to change:', rejectionReasons);

    // Call the main function
    return router.handle({
      ...req,
      body: {
        adId,
        rejectionReasons,
        rejectionDetails
      }
    }, res);

  } catch (error) {
    console.error('❌ Error in regenerate:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה ביצירת פרסומת מחדש'
    });
  }
});

/**
 * Helper function to convert rejection reason code to Hebrew text
 *
 * @param {string} reason - The rejection reason code
 * @returns {string} The Hebrew text description of the rejection reason
 */
function getRejectionReasonText(reason) {
  const reasons = {
    'not_relevant': 'לא רלוונטי למוצר/שירות',
    'poor_quality': 'איכות גרפית נמוכה',
    'wrong_message': 'המסר לא נכון',
    'target_audience': 'לא מתאים לקהל היעד',
    'brand_mismatch': 'לא מתאים למותג',
    'other': 'אחר'
  };
  return reasons[reason] || 'לא צוין';
}

/**
 * POST - Re-render ad with manual text edits (no AI)
 *
 * This endpoint allows agents to update the title and/or body text of an ad
 * without using AI. It re-renders the ad design using the original background
 * image, replacing only the specified text elements.
 *
 * IMPORTANT: This endpoint uses the ORIGINAL background image (not the rendered ad)
 * to prevent stacking of text overlays. The text is rendered fresh on the clean background.
 *
 * IMPORTANT: If the original ad had a QR code, it will be preserved exactly as-is
 * by re-embedding the same QR code image data in its original position.
 *
 * @param {string} backgroundImageUrl - The original background image URL (from metadata.lastImageUrl)
 * @param {string} title - The new title text (or original if unchanged)
 * @param {string} text - The new body text (or original if unchanged)
 * @param {string} callToAction - The CTA button text
 * @param {string} businessName - The business name
 * @param {string} productService - The product/service description
 * @param {string} adStyle - The ad style (modern, minimal, etc.)
 * @param {string} language - The language (Hebrew, Arabic, English)
 * @param {string} [websiteUrl] - Optional website URL for QR code zone
 * @param {string} [agentName] - Optional agent name for watermark
 * @param {string} [qrCodeImageData] - The original QR code image data (base64) to preserve
 *
 * @returns {Object} Response with success status and new imageData (base64)
 */
router.post('/re-render-text', authMiddleware, async (req, res) => {
  try {
    const {
      backgroundImageUrl,
      title,
      text,
      callToAction,
      businessName,
      productService,
      adStyle,
      language,
      websiteUrl,
      agentName,
      qrCodeImageData
    } = req.body;

    console.log('🎨 Re-rendering ad with manual text edits...');
    console.log('   Title:', title?.substring(0, 50) + (title?.length > 50 ? '...' : ''));
    console.log('   Text:', text?.substring(0, 50) + (text?.length > 50 ? '...' : ''));
    console.log('   Background URL:', backgroundImageUrl ? (backgroundImageUrl.substring(0, 80) + '...') : 'None (will use gradient)');
    console.log('   QR Code:', qrCodeImageData ? 'Yes (will preserve)' : 'None');

    // Validate required fields
    if (!title && !text) {
      return res.status(400).json({
        success: false,
        error: 'Title or text is required'
      });
    }

    // Re-render the ad design with the original background image and new text
    let newImageData = await createAdDesignOnServer({
      businessName: businessName || 'Business',
      adText: text || '',
      title: title || '',
      callToAction: callToAction || '',
      productService: productService || '',
      adStyle: adStyle || 'modern',
      imageUrl: backgroundImageUrl, // Use original background, NOT the rendered ad
      agentName: agentName || 'Ads Maker',
      language: language || 'Hebrew',
      websiteUrl: websiteUrl || ''
    });

    // If the original ad had a QR code, re-embed it in the same position
    if (qrCodeImageData) {
      console.log('   📱 Re-embedding original QR code...');
      try {
        // Convert base64 data URL to buffer for embedQrInAd
        const adBuffer = Buffer.from(newImageData.replace(/^data:image\/\w+;base64,/, ''), 'base64');
        const result = await embedQrInAd(adBuffer, qrCodeImageData, language || 'Hebrew');
        newImageData = result.imageData;
        console.log('   ✅ QR code preserved successfully');
      } catch (qrError) {
        console.error('   ⚠️ Failed to embed QR code:', qrError.message);
        // Continue without QR code rather than failing entirely
      }
    }

    console.log('✅ Ad re-rendered successfully with new text');

    return res.json({
      success: true,
      message: 'Ad re-rendered with updated text',
      imageData: newImageData
    });

  } catch (error) {
    console.error('❌ Error in re-render-text:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to re-render ad',
      details: error.message
    });
  }
});

module.exports = router;
module.exports.injectHelpers = injectHelpers;