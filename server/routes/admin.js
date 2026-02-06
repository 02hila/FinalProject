/**
 * Admin Routes Module
 *
 * This module provides administrative endpoints for managing the system.
 * It includes functionalities for creating admins, fetching system statistics,
 * managing users, and handling ads. All routes require authentication and admin privileges.
 *
 * @module routes/admin
 */

const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const QRScan = require('../models/QRScan');
const PriceProposal = require('../models/PriceProposal');
const AgentRating = require('../models/AgentRating'); 
const InviteCode = require('../models/InviteCode');
const { authMiddleware, isAdmin } = require('../middleware/auth');

/**
 * Create First Admin
 *
 * Creates the first admin user in the system. This endpoint is protected by a secret key
 * and can only be used if no admin exists yet.
 *
 * @route POST /api/admin/create-first-admin
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - Admin email address
 * @param {string} req.body.password - Admin password
 * @param {string} req.body.fullName - Admin full name
 * @param {string} req.body.secretKey - Secret key for protection
 * @returns {Object} JSON response with success status and message
 * @throws {403} If secret key is invalid
 * @throws {400} If admin already exists or email is already in use
 * @throws {500} If there's an error creating the admin
 */
router.post('/create-first-admin', async (req, res) => {
    try {
        const { email, password, fullName, secretKey } = req.body;

        // Secret key for protection
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ads-maker-admin-2024';

        if (secretKey !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'Invalid secret key'
            });
        }

        // Check if an admin already exists in the system
        const existingAdmin = await User.findOne({ userType: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'An admin already exists in the system'
            });
        }

        // Check if the email already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        // Creating the admin
        const admin = new User({
            email,
            password,
            fullName,
            userType: 'admin',
            isActive: true,
            isVerified: true
        });

        await admin.save();
        console.log('✅ First admin created:', email);

        res.status(201).json({
            success: true,
            message: 'מנהל ראשון נוצר בהצלחה!'
        });

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת מנהל'
        });
    }
});

/**
 * Create Additional Admin
 *
 * Creates an additional admin user. This endpoint requires authentication and admin privileges.
 * Only existing admins can create new admins.
 *
 * @route POST /api/admin/create-admin
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {Object} req.body - Request body
 * @param {string} req.body.email - New admin email address
 * @param {string} req.body.password - New admin password
 * @param {string} req.body.fullName - New admin full name
 * @returns {Object} JSON response with success status and message
 * @throws {400} If email is already in use
 * @throws {500} If there's an error creating the admin
 */
router.post('/create-admin', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { email, password, fullName } = req.body;

        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        const admin = new User({
            email,
            password,
            fullName,
            userType: 'admin',
            isActive: true,
            isVerified: true
        });

        await admin.save();
        console.log('✅ New admin created by:', req.userId);

        res.status(201).json({
            success: true,
            message: 'מנהל חדש נוצר בהצלחה!'
        });

    } catch (error) {
        console.error('❌ Error creating admin:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה ביצירת מנהל'
        });
    }
});

/**
 * Get System Statistics
 *
 * Retrieves general system statistics including user counts, ad statistics, and monthly trends.
 * This endpoint is restricted to admins only.
 *
 * @route GET /api/admin/system-stats
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @returns {Object} JSON response with system statistics
 * @property {Object} stats - Statistics object
 * @property {Object} stats.users - User statistics (total, agents, companies, admins)
 * @property {Object} stats.ads - Ad statistics (total, approved, pending, rejected, approvalRate)
 * @property {number} stats.campaigns - Total number of campaigns
 * @property {Array} stats.monthlyStats - Monthly ad statistics for the last 6 months
 * @throws {500} If there's an error fetching statistics
 */
router.get('/system-stats', authMiddleware, isAdmin, async (req, res) => {
    try {
        const [
            totalUsers,
            totalAgents,
            totalCompanies,
            totalAdmins,
            totalAds,
            approvedAds,
            pendingAds,
            rejectedAds,
            totalCampaigns
        ] = await Promise.all([
            User.countDocuments(),
            User.countDocuments({ userType: 'agent' }),
            User.countDocuments({ userType: 'company' }),
            User.countDocuments({ userType: 'admin' }),
            PendingAd.countDocuments(),
            PendingAd.countDocuments({ status: 'approved' }),
            PendingAd.countDocuments({ status: 'pending' }),
            PendingAd.countDocuments({ status: 'rejected' }),
            Campaign ? Campaign.countDocuments() : 0
        ]);

        // Statistics by month (last 6 months)
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyStats = await PendingAd.aggregate([
            { $match: { createdAt: { $gte: sixMonthsAgo } } },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            stats: {
                users: {
                    total: totalUsers,
                    agents: totalAgents,
                    companies: totalCompanies,
                    admins: totalAdmins
                },
                ads: {
                    total: totalAds,
                    approved: approvedAds,
                    pending: pendingAds,
                    rejected: rejectedAds,
                    approvalRate: totalAds > 0 ? Math.round((approvedAds / totalAds) * 100) : 0
                },
                campaigns: totalCampaigns,
                monthlyStats
            }
        });

    } catch (error) {
        console.error('❌ Error fetching system stats:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת סטטיסטיקות'
        });
    }
});

/**
 * Get All Users
 *
 * Retrieves a paginated list of all users in the system, with optional filtering by user type and search.
 * This endpoint is restricted to admins only.
 *
 * @route GET /api/admin/users
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.userType] - Filter by user type (agent, company, admin)
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of users per page
 * @param {string} [req.query.search] - Search term for fullName, email, or companyName
 * @returns {Object} JSON response with users list and pagination info
 * @property {Array} users - List of user objects (without passwords)
 * @property {Object} pagination - Pagination metadata (total, page, pages)
 * @throws {500} If there's an error fetching users
 */
