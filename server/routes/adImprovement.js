// server/routes/adImprovement.js - מעודכן לבחירה מרובה של רכיבים
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendAlternativeAdEmail } = require('../services/emailService');
const axios = require('axios');
const geminiRateLimiter = require('../services/geminiRateLimiter');

//  ייבא פונקציות מ-server.js
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

/* ==========================================
   POST - דחיית פרסומת + יצירת חלופה (מעודכן לבחירה מרובה)
   ========================================== */
router.post('/reject-and-improve', authMiddleware, async (req, res) => {
  try {
    const { 
      adId, 
      rejectionReason,      // תמיכה לאחור - סיבה בודדת
      rejectionReasons,     //  מערך של רכיבים
      rejectionDetails, 
      allowRevision 
    } = req.body;

    console.log('🚫 Rejecting ad:', adId);
    console.log('📋 Rejection reasons:', rejectionReasons || rejectionReason);

    // תמיכה לאחור - אם קיבלנו rejectionReason בודד, נמיר למערך
    let componentsToChange = rejectionReasons;
    if (!componentsToChange && rejectionReason) {
      // פורמט ישן - כל הרכיבים משתנים
      componentsToChange = ['title', 'text', 'image'];
      console.log('⚠️ Old format detected, changing all components');
    }

    //  מצא את הפרסומת
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

    //  Check Gemini rate limits before proceeding
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

    //  שמור בהיסטוריה
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

    //  קבע מה צריך לשנות
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
      //  יצירת טקסט חדש (כותרת/תוכן) אם נדרש
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
          // נשאיר את הערכים המקוריים
        }
      } else {
        console.log('ℹ️ No text changes needed - keeping original');
      }

//  יצירת תמונה חדשה אם נדרש
if (needsNewImage) {
  console.log('🖼️ Generating new image search query...');
  
  //  שמור את ה-URL של התמונה הנוכחית כדי לוודא שנקבל תמונה שונה
  const currentImageUrl = ad.metadata?.lastImageUrl || null;
  const currentImageId = currentImageUrl ? currentImageUrl.match(/photos\/(\d+)\//)?.[1] : null;
  
  if (currentImageId) {
    console.log(`   📌 Current image ID: ${currentImageId} - will avoid this image`);
  }
  
  //  שימוש ב-AI כדי למצוא מילת חיפוש טובה יותר באנגלית
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

  //  חיפוש תמונה חדשה עם לוגיקה למניעת כפילות
  let imageUrl = null;
  let attempts = 0;
  const maxAttempts = 3;
  const triedKeywords = new Set();
  
  while (!imageUrl && attempts < maxAttempts) {
    attempts++;
    const searchTerm = imageKeyword.trim();
    
    if (triedKeywords.has(searchTerm)) {
      // נוסיף מילה אקראית לחיפוש
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
      // בדוק שזו לא אותה תמונה
      const foundImageId = foundUrl.match(/photos\/(\d+)\//)?.[1];
      
      if (foundImageId && foundImageId === currentImageId) {
        console.log(`   ⚠️ Same image returned (ID: ${foundImageId}) - trying different search...`);
        // נשנה את מילות החיפוש
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
    
    //  עדכון ה-metadata עם ה-URL החדש
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
  } else {
    console.warn('⚠️ No new image found in Pexels, keeping original design');
    // לא משנים את התמונה אם לא מצאנו תמונה שונה
  }

  console.log('✅ New image process completed');
} else if (needsNewTitle || needsNewText) {
    // אם שינינו טקסט/כותרת אבל לא תמונה,
    // נצור מחדש את העיצוב עם התוכן המעודכן על אותה תמונה רקע
    console.log('🎨 Updating design with new text on existing background...');

    //  חיפוש ה-URL של התמונה המקורית
    const existingImageUrl = ad.metadata?.lastImageUrl || ad.metadata?.imageUrl || null;

    if (existingImageUrl) {
        console.log('   ✅ Using existing background image URL:', existingImageUrl.substring(0, 80) + '...');
    } else {
        console.warn('   ⚠️ No existing background image URL found in metadata - will use gradient');
        console.log('   Available metadata keys:', Object.keys(ad.metadata || {}));
    }

    //  יצירת עיצוב עם התמונה הקיימת (או gradient אם אין)
    alternativeAdImage = await createAdDesignOnServer({
      businessName: ad.metadata?.businessName || ad.companyId?.companyName,
      adText: newText,
      title: newTitle,
      callToAction: newCallToAction,
      productService: ad.metadata?.productService,
      adStyle: ad.metadata?.adStyle || 'modern',
      imageUrl: existingImageUrl,  //  משתמש בתמונה הקיימת בלבד
      agentName: ad.agentId?.fullName || 'Ads Maker',
      language: adLanguage,
      websiteUrl: adWebsiteUrl
    });
    
    console.log('✅ Design updated with new content on existing background');
}else {
        console.log('ℹ️ No changes needed - keeping original design');
      }

    } catch (aiError) {
      console.error('⚠️ AI generation failed:', aiError.message);
      console.log('   Keeping original content');
    }

    //  עדכן את הפרסומת
    ad.title = newTitle;
    ad.text = newText;
    ad.callToAction = newCallToAction;
    ad.imageData = alternativeAdImage;
    ad.status = 'pending'; // חזרה לסטטוס ממתין לאישור
    ad.updatedAt = new Date();

    await ad.save();
    console.log('✅ Ad updated with new components');

    // Record successful generation for rate limiting (only if AI was used)
    if (needsNewTitle || needsNewText || needsNewImage) {
      await geminiRateLimiter.recordGeneration('improvement', ad._id?.toString());
    }

    // שליחת מייל לסוכן
    console.log('📧 Sending email to agent...');
    const emailResult = await sendAlternativeAdEmail({
      agentEmail: ad.agentId?.email,
      agentName: ad.agentId?.fullName,
      companyName: ad.companyId?.companyName || ad.companyId?.fullName,
      rejectionReason: componentsToChange, // שולח את המערך
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

/* ==========================================
   POST - יצירת פרסומת מחדש (regenerate)
   עבור קריאה ישירה מ-pendingAds route
   ========================================== */
router.post('/regenerate', authMiddleware, async (req, res) => {
  try {
    const { adId, rejectionReasons, rejectionDetails } = req.body;

    console.log('🔄 Regenerating ad:', adId);
    console.log('📋 Components to change:', rejectionReasons);

    // קריאה לפונקציה הראשית
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

//  פונקציית עזר להמרת סיבת דחייה
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

module.exports = router;
module.exports.injectHelpers = injectHelpers;