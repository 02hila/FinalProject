// server/routes/adImprovement.js
const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');
const { sendAlternativeAdEmail } = require('../services/emailService');
const axios = require('axios');

// ✅ ייבא פונקציות מ-server.js (נוסיף אותן בהמשך)
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
   POST - דחיית פרסומת + יצירת חלופה
   ========================================== */
router.post('/reject-and-improve', authMiddleware, async (req, res) => {
  try {
    const { 
      adId, 
      rejectionReason, 
      rejectionDetails, 
      allowRevision 
    } = req.body;

    console.log('🚫 Rejecting ad:', adId);

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

    // 2️⃣ שמור דחייה בהיסטוריה
    ad.addRejection({
      reason: rejectionReason,
      details: rejectionDetails,
      rejectedBy: req.userId,
      notes: `דחייה על ידי ${req.user?.fullName || 'חברה'}`
    });

    await ad.save();
    console.log('✅ Rejection saved to history');

    // 3️⃣ יצירת פרסומת חלופית משופרת
    console.log('🤖 Generating improved ad...');
    
    let alternativeAdImage = null;
    
    try {
      // בניית פרומפט משופר עם משוב
      const improvementPrompt = `
אתה מעצב פרסומות מקצועי. קיבלת משוב על פרסומת שנדחתה ועליך ליצור גרסה משופרת.

המידע המקורי:
- עסק: ${ad.metadata?.businessName || ''}
- מוצר/שירות: ${ad.metadata?.productService || ''}
- טקסט מקורי: ${ad.text}

המשוב שהתקבל:
- סיבת דחייה: ${getRejectionReasonText(rejectionReason)}
- פירוט: ${rejectionDetails}

צור JSON עם פרסומת משופרת שמתייחסת למשוב:
{
  "title": "כותרת משופרת (עד 10 מילים)",
  "ad_text": "טקסט משופר (2-3 משפטים) שמתקן את הבעיות שצוינו",
  "call_to_action": "קריאה לפעולה (3-5 מילים)",
  "image_keyword": "מילות מפתח לתמונה באנגלית (2-4 מילים)",
  "image_style": "סגנון התמונה (מילה אחת באנגלית)"
}

כללים:
- התמקד בתיקון הבעיות שצוינו בדחייה
- שמור על זהות המותג
- השתמש בשפה ${ad.metadata?.tone || 'professional'}
- הפלט חייב להיות JSON תקין בלבד
      `.trim();

      const geminiResponse = await callGeminiWithRetry(improvementPrompt, 3, 'gemini-2.5-flash');
      
      // Parse JSON
      let geminiJson;
      try {
        let jsonString = geminiResponse.trim();
        const fencedMatch = jsonString.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
        if (fencedMatch) {
          jsonString = fencedMatch[1];
        } else {
          const braceMatch = jsonString.match(/\{[\s\S]*\}/);
          if (braceMatch) jsonString = braceMatch[0];
        }
        geminiJson = JSON.parse(jsonString);
        console.log('✅ Gemini improved ad parsed:', geminiJson);
      } catch (parseErr) {
        console.error('❌ JSON parsing failed:', parseErr.message);
        throw new Error('Failed to parse improved ad');
      }

      // חיפוש תמונה
      const imageUrl = await searchPexelsImage(
        geminiJson.image_keyword, 
        geminiJson.image_style || ad.metadata?.adStyle
      );

      // יצירת עיצוב
      alternativeAdImage = await createAdDesignOnServer({
        businessName: ad.metadata?.businessName,
        adText: geminiJson.ad_text,
        title: geminiJson.title,
        callToAction: geminiJson.call_to_action,
        productService: ad.metadata?.productService,
        adStyle: ad.metadata?.adStyle || 'modern',
        imageUrl,
        agentName: ad.agentId?.fullName || 'Ads Maker'
      });

      console.log('✅ Alternative ad created');

    } catch (aiError) {
      console.error('⚠️ AI generation failed:', aiError.message);
      // אם נכשל, השתמש בעיצוב ברירת מחדל
      alternativeAdImage = ad.imageData; // תמונה מקורית
    }

    // 4️⃣ שליחת מייל לסוכן
    const emailResult = await sendAlternativeAdEmail({
      agentEmail: ad.agentId?.email,
      agentName: ad.agentId?.fullName,
      companyName: ad.companyId?.companyName || ad.companyId?.fullName,
      rejectionReason,
      rejectionDetails,
      alternativeAdImage,
      websiteUrl: ad.campaignId?.websiteUrl || process.env.BASE_URL || 'https://adsmaker-frontend.vercel.app'
    });

    // 5️⃣ עדכן סטטוס מייל
    ad.notifications = {
      emailSent: emailResult.success,
      lastEmailSent: new Date(),
      emailError: emailResult.error || ''
    };

    await ad.save();

    if (emailResult.success) {
      console.log('✅ Email sent successfully');
      return res.json({
        success: true,
        message: 'המודעה נדחתה ומייל עם פרסומת חלופית נשלח לסוכן',
        ad,
        emailSent: true
      });
    } else {
      console.warn('⚠️ Email failed but ad rejected');
      return res.json({
        success: true,
        message: 'המודעה נדחתה אך שליחת המייל נכשלה',
        ad,
        emailSent: false,
        emailError: emailResult.error
      });
    }

  } catch (error) {
    console.error('❌ Error in reject-and-improve:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת',
      details: error.message
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