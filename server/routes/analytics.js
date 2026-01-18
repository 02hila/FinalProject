/**
 * Analytics Routes - QR Scan Statistics API
 *
 * This module provides endpoints for retrieving QR scan analytics data.
 * All endpoints require authentication and automatically filter data based
 * on the user's type (agent sees only their ads, company sees only their ads).
 *
 * Endpoints:
 *   GET /overview    - Summary statistics (totals, daily/weekly/monthly)
 *   GET /campaigns   - Breakdown of scans by campaign
 *   GET /top-qrs     - Top performing ads ranked by scan count
 *   GET /timeline    - Daily scan counts for charting
 *   GET /comparison  - Compare performance across campaigns or agents
 *   GET /realtime    - Recent scan activity from last 24 hours
 */

const express = require('express');
const router = express.Router();
const QRScan = require('../models/QRScan');
const PendingAd = require('../models/PendingAd');
const Campaign = require('../models/Campaign');
const { authMiddleware } = require('../middleware/auth');

/**
 * GET /api/analytics/overview
 *
 * Returns a summary of all QR scan statistics for the authenticated user.
 * Agents see only their own ads, companies see only ads from their campaigns.
 *
 * Response includes:
 *   - totalQRs: Number of QR codes created
 *   - activeQRs: QR codes with at least one scan
 *   - totalScans: Sum of all scans across all QRs
 *   - todayScans: Scans from today
 *   - weekScans: Scans from last 7 days
 *   - monthScans: Scans from last 30 days
 *   - averageScansPerQR: Average scans per QR code
 */
router.get('/overview', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    // Build query filter based on user type
    // This ensures agents only see their own data
    let query = {};

    // Agent users can only see their own QR scans
    if (userType === 'agent') {
      query.agentId = userId;
    }
    // Company users see scans for all ads in their campaigns
    else if (userType === 'company') {
      query.companyId = userId;
    }

    // QRScan records are deleted when ads are deleted, so no filtering needed
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
 *
 * Returns scan statistics grouped by campaign. Each campaign includes
 * its total QR count, total scans, and a list of individual QR codes
 * with their scan counts.
 *
 * Response format:
 *   campaigns: [{
 *     campaignId, campaignTitle, totalQRs, totalScans,
 *     qrs: [{ uniqueId, adTitle, adUniqueId, scans, shortUrl }]
 *   }]
 *
 * Results are sorted by total scans in descending order.
 */
router.get('/campaigns', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;

    // Filter by user type for data isolation
    let query = {};

    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

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
 *
 * Returns the top performing ads ranked by scan count.
 * This powers the "Top 5 Advertisements" section on the Statistics page.
 *
 * Query Parameters:
 *   - limit: Maximum number of results (default: 10)
 *
 * Response format:
 *   topQRs: [{
 *     uniqueId, adTitle, adUniqueId, campaignTitle,
 *     totalScans, shortUrl, createdAt, lastScannedAt
 *   }]
 *
 * Data is filtered by agent ID so each agent only sees their own ads.
 */
router.get('/top-qrs', authMiddleware, async (req, res) => {
  try {
    const userId = req.userId || req.user._id;
    const userType = req.user.userType;
    const { limit = 10 } = req.query;

    // Build query to filter by the authenticated user
    let query = {};

    // Agent sees only their own advertisements
    if (userType === 'agent') {
      query.agentId = userId;
    } else if (userType === 'company') {
      query.companyId = userId;
    }

    const topQRs = await QRScan.find(query)
      .sort({ scans: -1 })
      .limit(parseInt(limit))
      .populate('campaignId', 'title')
      .lean();

    const formatted = topQRs.map(qr => ({
      uniqueId: qr.uniqueId,
      adTitle: qr.metadata?.adTitle || 'ללא כותרת',
      adUniqueId: qr.adUniqueId,  
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
 *
 * Returns daily scan counts for a specified time period.
 * Used to power the timeline line chart on the Statistics page.
 *
 * Query Parameters:
 *   - days: Number of days to include (default: 30)
 *
 * Response format:
 *   timeline: [{ date: "YYYY-MM-DD", scans: number }]
 *
 * Each day in the range is included, even if there were no scans.
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
 *
 * Compares performance across campaigns or agents.
 * Useful for identifying which campaigns or agents have the best results.
 *
 * Query Parameters:
 *   - type: "campaign" or "agent" (default: "campaign")
 *
 * Response format:
 *   comparison: [{ id, name, totalQRs, totalScans }]
 *
 * Results are sorted by total scans in descending order.
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
 *
 * Returns recent scan activity from the last 24 hours.
 * Powers the "Recent Activity" feed on the Statistics page.
 *
 * Response format:
 *   recentScans: [{
 *     uniqueId, adTitle, adUniqueId, campaignTitle,
 *     scans, lastScannedAt, shortUrl
 *   }]
 *   totalLast24h: number of QRs scanned in last 24 hours
 *
 * Limited to 10 most recent entries, sorted by last scan time.
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
      adUniqueId: qr.adUniqueId, 
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