/**
 * qrService.js -- QR Code and Analytics API Service
 *
 * Purpose:
 *   Provides functions for generating QR codes, embedding them into ad images,
 *   and retrieving various levels of analytics (per-ad, overview, campaign,
 *   top performers, timeline, and comparisons).
 *
 * Key exports:
 *   - generateQR              -- create a QR code for a specific ad
 *   - embedQR                 -- overlay a QR code onto an ad image
 *   - getQRAnalytics          -- scan stats for a single ad
 *   - getOverviewAnalytics    -- high-level dashboard metrics
 *   - getCampaignAnalytics    -- per-campaign breakdown
 *   - getTopQRs               -- most-scanned QR codes
 *   - getTimelineAnalytics    -- scan counts over a date range
 *   - getComparisonAnalytics  -- side-by-side campaign or agent comparison
 *   - default export          -- object containing all of the above
 *
 * Connections:
 *   - Consumed by QRAnalytics, CompanyQRAnalytics, and ad-detail pages.
 *   - Every function requires a JWT token parameter for authorization.
 *   - Unlike companyService, token is passed explicitly rather than read from localStorage.
 *
 * Error handling:
 *   Functions throw on failure (rather than returning an error object),
 *   so callers should wrap invocations in try/catch.
 */

const API_URL = 'https://adsmaker.onrender.com/api';

/**
 * Generates a QR code linked to the specified ad.
 *
 * @param {string} adId - The Mongo _id of the ad.
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Server response containing the generated QR data.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const generateQR = async (adId, token) => {
  try {
    const response = await fetch(`${API_URL}/qr/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ adId })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה ביצירת QR');
    }

    return data;
  } catch (error) {
    console.error('❌ Error generating QR:', error);
    throw error;
  }
};

/**
 * Embeds a QR code into the ad's image at the given position and size.
 *
 * @param {string} adId - The Mongo _id of the ad.
 * @param {object} [options={}] - Embedding options.
 * @param {string} [options.position='bottom-right'] - Corner placement of the QR overlay.
 * @param {number} [options.size=150] - Pixel dimensions of the QR overlay.
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Server response with the updated image URL.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const embedQR = async (adId, options = {}, token) => {
  try {
    const { position = 'bottom-right', size = 150 } = options;

    const response = await fetch(`${API_URL}/qr/embed`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ adId, position, size })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בהטמעת QR');
    }

    return data;
  } catch (error) {
    console.error('❌ Error embedding QR:', error);
    throw error;
  }
};

/**
 * Retrieves scan analytics for a single ad's QR code.
 *
 * @param {string} adId - The Mongo _id of the ad.
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Analytics data (scan count, geo breakdown, etc.).
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getQRAnalytics = async (adId, token) => {
  try {
    const response = await fetch(`${API_URL}/qr/analytics/${adId}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בטעינת סטטיסטיקות');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching QR analytics:', error);
    throw error;
  }
};

/**
 * Fetches a high-level analytics overview (totals, averages, etc.).
 *
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Overview metrics.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getOverviewAnalytics = async (token) => {
  try {
    const response = await fetch(`${API_URL}/analytics/overview`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בטעינת נתונים');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching overview:', error);
    throw error;
  }
};

/**
 * Retrieves analytics broken down by campaign.
 *
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Per-campaign analytics.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getCampaignAnalytics = async (token) => {
  try {
    const response = await fetch(`${API_URL}/analytics/campaigns`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בטעינת נתוני קמפיינים');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching campaign analytics:', error);
    throw error;
  }
};

/**
 * Retrieves the top-performing QR codes ranked by scan count.
 *
 * @param {number} [limit=10] - Maximum number of results to return.
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Ranked list of QR codes.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getTopQRs = async (limit = 10, token) => {
  try {
    const response = await fetch(`${API_URL}/analytics/top-qrs?limit=${limit}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בטעינת QR מובילים');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching top QRs:', error);
    throw error;
  }
};

/**
 * Retrieves scan counts over a time period for charting.
 *
 * @param {number} [days=30] - Number of past days to include.
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Timeline data suitable for line/bar charts.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getTimelineAnalytics = async (days = 30, token) => {
  try {
    const response = await fetch(`${API_URL}/analytics/timeline?days=${days}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בטעינת ציר זמן');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching timeline:', error);
    throw error;
  }
};

/**
 * Fetches a side-by-side comparison of analytics, grouped by the specified dimension.
 *
 * @param {string} [type='campaign'] - Comparison dimension: "campaign" or "agent".
 * @param {string} token - JWT bearer token.
 * @returns {Promise<object>} Comparison data.
 * @throws {Error} If the server responds with a non-OK status.
 */
export const getComparisonAnalytics = async (type = 'campaign', token) => {
  try {
    const response = await fetch(`${API_URL}/analytics/comparison?type=${type}`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'שגיאה בהשוואה');
    }

    return data;
  } catch (error) {
    console.error('❌ Error fetching comparison:', error);
    throw error;
  }
};

export default {
  generateQR,
  embedQR,
  getQRAnalytics,
  getOverviewAnalytics,
  getCampaignAnalytics,
  getTopQRs,
  getTimelineAnalytics,
  getComparisonAnalytics
};
