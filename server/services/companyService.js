// src/services/companyService.js

export const getPendingAds = async (companyId) => {
  try {
    console.log('🔍 Fetching pending ads');
    const response = await axios.get(
      `https://adsmaker.onrender.com/api/pending-ads?companyId=${companyId}&status=pending`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      }
    );
    return response.data;
  } catch (error) {
    console.error('❌ Error fetching pending ads:', error);
    throw error;
  }
};