/**
 * Email Service
 *
 * Centralized transactional email delivery for the AdsMaker platform, powered by
 * SendGrid. Supports multiple email types: payment requests, ad rejection notices
 * with alternatives, unshared-ad reminders, alternative-ad approval notifications,
 * contact form forwarding, and test emails.
 *
 * All emails are rendered as RTL Hebrew HTML templates with inline CSS for
 * maximum email-client compatibility.
 *
 * Configuration:
 *  - EMAIL_DRY_RUN=true  -- logs emails without sending (for development)
 *  - EMAIL_TEST_ADDRESS   -- redirects all emails to a single test inbox
 *  - SENDGRID_API_KEY     -- required for live sending
 *  - SENDGRID_FROM_EMAIL  -- sender address (defaults to system address)
 *
 * Key exports:
 *  - sendPaymentRequestEmail              -- notifies a company that an agent requests payment
 *  - sendAlternativeAdEmail               -- tells an agent their ad was rejected + alternative created
 *  - sendUnsharedAdReminderEmail          -- reminds an agent to share an approved ad
 *  - sendAlternativeAdApprovedEmail       -- tells an agent their alternative ad was approved
 *  - sendAlternativeAdCreatedToCompanyEmail -- asks a company to review a new alternative ad
 *  - sendContactFormEmail                 -- forwards a website contact form submission
 *  - sendTestEmail / validateEmailConfig  -- diagnostic utilities
 *
 * Called by:
 *  - Ad approval/rejection routes
 *  - Payment routes
 *  - lowPerformanceChecker and unsharedAdsChecker (automated notifications)
 *  - Contact form API endpoint
 */
const sgMail = require('@sendgrid/mail');

if (process.env.SENDGRID_API_KEY) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  console.log('SendGrid configured');
} else {
  console.warn('SENDGRID_API_KEY not found');
}

const isDryRun = process.env.EMAIL_DRY_RUN === 'true';
const testEmail = process.env.EMAIL_TEST_ADDRESS;

if (isDryRun) {
  console.log('[EmailService] DRY RUN MODE - emails will be logged but not sent');
}
if (testEmail) {
  console.log(`[EmailService] TEST MODE - all emails will go to: ${testEmail}`);
}

/** YaadPay hosted payment page link, embedded in payment request emails. */
const YAADPAY_LINK = 'https://yaadcrm.yaadpay.co.il/cgi-bin/yaadpay/yaadpay_hyp.pl?Coin=1&FixTash=False&Info=%EC%FA%F9%EC%E5%ED&Masof=0010269223&MoreData=True&PageLang=HEB&Postpone=False&SendHesh=True&ShowEngTashText=True&Tash=6&UTF8out=True&action=pay&freq=1&sendemail=True&tmp=3&signature=7621ae8c97fea138c6ef70a88432ae68987f571d854b3eb0f4395dbfd68a1ae1';

/**
 * Low-level email sender. Handles dry-run logging and test-address redirection
 * before delegating to SendGrid.
 *
 * @param {Object} msg - SendGrid-compatible message object (to, from, subject, html, etc.).
 * @returns {Promise<{success: boolean, dryRun?: boolean}>} Delivery result.
 * @throws {Error} Propagated from SendGrid on delivery failure.
 */
async function sendEmail(msg) {
  const recipient = testEmail || msg.to;

  if (isDryRun) {
    console.log('[DRY RUN] Would send email:');
    console.log(`   To: ${msg.to} ${testEmail ? `(redirected to ${testEmail})` : ''}`);
    console.log(`   Subject: ${msg.subject}`);
    console.log(`   From: ${msg.from?.email || msg.from}`);
    console.log('   Email logged (not actually sent)');
    return { success: true, dryRun: true };
  }

  await sgMail.send({ ...msg, to: recipient });
  console.log(`Email sent to: ${recipient}`);
  return { success: true };
}

