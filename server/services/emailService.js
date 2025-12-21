// server/services/emailService.js - WITH UNSHARED AD REMINDER
const sgMail = require('@sendgrid/mail');

// ✅ הגדרת SendGrid
if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('✅ SendGrid configured');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not found');
}

// ✅ פונקציה לשליחת מייל עם פרסומת חלופית (דחייה)
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
    console.log('📧 Company name received:', companyName);
    console.log('📧 Rejection reasons:', rejectionReason);

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    if (!agentEmail) {
      console.error('❌ No agent email provided');
      return { success: false, error: 'No agent email' };
    }

    const displayCompanyName = companyName || 'החברה';
    const emailSubject = `📢 פרסומת נדחתה - פרסומת חלופית עבור ${displayCompanyName}`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f4f6f9; padding: 20px; line-height: 1.6; 
            direction: rtl; text-align: right;
          }
          .container { 
            max-width: 600px; margin: 0 auto; background: white; 
            border-radius: 15px; overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); direction: rtl;
          }
          .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; padding: 30px; text-align: center; 
          }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .content { padding: 30px; direction: rtl; text-align: right; }
          .content p { margin-bottom: 15px; color: #333; direction: rtl; text-align: right; }
          .rejection-box { 
            background: linear-gradient(135deg, #fff3cd 0%, #ffe8a1 100%); 
            border-right: 4px solid #ffc107; padding: 20px; 
            border-radius: 10px; margin: 20px 0; direction: rtl; text-align: right;
          }
          .rejection-box .title { font-weight: bold; color: #856404; margin-bottom: 10px; font-size: 16px; }
          .rejection-box .reason { color: #856404; font-weight: bold; margin-bottom: 8px; }
          .rejection-box .details { color: #666; margin-top: 10px; }
          .ad-preview { margin: 25px 0; direction: rtl; text-align: right; }
          .ad-preview .title { font-weight: bold; color: #667eea; margin-bottom: 10px; font-size: 16px; }
          .ad-preview .note { color: #666; font-size: 14px; margin-bottom: 15px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white !important; padding: 15px 40px; text-decoration: none; 
            border-radius: 30px; font-weight: bold; font-size: 16px; 
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          .info-box { 
            background: #e6f7ff; border-right: 4px solid #1890ff; 
            padding: 15px; border-radius: 8px; margin: 20px 0;
          }
          .info-box p { margin: 0; color: #005580; font-size: 14px; }
          .footer { 
            background: #f8f9fa; padding: 20px; text-align: center; 
            color: #666; font-size: 13px; border-top: 1px solid #eee;
          }
          .footer p { margin: 5px 0; }
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
              <div class="note">המערכת שלנו יצרה עבורך פרסומת משופרת עם ${getRejectionUpdateText(rejectionReason)}. הפרסומת ממתינה לך במערכת.</div>
            </div>

            <div class="info-box">
              <p>💡 <strong>שימו לב:</strong> הפרסומת החלופית שמורה במערכת ומוכנה לשימוש. תוכל לראות אותה בדשבורד שלך.</p>
            </div>

            <div class="button-container">
              <a href="${'https://adsmaker-rho.vercel.app/'}" class="button" style="color: white !important;">
                🔗 היכנס למערכת וצפה בפרסומת
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

    const msg = {
      to: agentEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com',
        name: 'AdsMaker'
      },
      subject: emailSubject,
      html: emailHtml
    };

    const response = await sgMail.send(msg);
    console.log('✅ SendGrid email sent successfully to:', agentEmail);
    console.log('   Response:', response[0].statusCode);
    
    return { success: true, messageId: response[0].headers['x-message-id'] };
    
  } catch (error) {
    console.error('❌ SendGrid error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.statusCode);
      console.error('   Body:', JSON.stringify(error.response.body, null, 2));
    }
    return { success: false, error: error.message };
  }
}

// ✅ NEW: מייל תזכורת לפרסומת שלא שותפה
async function sendUnsharedAdReminderEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  adTitle,
  daysSinceApproval,
  hasAlternative 
}) {
  try {
    console.log('📧 Preparing unshared ad reminder email to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    if (!agentEmail) {
      console.error('❌ No agent email provided');
      return { success: false, error: 'No agent email' };
    }

    const displayCompanyName = companyName || 'החברה';
    const emailSubject = `💡 שמנו לב שלא שיתפת את הפרסומת - יש לנו רעיון!`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f4f6f9; padding: 20px; line-height: 1.6; 
            direction: rtl; text-align: right;
          }
          .container { 
            max-width: 600px; margin: 0 auto; background: white; 
            border-radius: 15px; overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); direction: rtl;
          }
          .header { 
            background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%); 
            color: white; padding: 30px; text-align: center; 
          }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .header .subtitle { margin-top: 10px; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; direction: rtl; text-align: right; }
          .content p { margin-bottom: 15px; color: #333; direction: rtl; text-align: right; }
          .highlight-box { 
            background: linear-gradient(135deg, #e0f7fa 0%, #b2ebf2 100%); 
            border-right: 4px solid #00bcd4; padding: 20px; 
            border-radius: 10px; margin: 20px 0; direction: rtl; text-align: right;
          }
          .highlight-box .title { font-weight: bold; color: #00838f; margin-bottom: 10px; font-size: 16px; }
          .highlight-box .message { color: #006064; line-height: 1.8; }
          .alternative-box { 
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
            border-right: 4px solid #4caf50; padding: 20px; 
            border-radius: 10px; margin: 20px 0; direction: rtl; text-align: right;
          }
          .alternative-box .title { font-weight: bold; color: #2e7d32; margin-bottom: 10px; font-size: 16px; }
          .alternative-box .message { color: #1b5e20; line-height: 1.8; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white !important; padding: 15px 40px; text-decoration: none; 
            border-radius: 30px; font-weight: bold; font-size: 16px; 
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.4);
          }
          .tips-box { 
            background: #fff8e1; border-right: 4px solid #ffc107; 
            padding: 15px; border-radius: 8px; margin: 20px 0;
          }
          .tips-box .title { font-weight: bold; color: #f57f17; margin-bottom: 10px; }
          .tips-box ul { margin: 0; padding-right: 20px; color: #6d4c41; }
          .tips-box li { margin-bottom: 8px; }
          .footer { 
            background: #f8f9fa; padding: 20px; text-align: center; 
            color: #666; font-size: 13px; border-top: 1px solid #eee;
          }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💭 רגע, שמנו לב למשהו...</h1>
            <div class="subtitle">יש לנו הצעה שתעניין אותך!</div>
          </div>
          
          <div class="content">
            <p style="font-size: 16px; font-weight: bold;">היי ${agentName || 'סוכן יקר'},</p>
            
            <p>שמנו לב שהפרסומת <strong>"${adTitle || 'ללא כותרת'}"</strong> עבור <strong>${displayCompanyName}</strong> אושרה לפני ${daysSinceApproval} ימים, אבל עדיין לא שיתפת אותה. 🤔</p>

            <div class="highlight-box">
              <div class="title">💡 אולי הפרסומת לא בדיוק מה שחיפשת?</div>
              <div class="message">
                אנחנו מבינים - לפעמים פרסומת לא "מדברת" אלינו, גם אם היא טובה מבחינה טכנית.
                <br><br>
                בדיוק בשביל זה יצרנו לך משהו חדש! ✨
              </div>
            </div>

            ${hasAlternative ? `
            <div class="alternative-box">
              <div class="title">🎁 הכנו לך פרסומת חלופית!</div>
              <div class="message">
                יצרנו עבורך פרסומת חדשה לגמרי - עם כותרת אחרת, ניסוח שונה ותמונה חדשה.
                <br><br>
                אולי הגרסה החדשה תהיה יותר בסגנון שלך? 
                <br>
                <strong>היכנס למערכת וצפה בשתי הגרסאות!</strong>
              </div>
            </div>
            ` : ''}

            <div class="tips-box">
              <div class="title">💪 טיפים לשיתוף מוצלח:</div>
              <ul>
                <li>שתף בשעות הפעילות הגבוהות (10:00-12:00, 19:00-21:00)</li>
                <li>הוסף טקסט אישי משלך בפוסט</li>
                <li>תייג את העסק אם יש לו עמוד</li>
                <li>השתמש בהאשטגים רלוונטיים</li>
              </ul>
            </div>

            <div class="button-container">
              <a href="${'https://adsmaker-rho.vercel.app/'}" class="button" style="color: white !important;">
                🚀 היכנס למערכת וצפה בפרסומות
              </a>
            </div>

            <p style="text-align: center; color: #888; font-size: 14px; margin-top: 20px;">
              אנחנו כאן כדי לעזור לך להצליח! 🌟
            </p>
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

    const msg = {
      to: agentEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com',
        name: 'AdsMaker'
      },
      subject: emailSubject,
      html: emailHtml
    };

    const response = await sgMail.send(msg);
    console.log('✅ Unshared ad reminder email sent to:', agentEmail);
    console.log('   Response:', response[0].statusCode);
    
    return { success: true, messageId: response[0].headers['x-message-id'] };
    
  } catch (error) {
    console.error('❌ SendGrid error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.statusCode);
    }
    return { success: false, error: error.message };
  }
}

// ✅ פונקציה מעודכנת שתומכת בבחירה מרובה
function getRejectionReasonText(reasons) {
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

// ✅ NEW: מייל לסוכן כשהחברה אישרה פרסומת חלופית
async function sendAlternativeAdApprovedEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  adTitle,
  originalAdTitle
}) {
  try {
    console.log('📧 Preparing alternative ad approved email to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    if (!agentEmail) {
      console.error('❌ No agent email provided');
      return { success: false, error: 'No agent email' };
    }

    const displayCompanyName = companyName || 'החברה';
    const emailSubject = `🎉 פרסומת חלופית אושרה! מוכנה לשיתוף`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
            background: #f4f6f9; padding: 20px; line-height: 1.6; 
            direction: rtl; text-align: right;
          }
          .container { 
            max-width: 600px; margin: 0 auto; background: white; 
            border-radius: 15px; overflow: hidden; 
            box-shadow: 0 4px 20px rgba(0,0,0,0.1); direction: rtl;
          }
          .header { 
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); 
            color: white; padding: 30px; text-align: center; 
          }
          .header h1 { margin: 0; font-size: 24px; font-weight: bold; }
          .header .subtitle { margin-top: 10px; font-size: 16px; opacity: 0.9; }
          .content { padding: 30px; direction: rtl; text-align: right; }
          .content p { margin-bottom: 15px; color: #333; direction: rtl; text-align: right; }
          .success-box { 
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%); 
            border-right: 4px solid #4caf50; padding: 20px; 
            border-radius: 10px; margin: 20px 0; direction: rtl; text-align: right;
          }
          .success-box .title { font-weight: bold; color: #2e7d32; margin-bottom: 10px; font-size: 16px; }
          .success-box .message { color: #1b5e20; line-height: 1.8; }
          .info-box { 
            background: #e3f2fd; border-right: 4px solid #2196f3; 
            padding: 15px; border-radius: 8px; margin: 20px 0;
          }
          .info-box p { margin: 0; color: #1565c0; font-size: 14px; }
          .button-container { text-align: center; margin: 30px 0; }
          .button { 
            display: inline-block; 
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%); 
            color: white !important; padding: 15px 40px; text-decoration: none; 
            border-radius: 30px; font-weight: bold; font-size: 16px; 
            box-shadow: 0 4px 15px rgba(17, 153, 142, 0.4);
          }
          .footer { 
            background: #f8f9fa; padding: 20px; text-align: center; 
            color: #666; font-size: 13px; border-top: 1px solid #eee;
          }
          .footer p { margin: 5px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 חדשות טובות!</h1>
            <div class="subtitle">יש לך פרסומת חלופית מאושרת</div>
          </div>
          
          <div class="content">
            <p style="font-size: 16px; font-weight: bold;">היי ${agentName || 'סוכן יקר'},</p>
            
            <p>שמנו לב שהפרסומת <strong>"${originalAdTitle || 'ללא כותרת'}"</strong> לא שותפה, אז יצרנו עבורך פרסומת חלופית.</p>

            <div class="success-box">
              <div class="title">✅ הפרסומת החלופית אושרה!</div>
              <div class="message">
                <strong>${displayCompanyName}</strong> אישרו את הפרסומת החלופית שיצרנו עבורך.
                <br><br>
                <strong>כותרת:</strong> "${adTitle || 'ללא כותרת'}"
                <br><br>
                הפרסומת מוכנה לשיתוף! 🚀
              </div>
            </div>

            <div class="info-box">
              <p>💡 <strong>טיפ:</strong> שתף את הפרסומת בשעות הפעילות הגבוהות (10:00-12:00, 19:00-21:00) לתוצאות הטובות ביותר.</p>
            </div>

            <div class="button-container">
              <a href="${'https://adsmaker-rho.vercel.app/'}" class="button" style="color: white !important;">
                🚀 היכנס למערכת ושתף עכשיו
              </a>
            </div>

            <p style="text-align: center; color: #888; font-size: 14px; margin-top: 20px;">
              בהצלחה! 🌟
            </p>
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

    const msg = {
      to: agentEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com',
        name: 'AdsMaker'
      },
      subject: emailSubject,
      html: emailHtml
    };

    const response = await sgMail.send(msg);
    console.log('✅ Alternative ad approved email sent to:', agentEmail);
    console.log('   Response:', response[0].statusCode);
    
    return { success: true, messageId: response[0].headers['x-message-id'] };
    
  } catch (error) {
    console.error('❌ SendGrid error:', error.message);
    if (error.response) {
      console.error('   Status:', error.response.statusCode);
    }
    return { success: false, error: error.message };
  }
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
  sendUnsharedAdReminderEmail,
  sendAlternativeAdApprovedEmail,
  validateEmailConfig
};