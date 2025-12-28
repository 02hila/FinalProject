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
      <body style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
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
      <body style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
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
      <body style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
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

// ✅ מייל בקשת תשלום לחברה
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

    // לינק לדשבורד עם פרמטר לפתיחת לשונית תשלומים
    const paymentLink = `https://adsmaker-rho.vercel.app/company-dashboard?tab=payments&paymentId=${paymentId}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; direction: rtl; text-align: right;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 20px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                
                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
                    <h1 style="margin: 0; font-size: 28px;">💰 בקשת תשלום</h1>
                  </td>
                </tr>
                
                <!-- Content -->
                <tr>
                  <td style="padding: 30px; text-align: right; direction: rtl;">
                    <p style="font-size: 16px; color: #333; margin-bottom: 20px;">
                      שלום <strong>${companyName}</strong>,
                    </p>
                    <p style="font-size: 16px; color: #333; margin-bottom: 25px;">
                      הסוכן <strong>${agentName}</strong> טוען שהעלה את הפרסומת שלכם ומבקש תשלום.
                    </p>

                    <!-- Ad Info Box -->
                    <table width="100%" style="background: #e3f2fd; border-right: 4px solid #2196f3; border-radius: 8px; margin-bottom: 15px;">
                      <tr>
                        <td style="padding: 15px; text-align: right;">
                          <strong style="color: #1565c0;">📢 פרסומת:</strong>
                          <span style="color: #333;"> ${adTitle || 'ללא כותרת'}</span>
                        </td>
                      </tr>
                    </table>

                    <!-- Agent Info Box -->
                    <table width="100%" style="background: #fff3e0; border-right: 4px solid #ff9800; border-radius: 8px; margin-bottom: 15px;">
                      <tr>
                        <td style="padding: 15px; text-align: right;">
                          <strong style="color: #e65100;">👤 פרטי הסוכן (לבדיקה):</strong><br><br>
                          <span style="color: #333;">
                            שם: ${agentName}<br>
                            אימייל: ${agentEmail || 'לא צוין'}<br>
                            טלפון: ${agentPhone || 'לא צוין'}
                          </span>
                        </td>
                      </tr>
                    </table>

                    <!-- Amount Box -->
                    <table width="100%" style="background: #e8f5e9; border-radius: 8px; margin: 20px 0;">
                      <tr>
                        <td style="padding: 25px; text-align: center;">
                          <div style="color: #666; font-size: 14px; margin-bottom: 10px;">סכום לתשלום:</div>
                          <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">₪${amount}</div>
                        </td>
                      </tr>
                    </table>

                    <p style="text-align: center; color: #666; font-size: 14px; margin: 20px 0;">
                      מומלץ לבדוק שהפרסומת אכן הועלתה לפני התשלום.
                    </p>

                    <!-- Button -->
                    <table width="100%" style="margin: 30px 0;">
                      <tr>
                        <td align="center">
                          <a href="${paymentLink}" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold; font-size: 16px;">
                            💳 לחץ כאן לתשלום
                          </a>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #f8f9fa; padding: 20px; text-align: center; color: #666; font-size: 13px; border-top: 1px solid #eee;">
                    <p style="margin: 0;"><strong>מערכת Ads Maker</strong></p>
                    <p style="margin: 5px 0 0 0; font-size: 12px;">אם יש שאלות, צרו קשר עם הסוכן ישירות</p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
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