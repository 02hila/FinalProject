// server/services/emailService.js - SENDGRID VERSION
const sgMail = require('@sendgrid/mail');

// ✅ הגדרת SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not found');
}

// ✅ פונקציה לשליחת מייל עם פרסומת חלופית
async function sendAlternativeAdEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  rejectionReason, 
  rejectionDetails,
  alternativeAdImage, 
  websiteUrl 
}) {
  try {
    console.log('📧 Preparing SendGrid email to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    const emailSubject = `פרסומת חלופית עבור ${companyName}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: Arial, sans-serif; background: #f4f4f4; padding: 20px; margin: 0; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
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
            <p style="font-size: 16px;">שלום ${agentName},</p>
            <p>הפרסומת שיצרת עבור <strong>${companyName}</strong> נדחתה על ידי החברה.</p>

            <div class="rejection-box">
              <div style="font-weight: bold; margin-bottom: 10px;">🔍 סיבת הדחייה:</div>
              <p style="margin: 5px 0 0 0; color: #856404;"><strong>${getRejectionReasonText(rejectionReason)}</strong></p>
              ${rejectionDetails ? `<p style="margin: 10px 0 0 0; color: #666;">${rejectionDetails}</p>` : ''}
            </div>

            <div>
              <div style="font-weight: bold; margin-bottom: 10px;">✨ פרסומת חלופית שהכנו עבורך:</div>
              <p style="color: #666; margin-bottom: 15px;">
                המערכת שלנו יצרה עבורך פרסומת משופרת המבוססת על המשוב מהחברה.
              </p>
            </div>

            <div style="text-align: center; margin: 30px 0;">
              <p style="color: #667eea; font-weight: bold;">🔗 לפרטים נוספים ולאישור הפרסומת:</p>
              <a href="${websiteUrl || 'https://adsmaker-frontend.vercel.app/agent-dashboard'}" class="button">
                כנס למערכת
              </a>
            </div>
          </div>

          <div class="footer">
            <p>מערכת Ads Maker | ניהול פרסומות חכם ואוטומטי</p>
            <p style="margin-top: 10px;">מייל זה נשלח אוטומטית, אין להשיב אליו</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // ✅ שליחת המייל עם תמונה מוטמעת
    const msg = {
      to: agentEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'noreply@adsmaker.com',
        name: 'Ads Maker System'
      },
      subject: emailSubject,
      html: emailHtml,
      // ✅ צירוף התמונה כ-attachment
      attachments: [
        {
          content: alternativeAdImage.split('base64,')[1],
          filename: 'alternative-ad.png',
          type: 'image/png',
          disposition: 'attachment'
        }
      ]
    };

    await sgMail.send(msg);
    console.log('✅ SendGrid email sent successfully to:', agentEmail);
    
    return { success: true };
    
  } catch (error) {
    console.error('❌ SendGrid error:', error);
    if (error.response) {
      console.error('Response body:', error.response.body);
    }
    return { success: false, error: error.message };
  }
}

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

function validateEmailConfig() {
  return !!process.env.SENDGRID_API_KEY;
}

module.exports = {
  sendAlternativeAdEmail,
  validateEmailConfig
};