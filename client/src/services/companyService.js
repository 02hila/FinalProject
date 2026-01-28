/**
 * companyService.js -- Company-Facing API Service Layer
 *
 * Purpose:
 *   Encapsulates every REST call that a company user (or the company dashboard)
 *   needs. Covers pending ads, agent listing, ad history, price proposals,
 *   campaigns, and payments.
 *
 * Key exports:
 *   Pending Ads   -- getCompanyStats, getPendingAds, approveAd, rejectAd
 *   Agents        -- getAgents
 *   History       -- getHistory
 *   Proposals     -- getPriceProposals, approveProposal, rejectProposal
 *   Campaigns     -- createCampaign, getCampaigns, updateCampaign, deleteCampaign
 *   Payments      -- getPendingPayments, createPaymentIntent, confirmPayment, getPaymentHistory
 *
 * Connections:
 *   - Consumed primarily by CompanyDashboard and related company pages.
 *   - Authenticates via a JWT stored in localStorage (see getAuthHeaders).
 *   - The module-level API_URL points to the production Render host; individual
 *     functions (e.g. getCompanyStats) may override it with the Vite env variable.
 *
 * Pattern:
 *   Every exported function follows a consistent try/catch pattern:
 *   on success it returns the parsed JSON; on failure it returns
 *   { success: false, error: <message> } so callers can handle errors uniformly.
 */

// Default API base used by most functions in this module
const API_URL = 'https://adsmaker.onrender.com/api';

/**
 * Builds the standard Authorization + Content-Type headers from the stored JWT.
 * @returns {{ 'Content-Type': string, 'Authorization': string }}
 */
const getAuthHeaders = () => ({
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${localStorage.getItem('token')}`
});

// ========================================
// PENDING ADS
// ========================================

/**
 * Fetches aggregated statistics for the currently authenticated company.
 * Note: uses the Vite environment variable for the API URL rather than the module-level constant.
 *
 * @returns {Promise<object>} Server response with company stats or an error object.
 */
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

/**
 * Retrieves all ads with status "pending" that are awaiting company review.
 *
 * @param {string} companyId - The company's Mongo _id (currently unused; filtering is server-side via token).
 * @returns {Promise<{ success: boolean, ads: Array }>}
 */
export const getPendingAds = async (companyId) => {
    try {
        console.log('Fetching pending ads');

        const response = await fetch(`${API_URL}/pending-ads?status=pending`, {
            headers: getAuthHeaders()
        });

        const data = await response.json();
        console.log('Pending ads response:', data);
        return data;
    } catch (error) {
        console.error('Error fetching pending ads:', error);
        return { success: false, error: error.message, ads: [] };
    }
};

/**
 * Approves a pending ad, optionally attaching extra data (e.g. feedback).
 *
 * @param {string} adId - The Mongo _id of the ad to approve.
 * @param {object} data - Additional payload (varies by use case).
 * @returns {Promise<object>} Server response confirming approval or an error object.
 */
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

/**
 * Rejects a pending ad, optionally including a rejection reason.
 *
 * @param {string} adId - The Mongo _id of the ad to reject.
 * @param {object} data - Additional payload (e.g. { reason: "..." }).
 * @returns {Promise<object>} Server response confirming rejection or an error object.
 */
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

/**
 * Fetches the list of agents associated with the authenticated company.
 *
 * @returns {Promise<object>} Server response containing agents array or an error object.
 */
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

/**
 * Retrieves the full ad history (all statuses) for the authenticated company.
 *
 * @param {string} companyId - The company's Mongo _id (unused; server resolves from token).
 * @returns {Promise<{ success: boolean, ads: Array }>}
 */
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

/**
 * Retrieves all price proposals targeted at a specific company.
 *
 * @param {string} companyId - The company's Mongo _id.
 * @returns {Promise<object>} Server response containing proposals or an error object.
 */
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

/**
 * Approves a price proposal, optionally including extra approval data.
 *
 * @param {string} proposalId - The Mongo _id of the proposal.
 * @param {object} data - Additional payload (e.g. agreed price).
 * @returns {Promise<object>}
 */
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

/**
 * Rejects a price proposal, optionally with a reason.
 *
 * @param {string} proposalId - The Mongo _id of the proposal.
 * @param {object} data - Additional payload (e.g. rejection reason).
 * @returns {Promise<object>}
 */
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

/**
 * Creates a new advertising campaign for the authenticated company.
 *
 * @param {object} campaignData - Campaign details (name, budget, dates, etc.).
 * @returns {Promise<object>} The created campaign or an error object.
 */
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

/**
 * Fetches all campaigns belonging to the specified company.
 *
 * @param {string} companyId - The company's Mongo _id.
 * @returns {Promise<object>} Server response containing campaigns or an error object.
 */
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

/**
 * Updates an existing campaign.
 *
 * @param {string} campaignId - The Mongo _id of the campaign to update.
 * @param {object} data - The fields to update.
 * @returns {Promise<object>}
 */
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

/**
 * Permanently deletes a campaign.
 *
 * @param {string} campaignId - The Mongo _id of the campaign to delete.
 * @returns {Promise<object>}
 */
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

/**
 * Retrieves all payments with status "pending" for the authenticated company.
 *
 * @returns {Promise<{ success: boolean, payments: Array }>}
 */
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

/**
 * Initiates a Stripe payment intent for a specific payment record.
 *
 * @param {string} paymentId - The Mongo _id of the payment.
 * @returns {Promise<object>} Contains clientSecret on success.
 */
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

/**
 * Confirms a previously created payment by submitting the Stripe paymentIntentId.
 *
 * @param {string} paymentId - The Mongo _id of the payment record.
 * @param {string} paymentIntentId - The Stripe PaymentIntent ID.
 * @returns {Promise<object>}
 */
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

/**
 * Retrieves the full payment history (all statuses) for the authenticated company.
 *
 * @returns {Promise<{ success: boolean, payments: Array }>}
 */
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