router.get('/users', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userType, page = 1, limit = 20, search } = req.query;

        const filter = {};
        if (userType) filter.userType = userType;
        if (search) {
            filter.$or = [
                { fullName: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { companyName: { $regex: search, $options: 'i' } }
            ];
        }

        const users = await User.find(filter)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await User.countDocuments(filter);

        res.json({
            success: true,
            users,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching users:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת משתמשים'
        });
    }
});

/**
 * Toggle User Active Status
 *
 * Enables or disables a user account. Admins cannot disable their own accounts.
 * This endpoint is restricted to admins only.
 *
 * @route PUT /api/admin/toggle-user/:userId
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {string} req.params.userId - ID of the user to toggle
 * @returns {Object} JSON response with success status, message, and new active status
 * @throws {404} If user is not found
 * @throws {400} If trying to disable own account
 * @throws {500} If there's an error updating the user
 */
router.put('/toggle-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא'
            });
        }

        // Prevent admin from disabling himself
        if (user._id.toString() === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן להשבית את עצמך'
            });
        }

        user.isActive = !user.isActive;
        await user.save();

        console.log(`👤 User ${userId} ${user.isActive ? 'activated' : 'deactivated'} by admin`);

        res.json({
            success: true,
            message: user.isActive ? 'המשתמש הופעל' : 'המשתמש הושבת',
            isActive: user.isActive
        });

    } catch (error) {
        console.error('❌ Error toggling user:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בעדכון משתמש'
        });
    }
});

/**
 * Delete User
 *
 * Permanently deletes a user from the system. Admins cannot delete their own accounts.
 * This endpoint is restricted to admins only.
 *
 * @route DELETE /api/admin/delete-user/:userId
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {string} req.params.userId - ID of the user to delete
 * @returns {Object} JSON response with success status and message
 * @throws {400} If trying to delete own account
 * @throws {404} If user is not found
 * @throws {500} If there's an error deleting the user
 */


/**
 * Get All Ads
 *
 * Retrieves a paginated list of all ads in the system, with optional filtering by status.
 * Includes populated agent, company, and campaign information.
 * This endpoint is restricted to admins only.
 *
 * @route GET /api/admin/all-ads
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {Object} req.query - Query parameters
 * @param {string} [req.query.status] - Filter by ad status (approved, pending, rejected)
 * @param {number} [req.query.page=1] - Page number for pagination
 * @param {number} [req.query.limit=20] - Number of ads per page
 * @returns {Object} JSON response with ads list and pagination info
 * @property {Array} ads - List of ad objects with populated references
 * @property {Object} pagination - Pagination metadata (total, page, pages)
 * @throws {500} If there's an error fetching ads
 */
router.get('/all-ads', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;

        const filter = {};
        if (status) filter.status = status;

        const ads = await PendingAd.find(filter)
            .populate('agentId', 'fullName email')
            .populate('companyId', 'companyName fullName')
            .populate('campaignId', 'title')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await PendingAd.countDocuments(filter);

        res.json({
            success: true,
            ads,
            pagination: {
                total,
                page: parseInt(page),
                pages: Math.ceil(total / limit)
            }
        });

    } catch (error) {
        console.error('❌ Error fetching ads:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת פרסומות'
        });
    }
});

/**
 * Delete Ad
 *
 * Permanently deletes an ad from the system and all associated QR scan records for data consistency.
 * This endpoint is restricted to admins only.
 *
 * @route DELETE /api/admin/delete-ad/:adId
 * @middleware authMiddleware - Requires user authentication
 * @middleware isAdmin - Requires admin privileges
 * @param {string} req.params.adId - ID of the ad to delete
 * @returns {Object} JSON response with success status, message, and deleted ad info
 * @property {Object} deletedAd - Information about the deleted ad
 * @throws {404} If ad is not found
 * @throws {500} If there's an error deleting the ad
 */
router.delete('/delete-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        // Prevent admin from deleting themselves
        if (userId === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן למחוק את עצמך'
            });
        }

        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא'
            });
        }

        // Delete all data depending on user type
        if (user.userType === 'company') {
            await Campaign.deleteMany({ companyId: userId });
            await PendingAd.deleteMany({ companyId: userId });
            await QRScan.deleteMany({ companyId: userId });
            await PriceProposal.deleteMany({ companyId: userId });
            await InviteCode.deleteMany({ companyId: userId });

            console.log(`🧹 Company data deleted for ${userId}`);
        } else if (user.userType === 'agent') {
            await PendingAd.deleteMany({ agentId: userId });
            await QRScan.deleteMany({ agentId: userId });
            await PriceProposal.deleteMany({ agentId: userId });
            await AgentRating.deleteMany({ agentId: userId });
            await Campaign.updateMany(
                { assignedAgents: userId },
                { $pull: { assignedAgents: userId } }
            );

            console.log(`🧹 Agent data deleted for ${userId}`);
        } else if (user.userType === 'admin') {
            // Optional: can prevent deleting other admins or allow full deletion
            console.log(`⚠️ Admin account deleted: ${userId}`);
        }

        // Delete the user itself
        await User.findByIdAndDelete(userId);

        res.json({
            success: true,
            message: 'המשתמש וכל הנתונים הקשורים נמחקו בהצלחה'
        });

    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקה'
        });
    }
});

module.exports = router;