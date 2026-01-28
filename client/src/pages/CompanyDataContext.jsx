/**
 * CompanyDataContext.jsx
 *
 * React context provider that centralizes data fetching for company
 * users. Pre-loads pending ads, agents, ad history, and price proposals
 * into a shared context so child components can consume the data
 * without redundant API calls.
 *
 * Route: N/A -- wraps company-related components in the component tree.
 * Access: Company users only (guarded by userType check).
 * API (via companyService):
 *   - getPendingAds(companyId)
 *   - getAgents()
 *   - getHistory(companyId)
 *   - getPriceProposals(companyId)
 * Context: AuthContext -- reads the current user and initialization flag.
 *
 * Exports:
 *   - useCompanyData()      -- custom hook for consuming the context.
 *   - CompanyDataProvider   -- provider component to wrap the tree.
 */

import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
    getPendingAds,
    getAgents,
    getHistory,
    getPriceProposals
} from '../services/companyService';

const CompanyDataContext = createContext();

/** Hook to consume the CompanyDataContext from any child component. */
export const useCompanyData = () => useContext(CompanyDataContext);

/**
 * CompanyDataProvider component.
 *
 * Fetches all company-related data in parallel once the auth state
 * is initialized and the user is a company. Provides the fetched
 * data plus a manual refetch function to descendants.
 *
 * @param {object} props
 * @param {React.ReactNode} props.children - Child components to wrap.
 * @returns {JSX.Element} Context provider wrapping children.
 */
export const CompanyDataProvider = ({ children }) => {
    const { user, isInitialized } = useAuth();
    const [pendingAds, setPendingAds] = useState([]);
    const [allAgents, setAllAgents] = useState([]);
    const [history, setHistory] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });

    /**
     * Fetches all company data in parallel: pending ads, agents,
     * history, and price proposals. Filters proposals to only
     * include those with "pending" status.
     */
    const fetchData = useCallback(async () => {
        if (!user?.company?._id) return;

        try {
            const [pendingAdsData, agentsData, historyData, proposalsData] = await Promise.all([
                getPendingAds(user.company._id),
                getAgents(),
                getHistory(user.company._id),
                getPriceProposals(user.company._id)
            ]);

            if (pendingAdsData.success) {
                setPendingAds(pendingAdsData.ads || []);
                setStats(prev => ({ ...prev, pendingAds: pendingAdsData.ads?.length || 0 }));
            }

            if (agentsData.success) {
                setAllAgents(agentsData.agents || []);
            }

            if (historyData.success) {
                setHistory(historyData.ads || []);
            }

            if (proposalsData.success) {
                const pending = proposalsData.proposals?.filter(p => p.status === 'pending') || [];
                setProposals(pending);
                setStats(prev => ({ ...prev, proposalsCount: pending.length }));
            }
        } catch (error) {
            console.error("Failed to fetch company data:", error);
        } finally {
            setDataLoaded(true);
        }
    }, [user]);

    /** Trigger data fetch once auth is initialized and user is a company. */
    useEffect(() => {
        if (isInitialized && user && user.userType === 'company' && !dataLoaded) {
            fetchData();
        }
    }, [isInitialized, user, dataLoaded, fetchData]);

    const value = {
        pendingAds,
        allAgents,
        history,
        proposals,
        stats,
        dataLoaded,
        refetchData: fetchData // Expose a function to manually refetch if needed
    };

    return (
        <CompanyDataContext.Provider value={value}>
            {children}
        </CompanyDataContext.Provider>
    );
};
