const jwt = require('jsonwebtoken');
const User = require('../models/User');

const authMiddleware = async (req, res, next) => {
  try {
    // קבלת הטוקן מהכותרת Authorization
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    // אימות ופענוח הטוקן
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // תמיכה גם ב-decoded.userId וגם ב-decoded.id
    req.userId = decoded.userId || decoded.id;

    if (!req.userId) {
      return res.status(401).json({
        success: false,
        message: 'Token missing user ID'
      });
    }

    // הבאת המשתמש מהדאטאבייס
    const user = await User.findById(req.userId).select('-password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account inactive'
      });
    }

    // הוספת המשתמש לבקשה
    req.user = user;

    next();
  } catch (error) {
    console.error('Auth middleware error:', error);

    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired'
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

// בדיקת הרשאה לפי סוג משתמש
const requireUserType = (userType) => {
  return (req, res, next) => {
    if (req.user.userType !== userType) {
      return res.status(403).json({
        success: false,
        error: 'Access denied'
      });
    }
    next();
  };
};

module.exports = {
  authMiddleware,
  requireUserType
};
