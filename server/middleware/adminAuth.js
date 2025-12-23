// server/middleware/adminAuth.js

const isAdmin = (req, res, next) => {
    // בודק אם המשתמש מחובר ושהוא admin
    if (!req.userType || req.userType !== 'admin') {
        return res.status(403).json({
            success: false,
            message: 'גישה למנהלים בלבד'
        });
    }
    next();
};

// Middleware לבדיקה אם המשתמש הוא admin או company
const isAdminOrCompany = (req, res, next) => {
    if (!req.userType || !['admin', 'company'].includes(req.userType)) {
        return res.status(403).json({
            success: false,
            message: 'גישה למנהלים וחברות בלבד'
        });
    }
    next();
};

module.exports = { isAdmin, isAdminOrCompany };