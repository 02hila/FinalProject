// client/src/services/companyService.js
const API_URL = 'https://adsmaker.onrender.com/api';
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// ========================================
// PENDING ADS
// ========================================

// ✅ FIXED: Get pending ads - server filters by company from token
export const getPendingAds = async (companyId) => {
    try {
        console.log('🔍 Fetching pending ads');
        
        // ✅ Server knows company from token - no need to send companyId
        const response = await fetch(`${API_URL}/pending-ads?status=pending`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        console.log('✅ Pending ads response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error fetching pending ads:', error);
        return { success: false, error: error.message, ads: [] };
    }
};

export const approveAd = async (adId, data) => {
    try {
        const response = await fetch(`${API_URL}/pending-ads/${adId}/approve`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error approving ad:', error);
        return { success: false, error: error.message };
    }
};

export const rejectAd = async (adId, data) => {
    try {
        // ✅ Use the new endpoint that handles components and sends email
        const response = await fetch(`${API_URL}/pending-ads/${adId}/reject-with-components`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({
                rejectionReasons: data.rejectionReason.split(', '), // Convert string back to array
                rejectionDetails: data.rejectionDetails
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || `Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error rejecting ad:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// AGENTS
// ========================================

export const getAgents = async () => {
    try {
        const response = await fetch(`${API_URL}/agents`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching agents:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// HISTORY - FIXED TO NOT USE QUERY PARAMS
// ========================================

export const getHistory = async (companyId) => {
    try {
        console.log('🔍 Fetching history');
        
        // ✅ Get ALL ads for this company (server filters by token)
        const response = await fetch(`${API_URL}/pending-ads`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        console.log('✅ History response:', data);
        return data;
    } catch (error) {
        console.error('❌ Error fetching history:', error);
        return { success: false, error: error.message, ads: [] };
    }
};

// ========================================
// PRICE PROPOSALS
// ========================================

export const getPriceProposals = async (companyId) => {
    try {
        const response = await fetch(`${API_URL}/price-proposals/company/${companyId}`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching price proposals:', error);
        return { success: false, error: error.message };
    }
};

export const approveProposal = async (proposalId, data) => {
    try {
        const response = await fetch(`${API_URL}/price-proposals/${proposalId}/approve`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error approving proposal:', error);
        return { success: false, error: error.message };
    }
};

export const rejectProposal = async (proposalId, data) => {
    try {
        const response = await fetch(`${API_URL}/price-proposals/${proposalId}/reject`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error rejecting proposal:', error);
        return { success: false, error: error.message };
    }
};

// ========================================
// CAMPAIGNS
// ========================================

export const createCampaign = async (campaignData) => {
    try {
        const response = await fetch(`${API_URL}/campaigns`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(campaignData)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error creating campaign:', error);
        return { success: false, error: error.message };
    }
};

export const getCampaigns = async (companyId) => {
    try {
        const response = await fetch(`${API_URL}/campaigns/company/${companyId}`, {
            headers: getAuthHeaders()
        });
        return await response.json();
    } catch (error) {
        console.error('Error fetching campaigns:', error);
        return { success: false, error: error.message };
    }
};

export const updateCampaign = async (campaignId, data) => {
    try {
        const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
            method: 'PUT',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error updating campaign:', error);
        return { success: false, error: error.message };
    }
};

export const deleteCampaign = async (campaignId) => {
    try {
        const response = await fetch(`${API_URL}/campaigns/${campaignId}`, {
            method: 'DELETE',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error deleting campaign:', error);
        return { success: false, error: error.message };
    }
};