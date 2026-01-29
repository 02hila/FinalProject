/**
 * Ads Routes Module
 *
 * This module provides endpoints for managing ads, including retrieving approved ads,
 * downloading ad images, tracking clicks and shares, and accessing public ad information.
 * Routes are protected where necessary to ensure proper access control.
 *
 * @module routes/ads
 */

const express = require('express');
const router = express.Router();
const PendingAd = require('../models/PendingAd');
const { authMiddleware } = require('../middleware/auth');

/**
 * Get Agent's Approved Ads
 *
 * Retrieves all approved ads for the authenticated agent. Only agents can access their own ads.
 * Populates agent, company, and campaign information for each ad.
 *
 * @route GET /api/ads
 * @middleware authMiddleware - Requires user authentication
 * @returns {Array} Array of approved ad objects with populated references
 * @throws {403} If user is not an agent
 * @throws {500} If there's an error fetching ads
 */
router.get('/', authMiddleware, async (req, res) => {
  try {
    console.log('🔍 User from token:', req.userId, req.user);

    // Only agents can see their own ads
    if (!req.user || req.user.userType !== 'agent') {
      return res.status(403).json({
        success: false,
        message: 'גישה מותרת רק לסוכנים'
      });
    }

    const agentId = req.userId || req.user._id;

    const query = {
      agentId: agentId,
      status: 'approved'
    };

    console.log('🔍 Fetching approved ads with query:', query);

    const ads = await PendingAd.find(query)
      .populate('agentId', 'fullName email')
      .populate('companyId', 'companyName fullName')
      .populate('campaignId', 'title')
      .sort({ createdAt: -1 })
      .lean();

    console.log('✅ Found', ads.length, 'approved ads');

    res.json(ads);

  } catch (error) {
    console.error('❌ Error fetching ads:', error);
    res.status(500).json({
      success: false,
      message: 'שגיאה בטעינת מודעות',
      error: error.message
    });
  }
});

/**
 * Download Ad Image
 *
 * Downloads the image of an approved ad. Only the ad owner (agent) can download their ad images.
 * The image is served as a PNG attachment.
 *
 * @route GET /api/ads/download/:id
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.id - ID of the ad to download
 * @returns {Buffer} Image buffer as PNG attachment
 * @throws {404} If ad is not found or has no image
 * @throws {403} If user is not the ad owner or ad is not approved
 * @throws {500} If there's an error downloading the image
 */
router.get('/download/:id', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.id);

    if (!ad) {
      return res.status(404).json({ success: false, error: 'מודעה לא נמצאה' });
    }

    // Verify the ad belongs to the agent
    if (ad.agentId.toString() !== req.userId) {
      return res.status(403).json({
        success: false,
        error: 'אין הרשאה לגשת למודעה זו'
      });
    }

    if (ad.status !== 'approved') {
      return res.status(403).json({
        success: false,
        error: 'לא ניתן להוריד מודעה שטרם אושרה'
      });
    }

    if (!ad.imageData) {
      return res.status(404).json({ success: false, error: 'אין תמונה למודעה זו' });
    }

    const base64Data = ad.imageData.replace(/^data:image\/\w+;base64,/, '');
    const imageBuffer = Buffer.from(base64Data, 'base64');

    res.set({
      'Content-Type': 'image/png',
      'Content-Disposition': `attachment; filename="ad-${ad._id}.png"`
    });

    res.send(imageBuffer);

  } catch (error) {
    console.error('❌ Error downloading ad image:', error);
    res.status(500).json({
      success: false,
      error: 'שגיאה בהורדת התמונה'
    });
  }
});

/**
 * Get Public Ad Information
 *
 * Retrieves public information about an ad, including campaign details.
 * This endpoint is used for intermediate pages and does not require authentication.
 *
 * @route GET /api/ads/public/:adId
 * @param {string} req.params.adId - ID of the ad to retrieve
 * @returns {Object} Ad object with populated campaign information
 * @throws {404} If ad is not found
 * @throws {500} If there's an error fetching the ad
 */
