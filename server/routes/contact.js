const express = require('express');
const router = express.Router();
const { sendContactFormEmail } = require('../services/emailService');

router.post('/', async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required'
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email address'
      });
    }

    console.log('Contact form submission:', { name, email, messageLength: message.length });

    const result = await sendContactFormEmail({ name, email, message });

    if (result.success) {
      console.log('Contact form email sent successfully');
      res.json({
        success: true,
        message: 'Message sent successfully. We will contact you soon.'
      });
    } else {
      console.error('Contact form email failed:', result.error);
      res.status(500).json({
        success: false,
        message: 'Failed to send message. Please try again later.'
      });
    }

  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
});

module.exports = router;
