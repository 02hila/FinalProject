console.log('Testing nodemailer import...');

try {
  const nodemailer = require('nodemailer');
  console.log('✅ nodemailer loaded');
  console.log('Type:', typeof nodemailer);
  console.log('Has createTransporter?', typeof nodemailer.createTransporter);
  console.log('Keys:', Object.keys(nodemailer));
} catch (err) {
  console.error('❌ Error:', err.message);
}