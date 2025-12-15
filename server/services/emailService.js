// server/services/emailService.js
const nodemailer = require('nodemailer');

// ✅ הגדרת transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// ✅ פונקציה לשליחת מייל עם פרסומת חלופית
async function sendAlternativeAdEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  rejectionReason, 
  rejectionDetails,
  alternativeAdImage, // base64 של התמונה
  websiteUrl 
}) {
  try {
    console.log('📧 Preparing email to:', agentEmail);

    // טקסט המייל
    const emailSubject = `פרסומת חלופית עבור ${companyName}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .section { margin-bottom: 25px; }
          .section-title { color: #667eea; font-weight: bold; margin-bottom: 10px; font-size: 16px; }
          .rejection-box { background: #fff3cd; border-right: 4px solid #ffc107; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
          .ad-image { width: 100%; border-radius: 10px; margin: 20px 0; box-shadow: 0 4px 8px rgba(0,0,0,0.1); }
          .button { display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 15px; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ פרסומת נדחתה - צירפנו פרסומת חלופית</h1>
          </div>
          
          <div class="content">
            <div class="section">
              <p style="font-size: 16px; line-height: 1.6;">
                שלום ${agentName},
              </p>
              <p style="font-size: 16px; line-height: 1.6;">
                הפרסומת שיצרת עבור <strong>${companyName}</strong> נדחתה על ידי החברה.
              </p>
            </div>

            <div class="rejection-box">
              <div class="section-title">🔍 סיבת הדחייה:</div>
              <p style="margin: 5px 0 0 0; color: #856404;"><strong>${getRejectionReasonText(rejectionReason)}</strong></p>
              ${rejectionDetails ? `<p style="margin: 10px 0 0 0; color: #666;">${rejectionDetails}</p>` : ''}
            </div>

            <div class="section">
              <div class="section-title">✨ פרסומת חלופית שהכנו עבורך:</div>
              <p style="color: #666; margin-bottom: 15px;">
                המערכת שלנו יצרה עבורך פרסומת משופרת המבוססת על המשוב מהחברה.
              </p>
              <img src="cid:alternativeAd" class="ad-image" alt="פרסומת חלופית" />
            </div>

            <div class="section" style="text-align: center;">
              <p style="color: #667eea; font-weight: bold; margin-bottom: 10px;">
                🔗 לפרטים נוספים ולאישור הפרסומת:
              </p>
              <a href="${websiteUrl || 'https://adsmaker-frontend.vercel.app/agent-dashboard'}" class="button">
                כנס למערכת
              </a>
            </div>
          </div>

          <div class="footer">
            <p>מערכת Ads Maker | ניהול פרסומות חכם ואוטומטי</p>
            <p style="margin-top: 10px; font-size: 11px; color: #999;">
              מייל זה נשלח אוטומטית, אין להשיב אליו
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // הגדרות המייל
    const mailOptions = {
      from: `"Ads Maker System" <${process.env.EMAIL_USER}>`,
      to: agentEmail,
      subject: emailSubject,
      html: emailHtml,
      attachments: [
        {
          filename: 'alternative-ad.png',
          content: alternativeAdImage.split('base64,')[1], // מסיר את ה-prefix
          encoding: 'base64',
          cid: 'alternativeAd' // זהה ל-cid בתמונה ב-HTML
        }
      ]
    };

    // שליחת המייל
    const info = await transporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully:', info.messageId);
    
    return { success: true, messageId: info.messageId };
    
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

// ✅ פונקציית עזר להמרת סיבת דחייה לטקסט
function getRejectionReasonText(reason) {
  const reasons = {
    'not_relevant': '❌ לא רלוונטי למוצר/שירות',
    'poor_quality': '🎨 איכות גרפית נמוכה',
    'wrong_message': '💬 המסר לא נכון',
    'target_audience': '👥 לא מתאים לקהל היעד',
    'brand_mismatch': '🏢 לא מתאים למותג',
    'other': '📝 אחר'
  };
  return reasons[reason] || '📝 לא צוין';
}

// ✅ בדיקת תקינות הגדרות מייל
function validateEmailConfig() {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
    console.warn('⚠️ Email configuration missing in .env file');
    return false;
  }
  return true;
}

module.exports = {
  sendAlternativeAdEmail,
  validateEmailConfig
};