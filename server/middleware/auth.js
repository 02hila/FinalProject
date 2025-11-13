const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Middleware לבדיקת אימות
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'אין טוקן אימות'
      });
    }

    // אימות ה-token
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');

    // קבלת המשתמש מהדאטאבייס
    const user = await User.findById(decoded.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'משתמש לא נמצא'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'חשבון לא פעיל'
      });
    }

    // הוספת המשתמש ל-request
    req.user = user;
    req.userId = user._id;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'token לא תקין'
      });
    }
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'token פג תוקף'
      });
    }

    console.error('Auth middleware error:', error);
    return res.status(500).json({
      success: false,
      error: 'שגיאת אימות'
    });
  }
};

// Middleware לבדיקת סוג משתמש
const requireUserType = (userType) => {
  return (req, res, next) => {
    if (req.user.userType !== userType) {
      return res.status(403).json({
        success: false,
        error: 'אין הרשאה לגשת למשאב זה'
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requireUserType
};