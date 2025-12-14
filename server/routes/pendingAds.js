// routes/pendingAds.js - UPDATED WITH REJECTION & EMAIL FEATURES

const express = require('express'); 
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');
const User = require('../models/User');
const nodemailer = require('nodemailer'); // ✨ נוסיף לאחר מכן

/* ---------------------------------------------
   🔧 HELPER: Configure Email Transporter
---------------------------------------------- */
function getEmailTransporter() {
  // אפשרות 1: Gmail (צריך App Password)
  if (process.env.EMAIL_SERVICE === 'gmail') {
return nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD
      }
    });
  }
  
  // אפשרות 2: SMTP כללי
  return nodemailer.createTransporter({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });
}

/* ---------------------------------------------
   🔧 HELPER: Send Rejection Email to Agent
---------------------------------------------- */
async function sendRejectionEmail(agent, ad, rejectionData) {
  try {
    const transporter = getEmailTransporter();
    
    const emailHTML = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 10px; padding: 30px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
          .content { color: #333; line-height: 1.8; }
          .rejection-box { background: #fff3cd; border-right: 4px solid #ffc107; padding: 15px; margin: 20px 0; border-radius: 5px; }
          .ad-details { background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0; }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📢 עדכון לגבי הפרסומת שלך</h1>
          </div>
          
          <div class="content">
            <p>שלום <strong>${agent.fullName}</strong>,</p>
            
            <p>הפרסומת שיצרת נדחתה על ידי החברה ונדרשים שיפורים.</p>
            
            <div class="ad-details">
              <h3>📋 פרטי הפרסומת:</h3>
              <p><strong>כותרת:</strong> ${ad.title}</p>
              <p><strong>קמפיין:</strong> ${ad.campaignId?.title || 'לא צוין'}</p>
              <p><strong>מזהה ייחודי:</strong> ${ad.uniqueId || ad._id}</p>
            </div>
            
            <div class="rejection-box">
              <h3>❌ סיבת הדחייה:</h3>
              <p><strong>${rejectionData.reason}</strong></p>
              ${rejectionData.details ? `<p>${rejectionData.details}</p>` : ''}
            </div>
            
            <h3>💡 מה הלאה?</h3>
            <p>אנחנו כבר עובדים על שיפור הפרסומת בעזרת AI על בסיס המשוב מהחברה.</p>
            <p>הפרסומת המשופרת תופיע ברשימת הפרסומות שלך ותישלח אוטומטית לחברה לאישור מחדש.</p>
            
            <div style="text-align: center;">
              <a href="${process.env.FRONTEND_URL || 'https://adsmaker-frontend.vercel.app'}/dashboard" class="button">
                צפה בפרסומות שלך
              </a>
            </div>
            
            <p><strong>טיפ:</strong> כדי להימנע מדחיות בעתיד, וודא שאתה מתאים את התוכן לקהל היעד ולהנחיות החברה.</p>
          </div>
          
          <div class="footer">
            <p>מערכת AdsMaker | פלטפורמה ליצירת פרסומות חכמות</p>
            <p>אם יש לך שאלות, צור איתנו קשר בכל עת.</p>
          </div>
        </div>
      </body>
      </html>
    `;
    
    const mailOptions = {
      from: `"AdsMaker" <${process.env.EMAIL_USER}>`,
      to: agent.email,
      subject: `🔔 הפרסומת שלך נדחתה - נדרשים שיפורים`,
      html: emailHTML,
      text: `
שלום ${agent.fullName},

הפרסומת שיצרת (${ad.title}) נדחתה על ידי החברה.

סיבת הדחייה: ${rejectionData.reason}
${rejectionData.details ? 'פרטים: ' + rejectionData.details : ''}

אנחנו כבר עובדים על שיפור הפרסומת בעזרת AI.
הפרסומת המשופרת תישלח לחברה לאישור מחדש.

בברכה,
צוות AdsMaker
      `
    };
    
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/* ---------------------------------------------
   GET - קבלת כל הפרסומות הממתינות
---------------------------------------------- */
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 User from token:', req.userId, req.user);

    const { companyId, agentId: queryAgentId, status } = req.query;
    const query = {};

    if (req.user && req.user.userType === 'agent') {
      const agentIdFromToken = req.userId || req.user._id;
      if (agentIdFromToken) query.agentId = agentIdFromToken;
    } else if (queryAgentId && queryAgentId !== 'null' && queryAgentId !== 'undefined') {
      query.agentId = queryAgentId;
    }

    if (companyId && companyId !== 'null' && companyId !== 'undefined') {
      query.companyId = companyId;
    }

    if (status && status !== 'null' && status !== 'undefined') {
      if (status.includes(',')) {
        const statusArray = status.split(',').map(s => s.trim()).filter(Boolean);
        if (statusArray.length > 0) query.status = { $in: statusArray };
      } else {
        query.status = status;
      }
    }

    console.log('🔍 Fetching pending ads with query:', query);

    const pendingAds = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .limit(30)
      .lean()
      .allowDiskUse(true);

    console.log('✅ Found', pendingAds.length, 'pending ads');

    res.json({ success: true, ads: pendingAds || [] });

  } catch (error) {
    console.error('❌ Error fetching pending ads:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת פרסומות ממתינות',
      error: error.message
    });
  }
});

/* ---------------------------------------------
   POST - יצירת פרסומת חדשה לאישור
---------------------------------------------- */
router.post('/', authMiddleware, async (req, res) => {
  try {
    console.log('📥 Received pending ad data:', req.body);

    const pendingAd = new PendingAd(req.body);
    await pendingAd.save();

    console.log('✅ Pending ad saved:', pendingAd._id);

    res.status(201).json({ success: true, ad: pendingAd });
  } catch (error) {
    console.error('❌ Error creating pending ad:', error);
    res.status(400).json({
      success: false,
      message: 'שגיאה ביצירת פרסומת',
      error: error.message
    });
  }
});

/* ---------------------------------------------
   ✨ NEW: POST - דחיית פרסומת עם שליחת מייל ושיפור AI
---------------------------------------------- */
router.post('/:id/reject-and-improve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, details } = req.body;

    console.log('🚫 Rejecting ad:', id);
    console.log('📝 Rejection reason:', reason);

    // 1. מצא את הפרסומת
    const pendingAd = await PendingAd.findById(id)
      .populate('agentId', 'fullName email')
      .populate('campaignId', 'title');

    if (!pendingAd) {
      return res.status(404).json({ 
        success: false, 
        error: 'פרסומת לא נמצאה' 
      });
    }

    // 2. הוסף את הדחייה להיסטוריה
    pendingAd.addRejection({
      reason: reason || 'לא צוין',
      details: details || '',
      rejectedBy: req.userId,
      notes: 'Rejected by company'
    });

    await pendingAd.save();
    console.log('✅ Rejection saved to history');

    // 3. שלח מייל לסוכן
    let emailResult = { success: false };
    if (pendingAd.agentId && pendingAd.agentId.email) {
      console.log('📧 Sending rejection email to:', pendingAd.agentId.email);
      emailResult = await sendRejectionEmail(
        pendingAd.agentId, 
        pendingAd, 
        { reason, details }
      );
      
      // עדכן את סטטוס המייל
      pendingAd.notifications = {
        emailSent: emailResult.success,
        lastEmailSent: new Date(),
        emailError: emailResult.error || ''
      };
      await pendingAd.save();
    }

    // 4. החזר תגובה
    res.json({ 
      success: true, 
      ad: pendingAd,
      emailSent: emailResult.success,
      message: 'הפרסומת נדחתה בהצלחה. המערכת תשפר את הפרסומת אוטומטית.'
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

/* ---------------------------------------------
   PUT - עדכון סטטוס (אישור/דחייה) - הגרסה הישנה
---------------------------------------------- */
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );

    if (!pendingAd) return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });

    res.json({ success: true, ad: pendingAd });
  } catch (error) {
    res.status(400).json({
      success: false,
      message: 'שגיאה בעדכון פרסומת',
      error: error.message
    });
  }
});

/* ---------------------------------------------
   DELETE - מחיקת פרסומת
---------------------------------------------- */
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findByIdAndDelete(req.params.id);
    if (!pendingAd) {
      return res.status(404).json({ success: false, message: 'פרסומת לא נמצאה' });
    }

    res.json({ success: true, message: 'פרסומת נמחקה בהצלחה' });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'שגיאה במחיקת פרסומת',
      error: error.message
    });
  }
});

/* ---------------------------------------------
   GET - פרסומות לפי חברה
---------------------------------------------- */
router.get('/company/:companyId', authMiddleware, async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status } = req.query;

    if (!companyId || companyId === 'null' || companyId === 'undefined') {
      return res.status(400).json({
        success: false,
        error: 'חסר מזהה חברה תקין',
        ads: []
      });
    }

    const query = { companyId };

    if (status) {
      const statusArray = status.split(',').map(s => s.trim()).filter(Boolean);
      query.status = { $in: statusArray };
    }

    const pendingAds = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 });

    res.json({ success: true, ads: pendingAds });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'שגיאה בטעינת פרסומות ממתינות',
      ads: []
    });
  }
});

/* ---------------------------------------------
   POST - אישור פרסומת
---------------------------------------------- */
router.post('/:id/approve', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;

    const pendingAd = await PendingAd.findById(id);
    if (!pendingAd) {
      return res.status(404).json({ success: false, error: 'Pending ad not found' });
    }

    pendingAd.status = 'approved';
    
    // הוסף לה היסטוריה
    const version = pendingAd.improvementHistory.length + 1;
    pendingAd.improvementHistory.push({
      version,
      action: 'approved',
      performedBy: req.userId,
      performedAt: new Date(),
      notes: comment || 'Approved by company'
    });

    await pendingAd.save();

    // עדכון ציון של הסוכן
    if (rating && pendingAd.agentId) {
      const agent = await User.findById(pendingAd.agentId);
      if (agent) {
        const totalRatings = (agent.stats?.totalRatings || 0) + 1;
        const currentAverage = agent.stats?.averageRating || 0;
        const newAverage =
          ((currentAverage * (totalRatings - 1)) + parseInt(rating)) / totalRatings;

        agent.stats.averageRating = parseFloat(newAverage.toFixed(1));
        agent.stats.totalRatings = totalRatings;
        agent.stats.totalApproved = (agent.stats.totalApproved || 0) + 1;

        await agent.save();
      }
    }

    res.json({ success: true, ad: pendingAd });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* ---------------------------------------------
   POST - דחיית פרסומת (הגרסה הישנה - לתאימות אחורה)
---------------------------------------------- */
router.post('/:id/reject', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, rejectionReason, rejectionDetails, allowRevision } = req.body;

    const pendingAd = await PendingAd.findByIdAndUpdate(
      id,
      {
        status: 'rejected',
        rejectionReason: rejectionReason || reason || 'other',
        updatedAt: new Date()
      },
      { new: true }
    );

    if (!pendingAd) {
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    res.json({ success: true, ad: pendingAd });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'שגיאה בדחיית הפרסומת'
    });
  }
});

/* ---------------------------------------------
   GET - הורדת תמונה של מודעה
---------------------------------------------- */
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const pendingAd = await PendingAd.findById(req.params.id);

    if (!pendingAd) {
      return res.status(404).json({ success: false, error: 'פרסומת לא נמצאה' });
    }

    const user = await User.findById(req.userId);

    if (user.userType === 'agent' && pendingAd.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'לא ניתן להוריד מודעה שטרם אושרה על ידי החברה',
        status: pendingAd.status
      });
    }

    if (!pendingAd.imageData) {
      return res.status(404).json({ success: false, error: 'אין תמונה למודעה זו' });
    }

    const base64Data = pendingAd.imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="ad-${pendingAd._id}.png"`
    });

    res.send(imageBuffer);

  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'שגיאה בהורדת התמונה'
    });
  }
});

/* ---------------------------------------------
   GET - קבלת מודעה ספציפית (ציבורי)
---------------------------------------------- */
router.get('/:id/public', async (req, res) => {
  try {
    const { id } = req.params;
    
    const ad = await PendingAd.findById(id)
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title websiteUrl')
      .lean();

    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'מודעה לא נמצאה'
      });
    }

    res.json({ success: true, ad: ad });

  } catch (error) {
    console.error('❌ Error fetching public ad:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת המודעה'
    });
  }
});

/* ---------------------------------------------
   POST - רישום קליק על מודעה (ציבורי)
---------------------------------------------- */
router.post('/click/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const ad = await PendingAd.findById(id);
    
    if (!ad) {
      return res.status(404).json({
        success: false,
        message: 'מודעה לא נמצאה'
      });
    }

    ad.clicks = (ad.clicks || 0) + 1;
    ad.lastClickDate = new Date();
    
    await ad.save();

    res.json({
      success: true,
      message: 'הקליק נרשם בהצלחה',
      clicks: ad.clicks
    });

  } catch (error) {
    console.error('❌ Error logging click:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה ברישום הקליק'
    });
  }
});

module.exports = router;