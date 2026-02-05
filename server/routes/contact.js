const express = require('express');
const router = express.Router();
const { sendContactFormEmail } = require('../services/emailService');
/**
 * @route   POST /contact
 * @desc    Submit a contact form and trigger an automated email
 * @access  Public
 */
router.post('/', async (req, res) => {
  try {
    // 1. Destructure data from the request body
    const { name, email, message } = req.body;
    /**
     * Validation: Check for required fields
     */
    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }
    /**
     * Validation: Verify email format using Regex
     */
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }
    // Log the event for internal monitoring
    console.log('Contact form submission:', { name, email, messageLength: message.length });
    /**
     * Execution: Attempt to send the email via the email service
     * @returns {Promise<{success: boolean, error?: any}>}
     */
    const result = await sendContactFormEmail({ name, email, message });

    if (result.success) {
      console.log('Contact form email sent successfully');
      res.json({
        success: true,
        message: 'Message sent successfully. We will contact you soon.'
      });
    } else {
      // Log specific service error but keep client response generic
      console.error('Contact form email failed:', result.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message. Please try again later.'
      });
    }

  } catch (error) {
    /**
     * Catch-all for unexpected server errors (e.g., service downtime)
     */
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

module.exports = router;
