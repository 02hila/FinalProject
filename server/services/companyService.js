// client/src/services/companyService.js
const API_URL = 'https://adsmaker.onrender.com/api';
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// ========================================
// PENDING ADS (with Pagination)
// ========================================
export const getCompanyStats = async () => {
    try {
        const token = localStorage.getItem('token');
        const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
        
        const response = await fetch(`${API_URL}/api/company/stats`, {
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching company stats:', error);
        return { success: false, error: error.message };
    }
};

// ✅ Updated with pagination support
export const getPendingAds = async (companyId, page = 1, limit = 6) => {
    try {
        console.log(`Fetching pending ads - Page: ${page}, Limit: ${limit}`);
        
        const response = await fetch(
            `${API_URL}/pending-ads?status=pending&page=${page}&limit=${limit}`, 
            {
                headers: getAuthHeaders()
            }
        );
        
        const data = await response.json();
        console.log('Pending ads response:', data);
        
        // Return with pagination info
        return {
            success: data.success,
            ads: data.ads || [],
            currentPage: data.currentPage || page,
            totalPages: data.totalPages || 1,
            total: data.total || data.ads?.length || 0
        };
    } catch (error) {
        console.error('Error fetching pending ads:', error);
        return { 
            success: false, 
            error: error.message, 
            ads: [],
            currentPage: 1,
            totalPages: 1,
            total: 0
        };
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
        const response = await fetch(`${API_URL}/pending-ads/${adId}/reject`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(data)
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
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
// HISTORY
// ========================================

export const getHistory = async (companyId) => {
    try {
        console.log('Fetching history');
        
        const response = await fetch(`${API_URL}/pending-ads`, {
            headers: getAuthHeaders()
        });
        
        const data = await response.json();
        console.log('History response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching history:', error);
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

// ========================================
// PAYMENTS
// ========================================

export const getPendingPayments = async () => {
    try {
        console.log('Fetching pending payments');
        
        const response = await fetch(`${API_URL}/payments/pending`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Pending payments:', data);
        return data;
    } catch (error) {
        console.error('Error fetching pending payments:', error);
        return { success: false, error: error.message, payments: [] };
    }
};

export const createPaymentIntent = async (paymentId) => {
    try {
        console.log('Creating payment intent for:', paymentId);
        
        const response = await fetch(`${API_URL}/payments/create-payment-intent/${paymentId}`, {
            method: 'POST',
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Payment intent created');
        return data;
    } catch (error) {
        console.error('Error creating payment intent:', error);
        return { success: false, error: error.message };
    }
};

export const confirmPayment = async (paymentId, paymentIntentId) => {
    try {
        console.log('Confirming payment:', paymentId);
        
        const response = await fetch(`${API_URL}/payments/confirm/${paymentId}`, {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify({ paymentIntentId })
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        const data = await response.json();
        console.log('Payment confirmed');
        return data;
    } catch (error) {
        console.error('Error confirming payment:', error);
        return { success: false, error: error.message };
    }
};

export const getPaymentHistory = async () => {
    try {
        const response = await fetch(`${API_URL}/payments/history`, {
            headers: getAuthHeaders()
        });
        
        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }
        
        return await response.json();
    } catch (error) {
        console.error('Error fetching payment history:', error);
        return { success: false, error: error.message, payments: [] };
    }
};