router.get('/public/:adId', async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.adId)
      .populate('campaignId', 'title websiteUrl')
      .lean();
    
    if (!ad) {
      return res.status(404).json({ error: 'מודעה לא נמצאה' });
    }
    
    res.json(ad);
  } catch (error) {
    console.error('❌ Error fetching public ad:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record Ad Click
 *
 * Increments the click count for an ad. This endpoint does not require authentication
 * to allow tracking from public sources.
 *
 * @route POST /api/ads/click/:adId
 * @param {string} req.params.adId - ID of the ad that was clicked
 * @returns {Object} Success response
 * @throws {500} If there's an error recording the click
 */
router.post('/click/:adId', async (req, res) => {
  try {
    await PendingAd.findByIdAndUpdate(req.params.adId, {
      $inc: { clicks: 1 }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error logging click:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * Record Ad Share
 *
 * Records when an ad is shared on a social platform. Only the ad owner can record shares.
 * Updates the ad's share tracking information.
 *
 * @route POST /api/ads/share/:adId
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.adId - ID of the ad being shared
 * @param {Object} req.body - Request body
 * @param {string} req.body.platform - Platform where the ad was shared
 * @returns {Object} Success response with updated share count
 * @throws {404} If ad is not found
 * @throws {403} If user is not the ad owner
 * @throws {500} If there's an error recording the share
 */
router.post('/share/:adId', authMiddleware, async (req, res) => {
  try {
    const { platform } = req.body;
    const adId = req.params.adId;
    
    console.log(`📤 Recording share for ad ${adId} on platform: ${platform}`);
    
    const ad = await PendingAd.findById(adId);
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'מודעה לא נמצאה' });
    }
    
    // Check ownership
    if (ad.agentId.toString() !== req.userId) {
      return res.status(403).json({ success: false, error: 'אין הרשאה' });
    }
    
    // Record the share
    ad.recordShare(platform);
    await ad.save();
    
    console.log(`✅ Share recorded. Total shares: ${ad.shareTracking?.shareCount || 1}`);
    
    res.json({ 
      success: true, 
      shareCount: ad.shareTracking?.shareCount || 1 
    });
    
  } catch (error) {
    console.error('❌ Error recording share:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get Ad Share Statistics
 *
 * Retrieves share statistics for a specific ad, including share count, platforms, and timestamps.
 * Only accessible by the ad owner.
 *
 * @route GET /api/ads/share-stats/:adId
 * @middleware authMiddleware - Requires user authentication
 * @param {string} req.params.adId - ID of the ad to get statistics for
 * @returns {Object} Share statistics object
 * @property {number} stats.shareCount - Total number of shares
 * @property {Date} stats.firstSharedAt - Timestamp of first share
 * @property {Array} stats.platforms - List of platforms shared on
 * @property {Date} stats.approvedAt - Timestamp when ad was approved
 * @property {boolean} stats.hasBeenShared - Whether the ad has been shared
 * @throws {404} If ad is not found
 * @throws {500} If there's an error fetching statistics
 */
router.get('/share-stats/:adId', authMiddleware, async (req, res) => {
  try {
    const ad = await PendingAd.findById(req.params.adId)
      .select('shareTracking status')
      .lean();
    
    if (!ad) {
      return res.status(404).json({ success: false, error: 'מודעה לא נמצאה' });
    }
    
    res.json({
      success: true,
      stats: {
        shareCount: ad.shareTracking?.shareCount || 0,
        firstSharedAt: ad.shareTracking?.firstSharedAt,
        platforms: ad.shareTracking?.sharePlatforms || [],
        approvedAt: ad.shareTracking?.approvedAt,
        hasBeenShared: (ad.shareTracking?.shareCount || 0) > 0
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching share stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;