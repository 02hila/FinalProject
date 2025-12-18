// server/routes/adImprovement.js - ✅ FIXED VERSION - מעודכן לבחירה מרובה של רכיבים
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
  console.log('✅ Helpers injected into adImprovement router');
}

/* ==========================================
   POST - דחיית פרסומת + יצירת חלופה (מעודכן לבחירה מרובה)
   ========================================== */
router.post('/reject-and-improve', authMiddleware, async (req, res) => {
  console.log('🔵 /api/ad-improvement/reject-and-improve called');
  
  try {
    const { 
      adId, 
      rejectionReason,      // תמיכה לאחור - סיבה בודדת
      rejectionReasons,     // 🆕 מערך של רכיבים
      rejectionDetails, 
      allowRevision 
    } = req.body;

    console.log('🚫 Rejecting ad:', adId);
    console.log('📋 Rejection reasons received:', rejectionReasons || rejectionReason);
    console.log('📝 Rejection details:', rejectionDetails);

    // תמיכה לאחור - אם קיבלנו rejectionReason בודד, נמיר למערך
    let componentsToChange = rejectionReasons;
    if (!componentsToChange && rejectionReason) {
      // פורמט ישן - כל הרכיבים משתנים
      componentsToChange = ['title', 'text', 'image'];
      console.log('⚠️ Old format detected, changing all components');
    }

    if (!componentsToChange || componentsToChange.length === 0) {
      console.error('❌ No components to change!');
      return res.status(400).json({
        success: false,
        error: 'חובה לבחור לפחות רכיב אחד לשינוי'
      });
    }

    // 1️⃣ מצא את הפרסומת
    console.log('🔍 Loading ad from database...');
    const ad = await PendingAd.findById(adId)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title websiteUrl');

    if (!ad) {
      console.error('❌ Ad not found:', adId);
      return res.status(404).json({ 
        success: false, 
        error: 'פרסומת לא נמצאה' 
      });
    }

    console.log('✅ Ad loaded:', ad.title);
    console.log('   Agent:', ad.agentId?.fullName, '(' + ad.agentId?.email + ')');
    console.log('   Company:', ad.companyId?.companyName || ad.companyId?.fullName);

    // 2️⃣ שמור בהיסטוריה
    console.log('💾 Saving to history...');
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
      title: needsNewTitle ? '✅ YES' : '❌ NO',
      text: needsNewText ? '✅ YES' : '❌ NO',
      image: needsNewImage ? '✅ YES' : '❌ NO'
    });

    let newTitle = ad.title;
    let newText = ad.text;
    let newCallToAction = ad.callToAction;
    let alternativeAdImage = ad.imageData;
    
    try {
      // 4️⃣ יצירת טקסט חדש (כותרת/תוכן) אם נדרש
      if (needsNewTitle || needsNewText) {
        console.log('📝 Generating new text content with Gemini...');
        
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

        console.log('🤖 Calling Gemini API...');
        const geminiResponse = await callGeminiWithRetry(textPrompt, 3, 'gemini-2.5-flash');
        console.log('✅ Gemini responded');
        
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
          console.log('✅ Text content parsed successfully');

          if (needsNewTitle) {
            newTitle = geminiJson.title;
            console.log('   ✅ New title:', newTitle.substring(0, 50) + '...');
          }
          if (needsNewText) {
            newText = geminiJson.ad_text;
            newCallToAction = geminiJson.call_to_action || ad.callToAction;
            console.log('   ✅ New text length:', newText.length, 'chars');
            console.log('   ✅ New CTA:', newCallToAction);
          }

        } catch (parseErr) {
          console.error('❌ JSON parsing failed:', parseErr.message);
          console.log('📄 Raw response (first 200 chars):', geminiResponse.substring(0, 200));
          // נשאיר את הערכים המקוריים
          console.log('⚠️ Keeping original text content');
        }
      } else {
        console.log('ℹ️ No text changes needed - keeping original');
      }

      // 5️⃣ יצירת תמונה חדשה אם נדרש
      if (needsNewImage) {
        console.log('🖼️ Generating new image...');

        const imageKeyword = ad.metadata?.imageKeyword || `${ad.metadata?.businessName} ${ad.metadata?.productService}`;
        console.log('   Search keyword:', imageKeyword);
        
        const imageUrl = await searchPexelsImage(
          imageKeyword, 
          ad.metadata?.imageStyle || ad.metadata?.adStyle
        );
        console.log('   Image URL:', imageUrl ? 'Found' : 'Using gradient');

        console.log('🎨 Creating ad design with new image...');
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

        console.log('✅ New image created successfully');
      } else if (needsNewTitle || needsNewText) {
        // אם שינינו טקסט/כותרת אבל לא תמונה, 
        // נצור מחדש את העיצוב עם התוכן המעודכן על אותה תמונה רקע
        console.log('🎨 Updating design with new text on existing background...');
        
        // ננסה להשתמש באותה תמונת רקע
        const existingImageUrl = ad.metadata?.lastImageUrl || null;
        
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl: existingImageUrl, // אותה תמונה
          agentName: ad.agentId?.fullName || 'Ads Maker'
        });
        
        console.log('✅ Design updated with new content on existing background');
      } else {
        console.log('ℹ️ No changes needed - keeping original design');
      }

    } catch (aiError) {
      console.error('⚠️ AI generation failed:', aiError.message);
      console.error('   Stack:', aiError.stack);
      console.log('   Keeping original content due to error');
    }

    // 6️⃣ עדכן את הפרסומת
    console.log('💾 Updating ad in database...');
    ad.title = newTitle;
    ad.text = newText;
    ad.callToAction = newCallToAction;
    ad.imageData = alternativeAdImage;
    ad.status = 'pending'; // חזרה לסטטוס ממתין לאישור
    ad.updatedAt = new Date();

    await ad.save();
    console.log('✅ Ad updated successfully in database');

    // 7️⃣ שליחת מייל לסוכן
    console.log('📧 Preparing to send email to agent...');
    console.log('   Agent email:', ad.agentId?.email);
    console.log('   Agent name:', ad.agentId?.fullName);
    console.log('   Company name:', ad.companyId?.companyName || ad.companyId?.fullName);
    
    let emailResult = { success: false, error: 'Not attempted' };
    
    if (ad.agentId?.email) {
      try {
        console.log('📧 Calling sendAlternativeAdEmail...');
        emailResult = await sendAlternativeAdEmail({
          agentEmail: ad.agentId.email,
          agentName: ad.agentId.fullName,
          companyName: ad.companyId?.companyName || ad.companyId?.fullName,
          rejectionReason: componentsToChange, // שולח את המערך
          rejectionDetails,
          alternativeAdImage,
          websiteUrl: ad.campaignId?.websiteUrl || process.env.BASE_URL || 'https://adsmaker-frontend.vercel.app'
        });
        
        if (emailResult.success) {
          console.log('✅ Email sent successfully!');
          console.log('   Message ID:', emailResult.messageId);
        } else {
          console.error('❌ Email sending failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Exception while sending email:', emailError.message);
        console.error('   Stack:', emailError.stack);
        emailResult = { success: false, error: emailError.message };
      }
    } else {
      console.warn('⚠️ No agent email available - cannot send email');
      emailResult = { success: false, error: 'No agent email' };
    }

    // 8️⃣ החזר תשובה
    console.log('✅ Request completed successfully');
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
      emailError: emailResult.success ? null : emailResult.error,
      updatedComponents: componentsToChange,
      changes: {
        title: needsNewTitle ? 'שונה' : 'נשאר זהה',
        text: needsNewText ? 'שונה' : 'נשאר זהה',
        image: needsNewImage ? 'שונה' : 'נשאר זהה'
      }
    });

  } catch (error) {
    console.error('❌ CRITICAL ERROR in reject-and-improve:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
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

// ✅ FIX: Export both router and injectHelpers correctly
router.injectHelpers = injectHelpers;
module.exports = router;