const express = require('express');
const router = express.Router();
const User = require('../models/User');
const { authMiddleware } = require('../middleware/auth');

// GET - קבלת רשימת משתמשים (עם סינון)
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { userType, companyId } = req.query;
    
    const query = {};
    
    // סינון לפי סוג משתמש
    if (userType) {
      query.userType = userType;
    }
    
    // סינון לפי חברה
    if (companyId) {
      query.companyId = companyId;
    }
    
    console.log('🔍 Fetching users with query:', query);
    
    // טען משתמשים (ללא סיסמאות!)
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

// GET - קבלת משתמש לפי ID
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

module.exports = router;