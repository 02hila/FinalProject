// server/routes/admin.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const { authMiddleware, isAdmin } = require('../middleware/auth');

// ========== יצירת ADMIN ראשון ==========
// POST /api/admin/create-first-admin
router.post('/create-first-admin', async (req, res) => {
    try {
        const { email, password, fullName, secretKey } = req.body;

        // מפתח סודי להגנה
        const ADMIN_SECRET = process.env.ADMIN_SECRET || 'ads-maker-admin-2024';
        
        if (secretKey !== ADMIN_SECRET) {
            return res.status(403).json({
                success: false,
                message: 'מפתח סודי שגוי'
            });
        }

        // בדיקה אם כבר יש admin במערכת
        const existingAdmin = await User.findOne({ userType: 'admin' });
        if (existingAdmin) {
            return res.status(400).json({
                success: false,
                message: 'כבר קיים מנהל במערכת'
            });
        }

        // בדיקה אם האימייל כבר קיים
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'אימייל זה כבר קיים במערכת'
            });
        }

        // יצירת ה-admin
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

// ========== הוספת ADMIN נוסף (רק admin קיים יכול) ==========
// POST /api/admin/create-admin
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

// ========== סטטיסטיקות כלליות של המערכת (admin בלבד) ==========
// GET /api/admin/system-stats
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

        // סטטיסטיקות לפי חודש (6 חודשים אחרונים)
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

// ========== קבלת כל המשתמשים ==========
// GET /api/admin/users
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

// ========== השבתה/הפעלה של משתמש ==========
// PUT /api/admin/toggle-user/:userId
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

        // מניעת השבתת admin את עצמו
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

// ========== מחיקת משתמש ==========
// DELETE /api/admin/delete-user/:userId
router.delete('/delete-user/:userId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { userId } = req.params;

        if (userId === req.userId) {
            return res.status(400).json({
                success: false,
                message: 'לא ניתן למחוק את עצמך'
            });
        }

        const user = await User.findByIdAndDelete(userId);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'משתמש לא נמצא'
            });
        }

        console.log('🗑️ User deleted by admin:', userId);

        res.json({
            success: true,
            message: 'המשתמש נמחק בהצלחה'
        });

    } catch (error) {
        console.error('❌ Error deleting user:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת משתמש'
        });
    }
});

// ========== קבלת כל הפרסומות ==========
// GET /api/admin/all-ads
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

// ========== מחיקת פרסומת (admin בלבד) ==========
// DELETE /api/admin/delete-ad/:adId
router.delete('/delete-ad/:adId', authMiddleware, isAdmin, async (req, res) => {
    try {
        const { adId } = req.params;

        const ad = await PendingAd.findById(adId);
        if (!ad) {
            return res.status(404).json({
                success: false,
                message: 'פרסומת לא נמצאה'
            });
        }

        // Store ad info for logging before deletion
        const adInfo = {
            id: ad._id,
            title: ad.title,
            agentId: ad.agentId,
            companyId: ad.companyId,
            status: ad.status
        };

        await PendingAd.findByIdAndDelete(adId);

        console.log('🗑️ Ad deleted by admin:', {
            adId: adInfo.id,
            title: adInfo.title,
            deletedBy: req.userId,
            timestamp: new Date().toISOString()
        });

        res.json({
            success: true,
            message: 'הפרסומת נמחקה בהצלחה',
            deletedAd: adInfo
        });

    } catch (error) {
        console.error('❌ Error deleting ad:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה במחיקת פרסומת'
        });
    }
});

module.exports = router;