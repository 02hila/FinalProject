/**
 * @file adminAuth.js - Admin and Company Authorization Middleware
 *
 * Lightweight role-checking middleware intended for routes that need to verify
 * admin or company privileges. These guards assume that the main authentication
 * middleware (authMiddleware from ./auth.js) has already run and populated
 * req.userType on the request object.
 *
 * Note: Similar guards also exist in ./auth.js. This module is kept as a
 * standalone file so that route files can import only the admin checks without
 * pulling in the full auth stack.
 *
 * @exports {Function} isAdmin          - Allows only admin users.
 * @exports {Function} isAdminOrCompany - Allows admin and company users.
 *
 * Related files:
 *   - server/middleware/auth.js  -- provides authMiddleware (must run first)
 *                                    and contains equivalent isAdmin / isAdminOrCompany exports.
 *   - server/routes/admin.js     -- primary consumer of these guards.
 */

/**
 * Middleware that permits only admin users to proceed.
 * Responds with 403 Forbidden if the user is not authenticated as an admin.
 *
 * @param {import('express').Request}  req  - Express request (must have req.userType set by authMiddleware).
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
 * Middleware that permits admin and company users to proceed.
 * Responds with 403 Forbidden if the user is neither an admin nor a company account.
 *
 * @param {import('express').Request}  req  - Express request (must have req.userType set by authMiddleware).
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

module.exports = { isAdmin, isAdminOrCompany };
