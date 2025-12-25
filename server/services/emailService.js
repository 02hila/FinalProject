// server/services/emailService.js

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
    console.log('📧 Preparing rejection email to:', agentEmail);

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
      <head><meta charset="UTF-8"></head>
      <body style="font-family: Arial, sans-serif; direction: rtl;">
        <h2>❌ פרסומת נדחתה</h2>
        <p>שלום ${agentName || 'סוכן יקר'},</p>
        <p>הפרסומת עבור <strong>${displayCompanyName}</strong> נדחתה.</p>
        <p><strong>סיבה:</strong> ${rejectionReason || 'לא צוינה'}</p>
        ${rejectionDetails ? `<p><strong>פרטים:</strong> ${rejectionDetails}</p>` : ''}
        <p>יצרנו עבורך פרסומת חלופית במערכת.</p>
        <a href="https://adsmaker-rho.vercel.app/">היכנס למערכת</a>
      </body>
      </html>
    `;

    const msg = {
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: emailSubject,
      html: emailHtml
    };

    await sgMail.send(msg);
    console.log('✅ Email sent to:', agentEmail);
    return { success: true };
    
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
}

// ✅ מייל תזכורת לפרסומת שלא שותפה
async function sendUnsharedAdReminderEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  adTitle,
  daysSinceApproval,
  hasAlternative 
}) {
  try {
    console.log('📧 Preparing unshared ad reminder to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY || !agentEmail) {
      return { success: false, error: 'Config or email missing' };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <body style="font-family: Arial, sans-serif; direction: rtl;">
        <h2>💡 תזכורת - פרסומת לא שותפה</h2>
        <p>היי ${agentName},</p>
        <p>הפרסומת "${adTitle}" עבור ${companyName} אושרה לפני ${daysSinceApproval} ימים אבל עדיין לא שותפה.</p>
        ${hasAlternative ? '<p>יצרנו גם פרסומת חלופית!</p>' : ''}
        <a href="https://adsmaker-rho.vercel.app/">היכנס למערכת</a>
      </body>
      </html>
    `;

    await sgMail.send({
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '💡 תזכורת - פרסומת ממתינה לשיתוף',
      html: emailHtml
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
}

// ✅ מייל לסוכן כשפרסומת חלופית אושרה
async function sendAlternativeAdApprovedEmail({ 
  agentEmail, 
  agentName, 
  companyName, 
  adTitle,
  originalAdTitle
}) {
  try {
    if (!process.env.SENDGRID_API_KEY || !agentEmail) {
      return { success: false, error: 'Config or email missing' };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <body style="font-family: Arial, sans-serif; direction: rtl;">
        <h2>🎉 פרסומת חלופית אושרה!</h2>
        <p>היי ${agentName},</p>
        <p>הפרסומת החלופית "${adTitle}" עבור ${companyName} אושרה!</p>
        <a href="https://adsmaker-rho.vercel.app/">היכנס למערכת לשתף</a>
      </body>
      </html>
    `;

    await sgMail.send({
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '🎉 פרסומת חלופית אושרה!',
      html: emailHtml
    });

    return { success: true };
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
}

// ✅ NEW: מייל בקשת תשלום לחברה
async function sendPaymentRequestEmail({ 
  companyEmail, 
  companyName, 
  agentName, 
  agentEmail,
  agentPhone,
  adTitle,
  amount,
  paymentId
}) {
  try {
    console.log('📧 Sending payment request to:', companyEmail);

    if (!process.env.SENDGRID_API_KEY || !companyEmail) {
      return { success: false, error: 'Config or email missing' };
    }

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; padding: 20px; direction: rtl; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .content { padding: 30px; }
          .info-box { background: #e3f2fd; border-right: 4px solid #2196f3; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .agent-box { background: #fff3e0; border-right: 4px solid #ff9800; padding: 15px; border-radius: 8px; margin: 15px 0; }
          .amount-box { background: #e8f5e9; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0; }
          .amount { font-size: 32px; font-weight: bold; color: #2e7d32; }
          .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white !important; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; }
          .footer { background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>💰 בקשת תשלום</h1>
          </div>
          
          <div class="content">
            <p>שלום <strong>${companyName}</strong>,</p>
            <p>הסוכן <strong>${agentName}</strong> טוען שהעלה את הפרסומת שלכם ומבקש תשלום.</p>

            <div class="info-box">
              <strong>📢 פרסומת:</strong> ${adTitle || 'ללא כותרת'}
            </div>

            <div class="agent-box">
              <strong>👤 פרטי הסוכן (לבדיקה):</strong><br><br>
              שם: ${agentName}<br>
              אימייל: ${agentEmail}<br>
              טלפון: ${agentPhone || 'לא צוין'}
            </div>

            <div class="amount-box">
              <div>סכום לתשלום:</div>
              <div class="amount">₪${amount}</div>
            </div>

            <p style="text-align: center; color: #666;">
              מומלץ לבדוק שהפרסומת אכן הועלתה לפני התשלום.
            </p>

            <div style="text-align: center; margin: 30px 0;">
              <a href="https://adsmaker-rho.vercel.app/company-dashboard" class="button">
                💳 היכנס למערכת לתשלום
              </a>
            </div>
          </div>

          <div class="footer">
            <p><strong>מערכת Ads Maker</strong></p>
          </div>
        </div>
      </body>
      </html>
    `;

    await sgMail.send({
      to: companyEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: `💰 בקשת תשלום - הסוכן ${agentName} העלה את הפרסומת`,
      html: emailHtml
    });

    console.log('✅ Payment request email sent');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
}

function validateEmailConfig() {
  return !!process.env.SENDGRID_API_KEY;
}

module.exports = {
  sendAlternativeAdEmail,
  sendUnsharedAdReminderEmail,
  sendAlternativeAdApprovedEmail,
  sendPaymentRequestEmail,
  validateEmailConfig
};