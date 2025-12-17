const express = require('express'); 
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const axios = require('axios'); // 🆕 נוסיף את זה

// ... כל ה-routes הקיימים שלך נשארים ...

/* ---------------------------------------------
   POST - דחיית פרסומת עם בחירה מרובה של רכיבים 🆕
   זה מחליף/משדרג את ה-route הקיים
---------------------------------------------- */
router.post('/:id/reject-with-components', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rejectionReasons, rejectionDetails } = req.body;

    console.log('🔵 Reject with components:', { id, rejectionReasons, rejectionDetails });

    // ולידציה
    if (!rejectionReasons || !Array.isArray(rejectionReasons) || rejectionReasons.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'חובה לבחור לפחות רכיב אחד לשינוי'
      });
    }

    const validReasons = ['title', 'text', 'image'];
    const invalidReasons = rejectionReasons.filter(r => !validReasons.includes(r));
    if (invalidReasons.length > 0) {
      return res.status(400).json({
        success: false,
        error: `רכיבים לא תקינים: ${invalidReasons.join(', ')}`
      });
    }

    if (!rejectionDetails || rejectionDetails.trim() === '') {
      return res.status(400).json({
        success: false,
        error: 'חובה להוסיף הסבר מפורט'
      });
    }

    // טען את הפרסומת המקורית
    const pendingAd = await PendingAd.findById(id)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName');

    if (!pendingAd) {
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    console.log('✅ Found ad:', pendingAd.title);

    // שמור את הגרסה הנוכחית בהיסטוריה
    if (!pendingAd.history) {
      pendingAd.history = [];
    }

    pendingAd.history.push({
      version: pendingAd.history.length + 1,
      title: pendingAd.title,
      text: pendingAd.text,
      imageData: pendingAd.imageData,
      rejectedAt: new Date(),
      rejectionReasons,
      rejectionDetails
    });

    console.log('✅ Saved to history, version:', pendingAd.history.length);

    // עדכן את הסטטוס
    pendingAd.status = 'rejected';
    pendingAd.companyFeedback = {
      rejectionReasons, // 🆕 מערך של הרכיבים
      rejectionDetails,
      feedbackDate: new Date()
    };

    await pendingAd.save();
    console.log('✅ Ad updated with rejection status');

    // כעת קרא ל-API של שיפור הפרסומת
    try {
      console.log('🔄 Calling ad-improvement API...');
      
      const improvementResponse = await axios.post(
        `${process.env.BASE_URL || 'http://localhost:3000'}/api/ad-improvement/regenerate`,
        {
          adId: id,
          rejectionReasons,
          rejectionDetails
        },
        {
          headers: {
            Authorization: req.headers.authorization
          },
          timeout: 60000 // 60 שניות timeout
        }
      );

      console.log('✅ Ad improvement response:', improvementResponse.data);

      res.json({
        success: true,
        message: 'הפרסומת נדחתה ופרסומת חלופית נוצרה',
        ad: pendingAd,
        improvement: improvementResponse.data,
        emailSent: improvementResponse.data.emailSent || false
      });

    } catch (improvementError) {
      console.error('⚠️ Ad improvement failed:', improvementError.message);
      
      // אם שיפור הפרסומת נכשל, עדיין מחזירים הצלחה על הדחייה
      res.json({
        success: true,
        message: 'הפרסומת נדחתה',
        ad: pendingAd,
        warning: 'לא הצלחנו ליצור פרסומת חלופית אוטומטית',
        emailSent: false
      });
    }

  } catch (error) {
    console.error('❌ Error in reject-with-components:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת',
      details: error.message
    });
  }
});

module.exports = router;