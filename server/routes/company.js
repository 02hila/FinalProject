// server/routes/company.js
const express = require('express');
const router = express.Router();
const User = require('../models/User');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

// ========== סטטיסטיקות החברה ==========
// GET /api/company/stats
router.get('/stats', authMiddleware, async (req, res) => {
    try {
        // וידוא שזו חברה או admin
        if (!['company', 'admin'].includes(req.userType)) {
            return res.status(403).json({
                success: false,
                message: 'גישה לחברות ומנהלים בלבד'
            });
        }

        const companyId = req.userId;

        // ספירת פרסומות לפי סטטוס
        const [totalAds, approvedAds, pendingAds, rejectedAds] = await Promise.all([
            PendingAd.countDocuments({ companyId }),
            PendingAd.countDocuments({ companyId, status: 'approved' }),
            PendingAd.countDocuments({ companyId, status: 'pending' }),
            PendingAd.countDocuments({ companyId, status: 'rejected' })
        ]);

        // ספירת קמפיינים
        let totalCampaigns = 0;
        let activeCampaigns = 0;
        
        if (Campaign) {
            [totalCampaigns, activeCampaigns] = await Promise.all([
                Campaign.countDocuments({ companyId }),
                Campaign.countDocuments({ companyId, status: 'active' })
            ]);
        }

        // ספירת סוכנים משויכים
        const uniqueAgents = await PendingAd.distinct('agentId', { companyId });

        // אחוז אישור
        const approvalRate = totalAds > 0 ? Math.round((approvedAds / totalAds) * 100) : 0;

        console.log(`📊 Company stats for ${companyId}:`, {
            totalAds, approvedAds, pendingAds, rejectedAds
        });

        res.json({
            success: true,
            stats: {
                ads: {
                    total: totalAds,
                    approved: approvedAds,
                    pending: pendingAds,
                    rejected: rejectedAds,
                    approvalRate
                },
                campaigns: {
                    total: totalCampaigns,
                    active: activeCampaigns
                },
                agents: {
                    total: uniqueAgents.length
                }
            }
        });

    } catch (error) {
        console.error('❌ Error fetching company stats:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת סטטיסטיקות'
        });
    }
});

// ========== סטטיסטיקות מפורטות לפי חודש ==========
// GET /api/company/stats/monthly
router.get('/stats/monthly', authMiddleware, async (req, res) => {
    try {
        if (!['company', 'admin'].includes(req.userType)) {
            return res.status(403).json({
                success: false,
                message: 'גישה לחברות ומנהלים בלבד'
            });
        }

        const companyId = req.userId;
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const monthlyStats = await PendingAd.aggregate([
            { 
                $match: { 
                    companyId: new require('mongoose').Types.ObjectId(companyId),
                    createdAt: { $gte: sixMonthsAgo } 
                } 
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' }
                    },
                    total: { $sum: 1 },
                    approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
                    rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
                    pending: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1 } }
        ]);

        res.json({
            success: true,
            monthlyStats
        });

    } catch (error) {
        console.error('❌ Error fetching monthly stats:', error);
        res.status(500).json({
            success: false,
            message: 'שגיאה בקבלת סטטיסטיקות חודשיות'
        });
    }
});

module.exports = router;