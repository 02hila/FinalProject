// הוסף לקובץ emailService.js

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
    console.log('📧 Sending payment request email to:', companyEmail);

    if (!process.env.SENDGRID_API_KEY) {
      console.warn('⚠️ SendGrid not configured');
      return { success: false, error: 'SendGrid not configured' };
    }

    const emailSubject = `💰 בקשת תשלום - הסוכן ${agentName} העלה את הפרסומת`;
    
    const emailHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8">
        <style>
          body { font-family: 'Segoe UI', sans-serif; background: #f4f6f9; padding: 20px; direction: rtl; }
          .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1); }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; }
          .content { padding: 30px; }
          .info-box { background: #e3f2fd; border-right: 4px solid #2196f3; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .agent-box { background: #fff3e0; border-right: 4px solid #ff9800; padding: 20px; border-radius: 10px; margin: 20px 0; }
          .amount-box { background: #e8f5e9; border-right: 4px solid #4caf50; padding: 20px; border-radius: 10px; margin: 20px 0; text-align: center; }
          .amount { font-size: 32px; font-weight: bold; color: #2e7d32; }
          .button-container { text-align: center; margin: 30px 0; }
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
            <p style="font-size: 16px;">שלום <strong>${companyName}</strong>,</p>
            
            <p>הסוכן <strong>${agentName}</strong> טוען שהעלה את הפרסומת שלכם.</p>

            <div class="info-box">
              <strong>📢 פרטי הפרסומת:</strong><br>
              כותרת: ${adTitle || 'ללא כותרת'}
            </div>

            <div class="agent-box">
              <strong>👤 פרטי הסוכן (לבדיקה):</strong><br><br>
              <strong>שם:</strong> ${agentName}<br>
              <strong>אימייל:</strong> ${agentEmail}<br>
              <strong>טלפון:</strong> ${agentPhone || 'לא צוין'}
            </div>

            <div class="amount-box">
              <div>סכום לתשלום:</div>
              <div class="amount">₪${amount}</div>
            </div>

            <p style="text-align: center; color: #666;">
              אתם מוזמנים לבדוק שהפרסומת אכן הועלתה לפני התשלום.
            </p>

            <div class="button-container">
              <a href="https://adsmaker-rho.vercel.app/company-dashboard" class="button" style="color: white !important;">
                💳 היכנס למערכת לתשלום
              </a>
            </div>
          </div>

          <div class="footer">
            <p><strong>מערכת Ads Maker</strong></p>
            <p>מייל זה נשלח אוטומטית</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const msg = {
      to: companyEmail,
      from: {
        email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com',
        name: 'AdsMaker'
      },
      subject: emailSubject,
      html: emailHtml
    };

    const response = await sgMail.send(msg);
    console.log('✅ Payment request email sent');
    return { success: true };
    
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return { success: false, error: error.message };
  }
}

// הוסף ל-exports
module.exports = {
  sendAlternativeAdEmail,
  sendUnsharedAdReminderEmail,
  sendAlternativeAdApprovedEmail,
  sendPaymentRequestEmail,  // ✅ חדש
  validateEmailConfig
};