/**
 * Builds the HTML body for a payment request email.
 * Includes agent details, ad title, payment amount, and a secure YaadPay payment button.
 * Shows total amount breakdown: Agent share (70%) + Platform fee (30%)
 *
 * @param {Object} params
 * @param {string} params.companyName - Recipient company name.
 * @param {string} params.agentName - Agent who uploaded the ad.
 * @param {string} params.agentEmail - Agent email shown in the details section.
 * @param {string} params.agentPhone - Agent phone shown in the details section.
 * @param {string} params.adTitle - Title of the ad that was published.
 * @param {number} params.amount - Agent's payment amount in ILS (70% share).
 * @param {string} params.paymentId - Internal payment record ID (used for dashboard deep link).
 * @returns {string} Full HTML document string.
 */
function getPaymentRequestEmailHtml({
  companyName,
  agentName,
  agentEmail,
  agentPhone,
  adTitle,
  amount,
  paymentId
}) {
  const dashboardLink = `https://adsmaker-rho.vercel.app/company-dashboard?tab=payments&paymentId=${paymentId}`;

  // Calculate total payment: Agent gets 70%, so total = agent amount / 0.7
  const agentShare = amount;
  const totalAmount = Math.round(amount / 0.7);
  const platformFee = totalAmount - agentShare;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>בקשת תשלום</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 20px;" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">💰 בקשת תשלום</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;" dir="rtl">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px; text-align: right;">
                שלום <strong>${companyName}</strong>,
              </p>
              <p style="font-size: 16px; color: #333; margin-bottom: 25px; text-align: right;">
                הסוכן <strong>${agentName}</strong> טוען שהעלה את הפרסומת שלכם ומבקש תשלום.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #e3f2fd; border-radius: 8px; margin-bottom: 15px;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #2196f3;">
                    <strong style="color: #1565c0;">📢 פרסומת:</strong>
                    <span style="color: #333;"> ${adTitle || 'ללא כותרת'}</span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #fff3e0; border-radius: 8px; margin-bottom: 15px;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #ff9800;">
                    <strong style="color: #e65100;">👤 פרטי הסוכן:</strong><br><br>
                    <table cellpadding="0" cellspacing="0" style="color: #333;" dir="rtl">
                      <tr>
                        <td style="padding: 3px 0; text-align: right;">שם:</td>
                        <td style="padding: 3px 10px; text-align: right;">${agentName}</td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; text-align: right;">אימייל:</td>
                        <td style="padding: 3px 10px; text-align: right;">${agentEmail || 'לא צוין'}</td>
                      </tr>
                      <tr>
                        <td style="padding: 3px 0; text-align: right;">טלפון:</td>
                        <td style="padding: 3px 10px; text-align: right;">${agentPhone || 'לא צוין'}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #e8f5e9; border-radius: 8px; margin: 20px 0;">
                <tr>
                  <td style="padding: 25px; text-align: center;">
                    <div style="color: #666; font-size: 14px; margin-bottom: 10px;">סכום לתשלום:</div>
                    <div style="font-size: 42px; font-weight: bold; color: #2e7d32;">₪${totalAmount}</div>
                  </td>
                </tr>
              </table>
              <p style="text-align: center; color: #666; font-size: 14px; margin: 20px 0;">
                מומלץ לבדוק שהפרסומת אכן הועלתה לפני התשלום.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                <tr>
                  <td align="center">
                    <a href="${YAADPAY_LINK}"
                       style="display: inline-block;
                              background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
                              color: white;
                              padding: 18px 50px;
                              text-decoration: none;
                              border-radius: 30px;
                              font-weight: bold;
                              font-size: 18px;
                              box-shadow: 0 4px 15px rgba(76, 175, 80, 0.4);">
                      💳 לחץ כאן לתשלום מאובטח
                    </a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f5f5f5; border-radius: 8px; margin-top: 20px;">
                <tr>
                  <td style="padding: 15px; text-align: center;">
                    <span style="color: #666; font-size: 12px;">
                      🔒 התשלום מאובטח ומתבצע דרך Hyp
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
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
  `.trim();
}

/**
 * Sends a payment request email to a company on behalf of an agent.
 *
 * @param {Object} params
 * @param {string} params.companyEmail - Recipient email address.
 * @param {string} params.companyName - Company display name.
 * @param {string} params.agentName - Agent who published the ad.
 * @param {string} params.agentEmail - Agent's email for reference.
 * @param {string} params.agentPhone - Agent's phone for reference.
 * @param {string} params.adTitle - Title of the ad.
 * @param {number} params.amount - Payment amount in ILS.
 * @param {string} params.paymentId - Internal payment record ID.
 * @returns {Promise<{success: boolean, error?: string, dryRun?: boolean}>}
 */
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
    console.log('Sending payment request to:', companyEmail);

    if (!process.env.SENDGRID_API_KEY && !isDryRun) {
      return { success: false, error: 'Config missing' };
    }

    if (!companyEmail) {
      return { success: false, error: 'No company email' };
    }

    const emailHtml = getPaymentRequestEmailHtml({
      companyName,
      agentName,
      agentEmail,
      agentPhone,
      adTitle,
      amount,
      paymentId
    });

    return await sendEmail({
      to: companyEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: `💰 בקשת תשלום - הסוכן ${agentName} העלה את הפרסומת`,
      html: emailHtml
    });

  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a rejection notification to an agent, informing them that their ad was
 * declined and that an improved alternative has been created in the system.
 *
 * @param {Object} params
 * @param {string} params.agentEmail - Agent's email address.
 * @param {string} params.agentName - Agent's display name.
 * @param {string} params.companyName - Company the ad belongs to.
 * @param {string} params.rejectionReason - Brief reason for rejection.
 * @param {string} [params.rejectionDetails] - Optional additional details.
 * @param {string} [params.alternativeAdImage] - Not currently rendered but reserved for future use.
 * @param {string} [params.websiteUrl] - Not currently rendered but reserved for future use.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
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
    console.log('Preparing rejection email to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY && !isDryRun) {
      console.warn('SendGrid not configured - skipping email');
      return { success: false, error: 'SendGrid not configured' };
    }

    if (!agentEmail) {
      console.error('No agent email provided');
      return { success: false, error: 'No agent email' };
    }

    const displayCompanyName = companyName || 'החברה';
    const emailSubject = `📢 פרסומת נדחתה - פרסומת חלופית עבור ${displayCompanyName}`;

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%); color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">❌ פרסומת נדחתה</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: right;" dir="rtl">
              <p style="font-size: 16px; color: #333;">שלום <strong>${agentName || 'סוכן יקר'}</strong>,</p>
              <p style="font-size: 16px; color: #333;">הפרסומת עבור <strong>${displayCompanyName}</strong> נדחתה.</p>
              <table width="100%" style="background: #ffebee; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #e74c3c;">
                    <strong style="color: #c0392b;">סיבה:</strong>
                    <span style="color: #333;"> ${rejectionReason || 'לא צוינה'}</span>
                    ${rejectionDetails ? `<br><br><strong style="color: #c0392b;">פרטים:</strong> <span style="color: #333;">${rejectionDetails}</span>` : ''}
                  </td>
                </tr>
              </table>
              <table width="100%" style="background: #e8f5e9; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #4CAF50;">
                    <strong style="color: #2e7d32;">✨ חדשות טובות!</strong>
                    <p style="color: #333; margin: 10px 0 0 0;">יצרנו עבורך פרסומת חלופית משופרת במערכת.</p>
                  </td>
                </tr>
              </table>
              <table width="100%" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="https://adsmaker-rho.vercel.app/"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold;">
                      היכנס למערכת לצפייה
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px;">
              מערכת Ads Maker
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return await sendEmail({
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: emailSubject,
      html: emailHtml
    });

  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a reminder to an agent that an approved ad has not yet been shared
 * on social media. Optionally mentions that an alternative ad is available.
 *
 * @param {Object} params
 * @param {string} params.agentEmail - Agent's email address.
 * @param {string} params.agentName - Agent's display name.
 * @param {string} params.companyName - Company the ad belongs to.
 * @param {string} params.adTitle - Title of the unshared ad.
 * @param {number} params.daysSinceApproval - Number of days since the ad was approved.
 * @param {boolean} params.hasAlternative - Whether an alternative ad has been generated.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendUnsharedAdReminderEmail({
  agentEmail,
  agentName,
  companyName,
  adTitle,
  daysSinceApproval,
  hasAlternative
}) {
  try {
    console.log('Preparing unshared ad reminder to:', agentEmail);

    if (!process.env.SENDGRID_API_KEY && !isDryRun) {
      return { success: false, error: 'Config missing' };
    }

    if (!agentEmail) {
      return { success: false, error: 'No email provided' };
    }

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%); color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">💡 תזכורת - פרסומת ממתינה</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: right;" dir="rtl">
              <p style="font-size: 16px; color: #333;">היי <strong>${agentName}</strong>,</p>
              <p style="font-size: 16px; color: #333;">
                הפרסומת <strong>"${adTitle}"</strong> עבור <strong>${companyName}</strong>
                אושרה לפני <strong>${daysSinceApproval} ימים</strong> אבל עדיין לא שותפה.
              </p>
              ${hasAlternative ? `
              <table width="100%" style="background: #e3f2fd; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #2196f3;">
                    <strong style="color: #1565c0;">🎨 יצרנו גם פרסומת חלופית!</strong>
                    <p style="color: #333; margin: 10px 0 0 0;">אם הפרסומת המקורית לא מתאימה, יש לך אפשרות נוספת במערכת.</p>
                  </td>
                </tr>
              </table>
              ` : ''}
              <table width="100%" style="background: #fff3e0; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #ff9800;">
                    <strong style="color: #e65100;">💡 טיפים לשיתוף מוצלח:</strong>
                    <ul style="color: #333; margin: 10px 0 0 0; padding-right: 20px; text-align: right;">
                      <li style="text-align: right;">שתף בשעות פעילות גבוהות (10:00-12:00, 19:00-21:00)</li>
                      <li style="text-align: right;">הוסף טקסט אישי משלך</li>
                      <li style="text-align: right;">השתמש בהאשטגים רלוונטיים</li>
                    </ul>
                  </td>
                </tr>
              </table>
              <table width="100%" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="https://adsmaker-rho.vercel.app/"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold;">
                      היכנס למערכת ושתף
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px;">
              מערכת Ads Maker
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return await sendEmail({
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '💡 תזכורת - פרסומת ממתינה לשיתוף',
      html: emailHtml
    });

  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notifies an agent that their alternative ad has been approved by the company.
 *
 * @param {Object} params
 * @param {string} params.agentEmail - Agent's email address.
 * @param {string} params.agentName - Agent's display name.
 * @param {string} params.companyName - Company the ad belongs to.
 * @param {string} params.adTitle - Title of the approved alternative ad.
 * @param {string} [params.originalAdTitle] - Title of the original ad (for context).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendAlternativeAdApprovedEmail({
  agentEmail,
  agentName,
  companyName,
  adTitle,
  originalAdTitle
}) {
  try {
    if (!process.env.SENDGRID_API_KEY && !isDryRun) {
      return { success: false, error: 'Config missing' };
    }

    if (!agentEmail) {
      return { success: false, error: 'No email provided' };
    }

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%); color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🎉 פרסומת חלופית אושרה!</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: right;" dir="rtl">
              <p style="font-size: 16px; color: #333;">היי <strong>${agentName}</strong>,</p>
              <p style="font-size: 16px; color: #333;">
                הפרסומת החלופית <strong>"${adTitle}"</strong> עבור <strong>${companyName}</strong> אושרה!
              </p>
              <table width="100%" style="background: #e8f5e9; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 20px; text-align: center;">
                    <span style="font-size: 48px;">✅</span>
                    <p style="color: #2e7d32; font-weight: bold; margin: 10px 0 0 0;">הפרסומת מוכנה לשיתוף!</p>
                  </td>
                </tr>
              </table>
              <table width="100%" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="https://adsmaker-rho.vercel.app/"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold;">
                      היכנס למערכת לשתף
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px;">
              מערכת Ads Maker
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return await sendEmail({
      to: agentEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '🎉 פרסומת חלופית אושרה!',
      html: emailHtml
    });

  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Notifies a company that the system has automatically created an alternative ad
 * for review, triggered either by low QR-scan performance or because the original
 * ad was never shared.
 *
 * @param {Object} params
 * @param {string} params.companyEmail - Company email address.
 * @param {string} params.companyName - Company display name.
 * @param {string} params.agentName - Agent associated with the ad.
 * @param {string} params.originalAdTitle - Title of the original ad.
 * @param {string} params.reason - Trigger reason ('low_performance_qr' | 'unshared').
 * @param {number} params.currentScans - Current QR scan count (relevant for low-performance trigger).
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendAlternativeAdCreatedToCompanyEmail({
  companyEmail,
  companyName,
  agentName,
  originalAdTitle,
  reason,
  currentScans
}) {
  try {
    console.log('Notifying company about alternative ad:', companyEmail);

    if (!process.env.SENDGRID_API_KEY && !isDryRun) {
      return { success: false, error: 'Config missing' };
    }

    if (!companyEmail) {
      return { success: false, error: 'No company email' };
    }

    // Build a human-readable reason string based on the trigger type
    const reasonText = reason === 'low_performance_qr'
      ? `הפרסומת "${originalAdTitle}" קיבלה רק ${currentScans} סריקות QR`
      : `הפרסומת "${originalAdTitle}" לא שותפה עדיין`;

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head><meta charset="UTF-8"></head>
<body style="margin: 0; padding: 20px; font-family: Arial, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 25px; text-align: center;">
              <h1 style="margin: 0; font-size: 24px;">🎨 פרסומת חלופית ממתינה לאישור</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px; text-align: right;" dir="rtl">
              <p style="font-size: 16px; color: #333;">שלום <strong>${companyName}</strong>,</p>
              <p style="font-size: 16px; color: #333;">המערכת זיהתה ש${reasonText}.</p>
              <table width="100%" style="background: #e3f2fd; border-radius: 8px; margin: 20px 0;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #2196f3;">
                    <strong style="color: #1565c0;">✨ יצרנו עבורכם פרסומת חלופית משופרת!</strong>
                    <p style="color: #333; margin: 10px 0 0 0;">הפרסומת ממתינה לאישורכם במערכת.</p>
                  </td>
                </tr>
              </table>
              <p style="color: #666; font-size: 14px; text-align: right;">סוכן: ${agentName}</p>
              <table width="100%" style="margin: 25px 0;">
                <tr>
                  <td align="center">
                    <a href="https://adsmaker-rho.vercel.app/company-dashboard"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 30px; font-weight: bold;">
                      צפה ואשר את הפרסומת
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px;">
              מערכת Ads Maker - יצירת פרסומות אוטומטית
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    return await sendEmail({
      to: companyEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '🎨 פרסומת חלופית ממתינה לאישורכם',
      html: emailHtml
    });

  } catch (error) {
    console.error('Email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Sends a simple test email for verifying SendGrid configuration.
 *
 * @param {string} toEmail - Recipient address.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendTestEmail(toEmail) {
  try {
    console.log('Sending test email to:', toEmail);

    return await sendEmail({
      to: toEmail,
      from: { email: process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com', name: 'AdsMaker' },
      subject: '🧪 מייל בדיקה - AdsMaker',
      html: `
        <div style="font-family: Arial; direction: rtl; text-align: right; padding: 20px;">
          <h2>✅ המייל עובד!</h2>
          <p>זהו מייל בדיקה ממערכת AdsMaker.</p>
          <p>תאריך: ${new Date().toLocaleString('he-IL')}</p>
          <p>מצב: ${isDryRun ? 'DRY RUN' : 'LIVE'}</p>
        </div>
      `
    });
  } catch (error) {
    console.error('Test email error:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Checks whether email sending is properly configured (either a real API key
 * or dry-run mode).
 *
 * @returns {boolean} True if emails can be sent or simulated.
 */
function validateEmailConfig() {
  return !!process.env.SENDGRID_API_KEY || isDryRun;
}

/**
 * Forwards a contact form submission from the website to the system admin email.
 * Sets the reply-to header to the submitter's email so the admin can respond directly.
 *
 * @param {Object} params
 * @param {string} params.name - Name of the person who filled out the form.
 * @param {string} params.email - Submitter's email address (set as reply-to).
 * @param {string} params.message - The message body from the form.
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function sendContactFormEmail({ name, email, message }) {
  try {
    const systemEmail = process.env.SENDGRID_FROM_EMAIL || 'hilamaayan99@gmail.com';

    console.log('Sending contact form email from:', email);

    const emailHtml = `
<!DOCTYPE html>
<html dir="rtl" lang="he">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>פנייה חדשה מטופס יצירת קשר</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f6f9; direction: rtl;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f6f9; padding: 20px;" dir="rtl">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background: white; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);" dir="rtl">
          <tr>
            <td style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
              <h1 style="margin: 0; font-size: 28px;">📬 פנייה חדשה מהאתר</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 30px;" dir="rtl">
              <p style="font-size: 16px; color: #333; margin-bottom: 20px; text-align: right;">
                התקבלה פנייה חדשה מטופס יצירת הקשר באתר:
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #e8f5e9; border-radius: 8px; margin-bottom: 15px;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #4caf50;">
                    <strong style="color: #2e7d32;">👤 שם:</strong>
                    <span style="color: #333;"> ${name}</span>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #e3f2fd; border-radius: 8px; margin-bottom: 15px;" dir="rtl">
                <tr>
                  <td style="padding: 15px; text-align: right; border-right: 4px solid #2196f3;">
                    <strong style="color: #1565c0;">📧 אימייל:</strong>
                    <a href="mailto:${email}" style="color: #1976d2; text-decoration: none;"> ${email}</a>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #fff3e0; border-radius: 8px; margin-bottom: 20px;" dir="rtl">
                <tr>
                  <td style="padding: 20px; text-align: right; border-right: 4px solid #ff9800;">
                    <strong style="color: #e65100; display: block; margin-bottom: 10px;">💬 הודעה:</strong>
                    <p style="color: #333; margin: 0; white-space: pre-wrap; line-height: 1.6;">${message}</p>
                  </td>
                </tr>
              </table>
              <table width="100%" cellpadding="0" cellspacing="0" dir="rtl">
                <tr>
                  <td align="center" style="padding-top: 10px;">
                    <a href="mailto:${email}?subject=תשובה לפנייתך ב-AdsMaker"
                       style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; text-decoration: none; padding: 15px 40px; border-radius: 30px; font-size: 16px; font-weight: bold;">
                      ↩️ השב לפונה
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background: #f8f9fa; padding: 20px; text-align: center; border-top: 1px solid #eee;">
              <p style="margin: 0; color: #666; font-size: 14px;">
                📅 תאריך: ${new Date().toLocaleString('he-IL')}
              </p>
              <p style="margin: 10px 0 0; color: #999; font-size: 12px;">
                הודעה זו נשלחה אוטומטית ממערכת AdsMaker
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

    return await sendEmail({
      to: systemEmail,
      from: { email: systemEmail, name: 'AdsMaker Contact Form' },
      replyTo: email,
      subject: `📬 פנייה חדשה מ-${name}`,
      html: emailHtml
    });

  } catch (error) {
    console.error('Contact form email error:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendAlternativeAdEmail,
  sendUnsharedAdReminderEmail,
  sendAlternativeAdApprovedEmail,
  sendAlternativeAdCreatedToCompanyEmail,
  sendPaymentRequestEmail,
  sendContactFormEmail,
  sendTestEmail,
  validateEmailConfig,
  isDryRun,
  YAADPAY_LINK,
  getPaymentRequestEmailHtml
};
