require('dotenv').config();
const nodemailer = require('nodemailer');

async function testEmail() {
  console.log('🧪 Testing email configuration...');
  console.log('📧 Email User:', process.env.EMAIL_USER);
  console.log('🔑 Has Password:', !!process.env.EMAIL_PASSWORD);
  console.log('🔑 Password length:', process.env.EMAIL_PASSWORD?.length);
  
const transporter = nodemailer.createTransport({    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD
    }
  });

  console.log('📨 Attempting to send email...');

  try {
    const info = await transporter.sendMail({
      from: `"AdsMaker Test" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      subject: '🧪 Test Email from AdsMaker',
      html: `
        <h1>✅ Email configuration works!</h1>
        <p>If you received this email, nodemailer is configured correctly.</p>
        <p>Time: ${new Date().toLocaleString()}</p>
      `
    });
    
    console.log('✅ Email sent successfully!');
    console.log('📬 Message ID:', info.messageId);
    console.log('📧 Check your inbox at:', process.env.EMAIL_USER);
  } catch (error) {
    console.error('❌ Email failed!');
    console.error('Error message:', error.message);
  }
}

testEmail();