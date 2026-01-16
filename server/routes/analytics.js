// server/routes/analytics.js - מתוקן עם adUniqueId
const express = require('express');
const router = express.Router();
const QRScan = require('../models/QRScan');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/analytics/overview
 * סקירה כללית של כל הסטטיסטיקות
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    let query = {};

    // סוכן רואה רק את שלו
    if (userType === 'agent') {
      query.agentId = userId;
    }
    // חברה רואה רק את שלה
    else if (userType === 'company') {
      query.companyId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const qrScans = await QRScan.find(query);

    const totalQRs = qrScans.length;
    const totalScans = qrScans.reduce((sum, qr) => sum + (qr.scans || 0), 0);
    
    // QRs שנסרקו לפחות פעם אחת
    const activeQRs = qrScans.filter(qr => qr.scans > 0).length;

    // סריקות היום
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = qrScans.filter(qr => {
      return qr.lastScannedAt && new Date(qr.lastScannedAt) >= today;
    }).reduce((sum, qr) => sum + (qr.scans || 0), 0);

    // סריקות השבוע (7 ימים אחרונים)
    const last7Days = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weekScans = qrScans.filter(qr => {
      return qr.lastScannedAt && new Date(qr.lastScannedAt) >= last7Days;
    }).reduce((sum, qr) => sum + (qr.scans || 0), 0);

    // סריקות החודש (30 ימים אחרונים)
    const last30Days = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const monthScans = qrScans.filter(qr => {
      return qr.lastScannedAt && new Date(qr.lastScannedAt) >= last30Days;
    }).reduce((sum, qr) => sum + (qr.scans || 0), 0);

    res.json({
      success: true,
      overview: {
        totalQRs,
        activeQRs,
        totalScans,
        todayScans,
        weekScans,
        monthScans,
        averageScansPerQR: totalQRs > 0 ? (totalScans / totalQRs).toFixed(1) : 0
      }
    });

  } catch (error) {
    console.error('❌ Error fetching overview:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת נתונים',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/campaigns
 * סטטיסטיקות לפי קמפיינים
 */
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    let query = {};

    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const qrScans = await QRScan.find(query)
      .populate('campaignId', 'title budget')
      .lean();

    // קיבוץ לפי קמפיינים
    const campaignStats = {};

    qrScans.forEach(qr => {
      const campaignId = qr.campaignId?._id?.toString();
      if (!campaignId) return;

      if (!campaignStats[campaignId]) {
        campaignStats[campaignId] = {
          campaignId,
          campaignTitle: qr.campaignId.title,
          totalQRs: 0,
          totalScans: 0,
          qrs: []
        };
      }

      campaignStats[campaignId].totalQRs += 1;
      campaignStats[campaignId].totalScans += (qr.scans || 0);
      campaignStats[campaignId].qrs.push({
        uniqueId: qr.uniqueId,
        adTitle: qr.metadata?.adTitle || 'ללא כותרת',
        adUniqueId: qr.adUniqueId,  // ✅ FIXED!
        scans: qr.scans || 0,
        shortUrl: qr.fullUrl
      });
    });

    const campaigns = Object.values(campaignStats).sort((a, b) => 
      b.totalScans - a.totalScans
    );

    res.json({
      success: true,
      campaigns
    });

  } catch (error) {
    console.error('❌ Error fetching campaign analytics:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת נתוני קמפיינים',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/top-qrs
 * ה-QR הכי מוצלחים (לפי סריקות)
 */
router.get('/top-qrs', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;
    const { limit = 10 } = req.query;

    let query = {};

    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const topQRs = await QRScan.find(query)
      .sort({ scans: -1 })
      .limit(parseInt(limit))
      .populate('campaignId', 'title')
      .lean();

    const formatted = topQRs.map(qr => ({
      uniqueId: qr.uniqueId,
      adTitle: qr.metadata?.adTitle || 'ללא כותרת',
      adUniqueId: qr.adUniqueId,  // ✅ FIXED - זו השורה שחסרה!
      campaignTitle: qr.campaignId?.title || 'ללא קמפיין',
      totalScans: qr.scans || 0,
      shortUrl: qr.fullUrl,
      createdAt: qr.createdAt,
      lastScannedAt: qr.lastScannedAt
    }));

    res.json({
      success: true,
      topQRs: formatted
    });

  } catch (error) {
    console.error('❌ Error fetching top QRs:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת QR מובילים',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/timeline
 * גרף סריקות לאורך זמן
 */
router.get('/timeline', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;
    const { days = 30 } = req.query;

    let query = {};

    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const qrScans = await QRScan.find(query).lean();

    const timeline = [];
    const startDate = new Date(Date.now() - parseInt(days) * 24 * 60 * 60 * 1000);
    startDate.setHours(0, 0, 0, 0);

    for (let i = 0; i < parseInt(days); i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      
      const nextDate = new Date(date);
      nextDate.setDate(nextDate.getDate() + 1);

      const dayScans = qrScans.filter(qr => {
        if (!qr.lastScannedAt) return false;
        const scanDate = new Date(qr.lastScannedAt);
        return scanDate >= date && scanDate < nextDate;
      }).length;

      timeline.push({
        date: date.toISOString().split('T')[0],
        scans: dayScans
      });
    }

    res.json({
      success: true,
      timeline
    });

  } catch (error) {
    console.error('❌ Error fetching timeline:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת ציר זמן',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/comparison
 * השוואה בין קמפיינים/סוכנים
 */
router.get('/comparison', authMiddleware, async (req, res) => {
  try {
    const { type = 'campaign' } = req.query;
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    let query = {};

    if (userType === 'company') {
      query.companyId = userId;
    } else if (userType === 'agent' && type === 'campaign') {
      query.agentId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const qrScans = await QRScan.find(query)
      .populate(type === 'campaign' ? 'campaignId' : 'agentId', 
                type === 'campaign' ? 'title' : 'fullName')
      .lean();

    const stats = {};

    qrScans.forEach(qr => {
      const key = type === 'campaign' 
        ? qr.campaignId?._id?.toString()
        : qr.agentId?._id?.toString();
      
      const name = type === 'campaign'
        ? qr.campaignId?.title
        : qr.agentId?.fullName;

      if (!key || !name) return;

      if (!stats[key]) {
        stats[key] = {
          id: key,
          name,
          totalQRs: 0,
          totalScans: 0
        };
      }

      stats[key].totalQRs += 1;
      stats[key].totalScans += (qr.scans || 0);
    });

    const comparison = Object.values(stats).sort((a, b) => 
      b.totalScans - a.totalScans
    );

    res.json({
      success: true,
      type,
      comparison
    });

  } catch (error) {
    console.error('❌ Error fetching comparison:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בהשוואה',
      error: error.message
    });
  }
});

/**
 * GET /api/analytics/realtime
 * נתונים בזמן אמת - 24 שעות אחרונות
 */
router.get('/realtime', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    let query = {};

    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

    // Exclude deleted QRScans from statistics
    query.isDeleted = { $ne: true };

    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const recentScans = await QRScan.find({
      ...query,
      lastScannedAt: { $gte: last24Hours }
    })
    .populate('campaignId', 'title')
    .sort({ lastScannedAt: -1 })
    .limit(10)
    .lean();

    const formatted = recentScans.map(qr => ({
      uniqueId: qr.uniqueId,
      adTitle: qr.metadata?.adTitle || 'ללא כותרת',
      adUniqueId: qr.adUniqueId,  // ✅ זה כבר קיים - לכן עובד!
      campaignTitle: qr.campaignId?.title || 'ללא קמפיין',
      scans: qr.scans || 0,
      lastScannedAt: qr.lastScannedAt,
      shortUrl: qr.fullUrl
    }));

    res.json({
      success: true,
      recentScans: formatted,
      totalLast24h: recentScans.length
    });

  } catch (error) {
    console.error('❌ Error fetching realtime data:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת נתונים בזמן אמת',
      error: error.message
    });
  }
});

module.exports = router;