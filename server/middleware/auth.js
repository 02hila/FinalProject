/**
 * @file auth.js - Authentication and Authorization Middleware
 *
 * Provides Express middleware functions for protecting API routes and enforcing
 * role-based access control throughout the application.
 *
 * Typical usage in route definitions:
 *   router.get('/protected', authMiddleware, handler);
 *   router.get('/admin-only', authMiddleware, isAdmin, handler);
 *   router.get('/company-area', authMiddleware, requireUserType('company'), handler);
 *
 * @exports {Function} authMiddleware    - Validates JWT tokens and attaches user data to req.
 * @exports {Function} requireUserType   - Factory that returns middleware restricting access to a given user type.
 * @exports {Function} isAdmin           - Middleware restricting access to admin users.
 * @exports {Function} isAdminOrCompany  - Middleware restricting access to admin or company users.
 *
 * Dependencies:
 *   - jsonwebtoken          -- for JWT verification.
 *   - ../models/User        -- Mongoose User model for DB lookups.
 *   - process.env.JWT_SECRET -- secret used to sign/verify tokens.
 *
 * Related files:
 *   - server/routes/*       -- route files that consume these middleware functions.
 *   - server/middleware/adminAuth.js -- a lighter duplicate of isAdmin / isAdminOrCompany.
 */

const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Core authentication middleware.
 *
 * Extracts the Bearer token from the Authorization header, verifies it against
 * the JWT secret, fetches the corresponding user from MongoDB, and attaches the
 * result to the request object for downstream handlers.
 *
 * After successful execution the request object will contain:
 *   - req.userId  {string}  -- The authenticated user's MongoDB _id.
 *   - req.user    {Object}  -- The full user document (password excluded).
 *   - req.userType {string} -- Shorthand for the user's role ('agent', 'company', 'admin').
 *
 * @param {import('express').Request}  req  - Express request object.
 * @param {import('express').Response} res  - Express response object.
 * @param {import('express').NextFunction} next - Express next callback.
 * @returns {void}
 */
const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      console.log('No token provided');
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    // Support tokens issued with either `userId` or `id` as the claim key.
    req.userId = decoded.userId || decoded.id;
    console.log('Decoded token - userId:', req.userId);

    const user = await User.findById(req.userId).select('-password');
    if (!user) {
      console.log('User not found for ID:', req.userId);
      return res.status(401).json({
        success: false,
        message: 'User not found'
      });
    }

    // Block deactivated accounts even if their token is still valid.
    if (!user.isActive) {
      console.log('User account inactive:', user._id);
      return res.status(401).json({
        success: false,
        message: 'Account inactive'
      });
    }

    req.user = user;
    req.userType = user.userType;
    console.log('Auth successful - User:', user.fullName, 'Type:', user.userType, 'ID:', user._id);
    next();
  } catch (error) {
    console.error('Auth middleware error:', error.message);

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
 * Factory function that creates middleware to restrict a route to a single user type.
 *
 * Must be used after authMiddleware so that req.user is available.
 *
 * @param {string} userType - The required user type ('agent' | 'company' | 'admin').
 * @returns {Function} Express middleware that returns 403 if the user's type does not match.
 *
 * @example
 * router.get('/agents-only', authMiddleware, requireUserType('agent'), handler);
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
 * Middleware that restricts route access to admin users only.
 * Must be placed after authMiddleware in the middleware chain.
 *
 * @param {import('express').Request}  req  - Express request (must contain req.userType).
 * @param {import('express').Response} res  - Express response object.
 * @param {import('express').NextFunction} next - Express next callback.
 * @returns {void} Calls next() on success or responds with 403.
 */
const isAdmin = (req, res, next) => {
  if (!req.userType || req.userType !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access only'
    });
  }
  next();
};

/**
 * Middleware that restricts route access to admin or company users.
 * Useful for shared dashboards and management endpoints accessible to both roles.
 * Must be placed after authMiddleware in the middleware chain.
 *
 * @param {import('express').Request}  req  - Express request (must contain req.userType).
 * @param {import('express').Response} res  - Express response object.
 * @param {import('express').NextFunction} next - Express next callback.
 * @returns {void} Calls next() on success or responds with 403.
 */
const isAdminOrCompany = (req, res, next) => {
  if (!req.userType || !['admin', 'company'].includes(req.userType)) {
    return res.status(403).json({
      success: false,
      message: 'Admin or company access only'
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
