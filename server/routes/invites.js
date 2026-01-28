// server/routes/invites.js
const express = require('express');
const router = express.Router();
const { customAlphabet } = require('nanoid');
const InviteCode = require('../models/InviteCode');
const { authMiddleware, requireUserType } = require('../middleware/auth');

// הגדרת תווים לקוד
const nanoid = customAlphabet('ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789', 8);

// Generate new invitation code (companies only)
router.post('/generate', authMiddleware, requireUserType('company'), async (req, res) => {
  try {
    const code = nanoid();
    const newInvite = new InviteCode({
      code,
      companyId: req.user._id,
    });
    await newInvite.save();
    res.status(201).json({ success: true, code: newInvite.code });
  } catch (error) {
    console.error('Error generating invite code:', error);
    res.status(500).json({ success: false, error: 'Failed to generate invite code' });
  }
});

// בדיקת תקינות קוד הזמנה
router.get('/validate/:code', async (req, res) => {
  try {
    const { code } = req.params;
    const invite = await InviteCode.findOne({ code, isUsed: false })
      .populate('companyId', 'companyName fullName');

    if (!invite) {
      return res.status(404).json({ success: false, message: 'קוד הזמנה לא תקין או שכבר נעשה בו שימוש' });
    }

    res.json({
      success: true,
      message: 'קוד הזמנה תקין',
      companyId: invite.companyId._id,
      companyName: invite.companyId.companyName || invite.companyId.fullName
    });
  } catch (error) {
    console.error('Error validating invite code:', error);
    res.status(500).json({ success: false, error: 'Failed to validate invite code' });
  }
});

module.exports = router;