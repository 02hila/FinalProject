// client/src/services/qrService.js

const API_URL = 'https://adsmaker.onrender.com/api';

/**
 * יצירת QR code למודעה
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
 * הטמעת QR בתוך תמונת המודעה
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
 * קבלת סטטיסטיקות QR למודעה
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
 * קבלת סטטיסטיקות כלליות
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
 * קבלת סטטיסטיקות לפי קמפיינים
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
 * קבלת ה-QR הכי מוצלחים
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
 * קבלת גרף ציר זמן
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
 * קבלת השוואה בין קמפיינים/סוכנים
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