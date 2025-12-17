// server/services/emailService.js - PRODUCTION VERSION - UPDATED FOR MULTIPLE REJECTION REASONS
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
  rejectionReason,  // עכשיו יכול להיות מערך של סיבות
  rejectionDetails,
  alternativeAdImage, 
  websiteUrl 
}) {
  try {
    console.log('📧 Preparing SendGrid email to:', agentEmail);
    console.log('📧 Company name received:', companyName);
    console.log('📧 Rejection reasons:', rejectionReason); // דיבוג

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    if (!agentEmail) {
      console.error('❌ No agent email provided');
      return { success: false, error: 'No agent email' };
    }

    // ✅ טיפול בשם חברה חסר
    const displayCompanyName = companyName || 'החברה';
    
    const emailSubject = `📢 פרסומת נדחתה - פרסומת חלופית עבור ${displayCompanyName}`;
    
    // ✅ המרת base64 לבלי prefix
    let imageBase64 = alternativeAdImage;
    if (imageBase64 && imageBase64.includes('base64,')) {
      imageBase64 = imageBase64.split('base64,')[1];
    }
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { 
            box-sizing: border-box; 
            margin: 0; 
            padding: 0; 
          }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f4f6f9; 
            padding: 20px; 
            line-height: 1.6; 
            direction: rtl;
            text-align: right;
          }
          .container { 
            max-width: 600px; 
            margin: 0 auto; 
            background: white; 
            border-radius: 15px; 
            overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            direction: rtl;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
          }
          .header h1 { 
            margin: 0; 
            font-size: 24px; 
            font-weight: bold; 
          }
          .content { 
            padding: 30px;
            direction: rtl;
            text-align: right;
          }
          .content p { 
            margin-bottom: 15px; 
            color: #333;
            direction: rtl;
            text-align: right;
          }
          .rejection-box { 
            background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); 
            border-right: 4px solid #ffc107; 
            padding: 20px; 
            border-radius: 10px; 
            margin: 20px 0;
            direction: rtl;
            text-align: right;
          }
          .rejection-box .title { 
            font-weight: bold; 
            color: #856404; 
            margin-bottom: 10px; 
            font-size: 16px;
            direction: rtl;
            text-align: right;
          }
          .rejection-box .reason { 
            color: #856404; 
            font-weight: bold; 
            margin-bottom: 8px;
            direction: rtl;
            text-align: right;
          }
          .rejection-box .details { 
            color: #666; 
            margin-top: 10px;
            direction: rtl;
            text-align: right;
          }
          .ad-preview { 
            margin: 25px 0;
            direction: rtl;
            text-align: right;
          }
          .ad-preview .title { 
            font-weight: bold; 
            color: #667eea; 
            margin-bottom: 10px; 
            font-size: 16px;
            direction: rtl;
            text-align: right;
          }
          .ad-preview .note { 
            color: #666; 
            font-size: 14px; 
            margin-bottom: 15px;
            direction: rtl;
            text-align: right;
          }
          .button-container { 
            text-align: center; 
            margin: 30px 0; 
          }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 15px 40px; 
            text-decoration: none; 
            border-radius: 30px; 
            font-weight: bold; 
            font-size: 16px; 
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4); 
            transition: transform 0.2s; 
          }
          .button:hover { 
            transform: translateY(-2px); 
          }
          .info-box { 
            background: #e6f7ff; 
            border-right: 4px solid #1890ff; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 20px 0;
            direction: rtl;
            text-align: right;
          }
          .info-box p { 
            margin: 0; 
            color: #005580; 
            font-size: 14px;
            direction: rtl;
            text-align: right;
          }
          .footer { 
            background: #f8f9fa; 
            padding: 20px; 
            text-align: center; 
            color: #666; 
            font-size: 13px; 
            border-top: 1px solid #eee; 
          }
          .footer p { 
            margin: 5px 0; 
          }
          @media only screen and (max-width: 600px) {
            .content { padding: 20px; }
            .header { padding: 20px; }
            .button { padding: 12px 30px; font-size: 14px; }
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>❌ פרסומת נדחתה</h1>
          </div>
          
          <div class="content">
            <p style="font-size: 16px; font-weight: bold;">שלום ${agentName || 'סוכן יקר'},</p>
            <p>הפרסומת שיצרת עבור <strong>${displayCompanyName}</strong> נדחתה על ידי החברה.</p>

            <div class="rejection-box">
              <div class="title">🔍 רכיבים שנדרש לשנות:</div>
              <div class="reason">${getRejectionReasonText(rejectionReason)}</div>
              ${rejectionDetails ? `<div class="details">הערות נוספות: ${rejectionDetails}</div>` : ''}
            </div>

            <div class="ad-preview">
              <div class="title">✨ פרסומת חלופית שהכנו עבורך:</div>
              <div class="note">המערכת שלנו יצרה עבורך פרסומת משופרת עם ${getRejectionUpdateText(rejectionReason)}. הפרסומת מצורפת כקובץ למטה.</div>
            </div>

            <div class="info-box">
              <p>💡 <strong>שימו לב:</strong> הפרסומת החלופית שמורה במערכת ומוכנה לשימוש. תוכל לראות אותה בדשבורד שלך.</p>
            </div>

            <div class="button-container">
              <a href="${'https://adsmaker-rho.vercel.app/'}" class="button">
                🔗 כנס למערכת וצפה בפרסומת
              </a>
            </div>
          </div>

          <div class="footer">
            <p><strong>מערכת Ads Maker</strong></p>
            <p>ניהול פרסומות חכם ואוטומטי מבוסס AI</p>
            <p style="margin-top: 15px; font-size: 12px; color: #999;">
              מייל זה נשלח אוטומטית, אין להשיב אליו ישירות
            </p>
          </div>
        </div>
      </body>
      </html>
    `;

    // ✅ בניית המייל עם attachment
    const msg = {
      to: agentEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com',
        name: 'AdsMaker'
      },
      subject: emailSubject,
      html: emailHtml,
      attachments: imageBase64 ? [
        {
          content: imageBase64,
          filename: 'alternative-ad.png',
          type: 'image/png',
          disposition: 'attachment'
        }
      ] : []
    };

    // ✅ שליחת המייל
    const response = await sgMail.send(msg);
    console.log('✅ SendGrid email sent successfully to:', agentEmail);
    console.log('   Response:', response[0].statusCode);
    
    return { 
      success: true, 
      messageId: response[0].headers['x-message-id'] 
    };
    
  } catch (error) {
    console.error('❌ SendGrid error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.statusCode);
      console.error('   Body:', JSON.stringify(error.response.body, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// ✅ פונקציה מעודכנת שתומכת בבחירה מרובה
function getRejectionReasonText(reasons) {
  // אם זה מערך - סיבות מרובות
  if (Array.isArray(reasons)) {
    const reasonTexts = {
      'title': '📝 הכותרת',
      'text': '💬 טקסט הפרסומת',
      'image': '🖼️ התמונה'
    };
    
    const selectedReasons = reasons
      .map(r => reasonTexts[r])
      .filter(Boolean)
      .join(', ');
    
    return selectedReasons || '📝 לא צוין';
  }
  
  // תמיכה לאחור בפורמט הישן
  const oldReasons = {
    'not_relevant': '❌ לא רלוונטי למוצר/שירות',
    'poor_quality': '🎨 איכות גרפית נמוכה',
    'wrong_message': '💬 המסר לא נכון',
    'target_audience': '👥 לא מתאים לקהל היעד',
    'brand_mismatch': '🏢 לא מתאים למותג',
    'other': '📝 אחר'
  };
  return oldReasons[reasons] || '📝 לא צוין';
}

// ✅ טקסט מתאים למה ששונה
function getRejectionUpdateText(reasons) {
  if (Array.isArray(reasons)) {
    if (reasons.length === 3) {
      return 'כותרת חדשה, טקסט משופר ותמונה חדשה';
    }
    
    const updates = [];
    if (reasons.includes('title')) updates.push('כותרת חדשה');
    if (reasons.includes('text')) updates.push('טקסט משופר');
    if (reasons.includes('image')) updates.push('תמונה חדשה');
    
    return updates.join(' ו');
  }
  
  return 'שיפורים לפי המשוב שהתקבל';
}

function validateEmailConfig() {
  const isValid = !!process.env.SENDGRID_API_KEY;
  if (!isValid) {
    console.warn('⚠️ Email service not configured - SENDGRID_API_KEY missing');
  }
  return isValid;
}

module.exports = {
  sendAlternativeAdEmail,
  validateEmailConfig
};