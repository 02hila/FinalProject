/**
 * Authentication Middleware
 *
 * This module provides middleware functions for protecting API routes
 * and enforcing role-based access control.
 *
 * Exports:
 *   - authMiddleware: Validates JWT tokens and loads user data
 *   - requireUserType: Restricts access to specific user types
 *   - isAdmin: Restricts access to admin users only
 *   - isAdminOrCompany: Restricts access to admin or company users
 *
 * Usage:
 *   router.get('/protected', authMiddleware, handler);
 *   router.get('/admin-only', authMiddleware, isAdmin, handler);
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Main authentication middleware.
 *
 * Validates the JWT token from the Authorization header, loads the user
 * from the database, and attaches user data to the request object.
 *
 * Sets on request:
 *   - req.userId: The authenticated user's ID
 *   - req.user: Full user object (without password)
 *   - req.userType: User type (agent, company, admin)
 *
 * Returns 401 if token is missing, invalid, expired, or user not found.
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({ 
        success: false, 
        message: 'No token provided' 
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.userId = decoded.userId || decoded.id;
    console.log('🔐 Decoded token - userId:', req.userId);

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      console.log('❌ User not found for ID:', req.userId);
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }

    if (!user.isActive) {
      console.log('❌ User account inactive:', user._id);
      return res.status(401).json({
        success: false,
        message: 'Account inactive'
      });
    }

    req.user = user;
    req.userType = user.userType; // הוספת userType ל-request
    console.log('✅ Auth successful - User:', user.fullName, 'Type:', user.userType, 'ID:', user._id);
    next();
  } catch (error) {
    console.error('❌ Auth middleware error:', error.message);

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

    res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Restricts route access to a specific user type.
 *
 * @param {string} userType - Required user type ('agent', 'company', 'admin')
 * @returns {Function} Express middleware function
 *
 * Example: router.get('/agents-only', authMiddleware, requireUserType('agent'), handler);
 */
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

/**
 * Restricts route access to admin users only.
 * Returns 403 Forbidden if user is not an admin.
 */
const isAdmin = (req, res, next) => {
  if (!req.userType || req.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'גישה למנהלים בלבד'
    });
  }
  next();
};

/**
 * Restricts route access to admin or company users.
 * Used for routes that both admins and companies can access.
 * Returns 403 Forbidden if user is neither admin nor company.
 */
const isAdminOrCompany = (req, res, next) => {
  if (!req.userType || !['admin', 'company'].includes(req.userType)) {
    return res.status(403).json({
      success: false,
      message: 'גישה למנהלים וחברות בלבד'
    });
  }
  next();
};

module.exports = {
  authMiddleware,
  requireUserType,
  isAdmin,
  isAdminOrCompany
};