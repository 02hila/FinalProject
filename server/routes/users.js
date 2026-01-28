const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// GET - Get list of users (with filtering)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userType, companyId } = req.query;

    const query = {};

    // Filter by user type
    if (userType) {
      query.userType = userType;
    }

    // Filter by company
    if (companyId) {
      query.companyId = companyId;
    }

    console.log('🔍 Fetching users with query:', query);

    // Load users (without passwords!)
    const users = await User.find(query)
      .select('-password')
      .sort({ createdAt: -1 });
    
    console.log('✅ Found', users.length, 'users');
    
    res.json({ 
      success: true, 
      users 
    });
  } catch (error) {
    console.error('❌ Error fetching users:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בטעינת משתמשים',
      error: error.message 
    });
  }
});

// GET - Get user by ID
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        message: 'משתמש לא נמצא' 
      });
    }
    
    res.json({ 
      success: true, 
      user 
    });
  } catch (error) {
    console.error('❌ Error fetching user:', error);
    res.status(500).json({ 
      success: false, 
      message: 'שגיאה בטעינת משתמש',
      error: error.message 
    });
  }
});

// PUT - Mark onboarding guide as seen
router.put('/mark-guide-seen', authMiddleware, async (req, res) => {
  try {
    console.log('📘 Marking guide as seen for user:', req.userId);

    const user = await User.findByIdAndUpdate(
      req.userId,
      { hasSeenGuide: true },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'משתמש לא נמצא'
      });
    }

    console.log('✅ Guide marked as seen for:', user.fullName || user.email);

    res.json({
      success: true,
      message: 'המדריך סומן כנצפה',
      user
    });
  } catch (error) {
    console.error('❌ Error marking guide as seen:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בעדכון סטטוס המדריך',
      error: error.message
    });
  }
});

module.exports = router;