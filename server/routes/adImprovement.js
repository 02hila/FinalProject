// server/routes/adImprovement.js - מעודכן לבחירה מרובה של רכיבים
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendAlternativeAdEmail } = require('../services/emailService');
const axios = require('axios');

// ✅ ייבא פונקציות מ-server.js
let createAdDesignOnServer;
let callGeminiWithRetry;
let buildGeminiAdAndImagePrompt;
let searchPexelsImage;

// ✅ הזרקת פונקציות מ-server.js
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
      rejectionReasons,     // 🆕 מערך של רכיבים
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

    // 1️⃣ מצא את הפרסומת
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

    // 2️⃣ שמור בהיסטוריה
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

    // 3️⃣ קבע מה צריך לשנות
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
    
    try {
      // 4️⃣ יצירת טקסט חדש (כותרת/תוכן) אם נדרש
      if (needsNewTitle || needsNewText) {
        console.log('📝 Generating new text content...');
        
        const textPrompt = `
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
- JSON תקין בלבד
        `.trim();

        const geminiResponse = await callGeminiWithRetry(textPrompt, 3, 'gemini-2.5-flash');
        
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

    // 5️⃣ יצירת תמונה חדשה אם נדרש
    if (needsNewImage) {
      console.log('🖼️ Generating new image search query...');
      
      // ✅ שימוש ב-AI כדי למצוא מילת חיפוש טובה יותר באנגלית
      const searchPrompt = `
Generate a simple 2-3 word English search query for a high-quality professional stock photo based on:
Business: ${ad.metadata?.businessName}
Product: ${ad.metadata?.productService}
Feedback: ${rejectionDetails}
Return ONLY the search terms.`.trim();

      const imageKeyword = await callGeminiWithRetry(searchPrompt, 2, 'gemini-2.5-flash').catch(() => {
        return ad.metadata?.imageKeyword || `${ad.metadata?.businessName} ${ad.metadata?.productService}`;
      });

      console.log(`🖼️ Searching Pexels for: "${imageKeyword}"`);

      const imageUrl = await searchPexelsImage(
        imageKeyword.trim(), 
        ad.metadata?.imageStyle || ad.metadata?.adStyle || 'professional'
      );

      if (imageUrl) {
        console.log('✅ Found new image, creating design...');
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl,
          agentName: ad.agentId?.fullName || 'Ads Maker'
        });
      } else {
        console.warn('⚠️ No new image found in Pexels, updating design on old background');
        // ננסה לפחות לעדכן את הטקסט על התמונה הקיימת
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl: ad.metadata?.lastImageUrl,
          agentName: ad.agentId?.fullName || 'Ads Maker'
        });
      }
      
      console.log('✅ New image process completed');
    } else if (needsNewTitle || needsNewText) {
    console.log('🎨 Updating design with new text on existing background...');
    
    // ✅ FIX: חיפוש מורחב של URL התמונה המקורית
    const existingImageUrl = ad.metadata?.lastImageUrl 
                          || ad.metadata?.imageUrl 
                          || ad.metadata?.originalImageUrl
                          || null;
    
    if (!existingImageUrl) {
        console.warn('⚠️ No background image URL found - will use gradient fallback');
        console.log('   Available metadata keys:', Object.keys(ad.metadata || {}));
    }
        if (existingImageUrl) {
            console.log('   Using existing background image URL:', existingImageUrl);
        } else {
            console.warn('   ⚠️ No existing background image URL found in metadata');
        }
        
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName || ad.companyId?.companyName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl: existingImageUrl, // השתמש בתמונה הקיימת
          agentName: ad.agentId?.fullName || 'Ads Maker'
        });
        
        console.log('✅ Design updated with new content on existing background');
    } else {
        console.log('ℹ️ No changes needed - keeping original design');
      }

    } catch (aiError) {
      console.error('⚠️ AI generation failed:', aiError.message);
      console.log('   Keeping original content');
    }

    // 6️⃣ עדכן את הפרסומת
    ad.title = newTitle;
    ad.text = newText;
    ad.callToAction = newCallToAction;
    ad.imageData = alternativeAdImage;
    ad.status = 'pending'; // חזרה לסטטוס ממתין לאישור
    ad.updatedAt = new Date();

    await ad.save();
    console.log('✅ Ad updated with new components');

    // 7️⃣ שליחת מייל לסוכן
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

// ✅ פונקציית עזר להמרת סיבת דחייה
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