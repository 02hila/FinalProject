/**
 * simple-test.js -- Nodemailer Import Smoke Test
 *
 * Purpose:
 *   Verifies that the nodemailer package is installed and importable.
 *   Logs the module type, available API surface (keys), and specifically
 *   checks for the createTransporter function. Useful for diagnosing
 *   missing-dependency issues on new environments.
 *
 * Usage:
 *   node server/simple-test.js
 *
 * Connections:
 *   - Tests the same nodemailer dependency used by test-email.js and the
 *     production email service (server/services/emailService or similar).
 */

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
