const nodemailer = require('nodemailer');

// הגדרת transporter לשליחת מיילים
const transporter = nodemailer.createTransport({
  service: 'gmail', // או שירות אחר
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// שליחת התראה כשמודעה חדשה נוצרה
async function notifyNewPendingAd(ad, company, agent) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: company.email,
      subject: '🔔 מודעה חדשה ממתינה לאישור',
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
          <h2 style="color: #667eea;">מודעה חדשה ממתינה לאישור</h2>
          <p><strong>שלום ${company.name},</strong></p>
          <p>סוכן ${agent.fullName} יצר מודעה חדשה עבור הקמפיין שלך.</p>
          
          <div style="background: #f8f9fa; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>${ad.title}</h3>
            <p>${ad.text}</p>
          </div>
          
          <a href="${process.env.APP_URL}/pending-ads" 
             style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 8px; margin-top: 20px;">
            צפה במודעה ואשר
          </a>
          
          <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px;">
            תודה,<br>
            מערכת Ads Maker
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to company:', company.email);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

// שליחת התראה כשמודעה אושרה
async function notifyAdApproved(ad, agent, company) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: agent.email,
      subject: '✅ המודעה שלך אושרה!',
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
          <h2 style="color: #27ae60;">המודעה שלך אושרה! 🎉</h2>
          <p><strong>שלום ${agent.fullName},</strong></p>
          <p>המודעה שיצרת עבור ${company.name} אושרה!</p>
          
          <div style="background: #d4edda; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>${ad.title}</h3>
            <p>${ad.text}</p>
            ${ad.companyFeedback?.rating ? `
              <p><strong>דירוג:</strong> ${'⭐'.repeat(ad.companyFeedback.rating)}</p>
            ` : ''}
            ${ad.companyFeedback?.comment ? `
              <p><strong>הערות:</strong> ${ad.companyFeedback.comment}</p>
            ` : ''}
          </div>
          
          <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px;">
            המשך עבודה מצוינת!<br>
            מערכת Ads Maker
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to agent:', agent.email);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

// שליחת התראה כשמודעה נדחתה
async function notifyAdRejected(ad, agent, company) {
  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: agent.email,
      subject: '❌ המודעה דורשת תיקון',
      html: `
        <div style="font-family: Arial, sans-serif; direction: rtl; text-align: right;">
          <h2 style="color: #e74c3c;">המודעה דורשת תיקון</h2>
          <p><strong>שלום ${agent.fullName},</strong></p>
          <p>המודעה שיצרת עבור ${company.name} נדחתה עם הערות לשיפור.</p>
          
          <div style="background: #f8d7da; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <h3>${ad.title}</h3>
            <p><strong>סיבת הדחייה:</strong> ${getRejectionReasonText(ad.companyFeedback?.rejectionReason)}</p>
            <p><strong>הסבר מפורט:</strong> ${ad.companyFeedback?.rejectionDetails}</p>
            ${ad.companyFeedback?.allowRevision ? `
              <p style="color: #27ae60;"><strong>ניתן לתקן ולהגיש מחדש</strong></p>
            ` : ''}
          </div>
          
          <a href="${process.env.APP_URL}/ad-generator" 
             style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 8px; margin-top: 20px;">
            צור מודעה משופרת
          </a>
          
          <p style="margin-top: 30px; color: #7f8c8d; font-size: 14px;">
            בהצלחה,<br>
            מערכת Ads Maker
          </p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log('✅ Email sent to agent:', agent.email);
  } catch (error) {
    console.error('❌ Error sending email:', error);
  }
}

function getRejectionReasonText(reason) {
  const reasons = {
    'not_relevant': 'לא רלוונטי למותג',
    'poor_quality': 'איכות נמוכה',
    'wrong_message': 'הודעה שגויה',
    'target_audience': 'לא מתאים לקהל היעד',
    'brand_mismatch': 'לא תואם את המותג',
    'other': 'אחר'
  };
  return reasons[reason] || reason;
}

module.exports = {
  notifyNewPendingAd,
  notifyAdApproved,
  notifyAdRejected
};