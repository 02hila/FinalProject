// server/routes/adImprovement.js - ✅ FIXED VERSION - תמונות עובדות!
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
   POST - דחיית פרסומת + יצירת חלופה
   ========================================== */
router.post('/reject-and-improve', authMiddleware, async (req, res) => {
  console.log('🔵 /api/ad-improvement/reject-and-improve called');
  
  try {
    const { 
      adId, 
      rejectionReason,      // תמיכה לאחור
      rejectionReasons,     // 🆕 מערך של רכיבים
      rejectionDetails
    } = req.body;

    console.log('🚫 Rejecting ad:', adId);
    console.log('📋 Rejection reasons:', rejectionReasons || rejectionReason);
    console.log('📝 Details:', rejectionDetails);

    // תמיכה לאחור
    let componentsToChange = rejectionReasons;
    if (!componentsToChange && rejectionReason) {
      componentsToChange = ['title', 'text', 'image'];
      console.log('⚠️ Old format detected, changing all components');
    }

    if (!componentsToChange || componentsToChange.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'חובה לבחור לפחות רכיב אחד'
      });
    }

    // 1️⃣ טען פרסומת
    console.log('🔍 Loading ad from database...');
    const ad = await PendingAd.findById(adId)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title websiteUrl');

    if (!ad) {
      console.error('❌ Ad not found');
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    console.log('✅ Ad loaded:', ad.title);
    console.log('   Agent:', ad.agentId?.fullName, '(' + ad.agentId?.email + ')');
    console.log('   Company:', ad.companyId?.companyName || ad.companyId?.fullName);

    // 2️⃣ שמור בהיסטוריה
    console.log('💾 Saving to history...');
    if (!ad.history) ad.history = [];
    
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

    // 3️⃣ קבע מה לשנות
    const needsNewTitle = componentsToChange.includes('title');
    const needsNewText = componentsToChange.includes('text');
    const needsNewImage = componentsToChange.includes('image');

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
      // 4️⃣ טקסט חדש אם נדרש
      if (needsNewTitle || needsNewText) {
        console.log('📝 Generating new text...');
        
        const textPrompt = `אתה מעצב פרסומות מקצועי. תיקן רק את הרכיבים שמסומנים:

פרסומת מקורית:
- עסק: ${ad.metadata?.businessName}
- מוצר: ${ad.metadata?.productService}
- כותרת: ${ad.title}
- טקסט: ${ad.text}
- CTA: ${ad.callToAction}

רכיבים לשינוי:
${needsNewTitle ? '✅ כותרת - צור כותרת חדשה' : '❌ כותרת - השאר זהה'}
${needsNewText ? '✅ טקסט - צור טקסט חדש' : '❌ טקסט - השאר זהה'}

משוב: ${rejectionDetails}

החזר JSON:
{
  "title": "${needsNewTitle ? 'כותרת חדשה (10 מילים מקס)' : ad.title}",
  "ad_text": "${needsNewText ? 'טקסט חדש (2-3 משפטים)' : ad.text}",
  "call_to_action": "${needsNewText ? 'CTA חדש (3-5 מילים)' : ad.callToAction}"
}`;

        const geminiResponse = await callGeminiWithRetry(textPrompt, 3, 'gemini-2.5-flash');
        console.log('✅ Gemini responded');
        
        try {
          let jsonString = geminiResponse.trim();
          const match = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i) || jsonString.match(/\{[\s\S]*\}/);
          if (match) jsonString = match[1] || match[0];
          
          const geminiJson = JSON.parse(jsonString);
          console.log('✅ Text parsed');

          if (needsNewTitle && geminiJson.title) {
            newTitle = geminiJson.title;
            console.log('   ✅ New title:', newTitle.substring(0, 50) + '...');
          }
          if (needsNewText && geminiJson.ad_text) {
            newText = geminiJson.ad_text;
            newCallToAction = geminiJson.call_to_action || ad.callToAction;
            console.log('   ✅ New text:', newText.length, 'chars');
          }
        } catch (parseErr) {
          console.error('❌ Parse failed:', parseErr.message);
          console.log('   Using original content');
        }
      } else {
        console.log('ℹ️ No text changes needed');
      }

      // 5️⃣ תמונה חדשה אם נדרש - ✅ FIX!
      if (needsNewImage) {
        console.log('🖼️ Generating new image...');
        
        // קביעת מילת חיפוש
        let imageKeyword = ad.metadata?.imageKeyword || `${ad.metadata?.businessName} ${ad.metadata?.productService}`;
        
        // אם יש פידבק ספציפי, ננסה לשפר
        if (rejectionDetails && rejectionDetails.length > 10) {
          try {
            const searchPrompt = `עבור עסק "${ad.metadata?.businessName}" (${ad.metadata?.productService}), עם פידבק: "${rejectionDetails}"
החזר 2-4 מילים באנגלית לחיפוש תמונה ב-stock photos. רק את מילות החיפוש, ללא הסבר.`;
            
            const aiKeyword = await callGeminiWithRetry(searchPrompt, 2, 'gemini-2.5-flash');
            if (aiKeyword && aiKeyword.length > 3 && aiKeyword.length < 50) {
              imageKeyword = aiKeyword.trim().replace(/["'`]/g, '');
              console.log(`   AI keyword: "${imageKeyword}"`);
            }
          } catch (err) {
            console.log('   AI keyword failed, using default');
          }
        }

        console.log(`   🔍 Searching: "${imageKeyword}"`);
        const imageUrl = await searchPexelsImage(
          imageKeyword, 
          ad.metadata?.imageStyle || 'professional'
        );

        // ✅ צור עיצוב חדש עם התמונה החדשה
        console.log('🎨 Creating design...');
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl: imageUrl || null, // null = gradient
          agentName: ad.agentId?.fullName
        });
        
        console.log('✅ New image created:', imageUrl ? 'with photo' : 'with gradient');
        
      } else if (needsNewTitle || needsNewText) {
        // עדכן טקסט על רקע קיים
        console.log('🎨 Updating text on existing background...');
        
        alternativeAdImage = await createAdDesignOnServer({
          businessName: ad.metadata?.businessName,
          adText: newText,
          title: newTitle,
          callToAction: newCallToAction,
          productService: ad.metadata?.productService,
          adStyle: ad.metadata?.adStyle || 'modern',
          imageUrl: ad.metadata?.lastImageUrl || null,
          agentName: ad.agentId?.fullName
        });
        
        console.log('✅ Design updated');
      } else {
        console.log('ℹ️ No changes - keeping original');
      }

    } catch (aiError) {
      console.error('⚠️ AI failed:', aiError.message);
      console.log('   Keeping original content');
    }

    // 6️⃣ עדכן במסד נתונים
    console.log('💾 Updating database...');
    ad.title = newTitle;
    ad.text = newText;
    ad.callToAction = newCallToAction;
    ad.imageData = alternativeAdImage;
    ad.status = 'pending';
    ad.updatedAt = new Date();

    await ad.save();
    console.log('✅ Saved to database');

    // 7️⃣ שלח מייל
    console.log('📧 Sending email...');
    console.log('   To:', ad.agentId?.email);
    
    let emailResult = { success: false, error: 'Not sent' };
    
    if (ad.agentId?.email) {
      try {
        emailResult = await sendAlternativeAdEmail({
          agentEmail: ad.agentId.email,
          agentName: ad.agentId.fullName,
          companyName: ad.companyId?.companyName || ad.companyId?.fullName,
          rejectionReason: componentsToChange,
          rejectionDetails,
          alternativeAdImage,
          websiteUrl: ad.campaignId?.websiteUrl || 'https://adsmaker-rho.vercel.app'
        });
        
        if (emailResult.success) {
          console.log('✅ Email sent successfully!');
          console.log('   Message ID:', emailResult.messageId);
        } else {
          console.error('❌ Email failed:', emailResult.error);
        }
      } catch (emailError) {
        console.error('❌ Email exception:', emailError.message);
        emailResult = { success: false, error: emailError.message };
      }
    } else {
      console.warn('⚠️ No agent email');
    }

    // 8️⃣ החזר תשובה
    console.log('✅ Complete!');
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
    console.error('❌ CRITICAL ERROR:', error);
    console.error('   Message:', error.message);
    console.error('   Stack:', error.stack);
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת',
      details: error.message
    });
  }
});

// ✅ Export
router.injectHelpers = injectHelpers;
module.exports = router;