import React, { createContext, useState, useEffect, useCallback, useContext } from 'react';
import { useAuth } from '../context/AuthContext.jsx';
import {
    getPendingAds,
    getAgents,
    getHistory,
    getPriceProposals
} from '../services/companyService';

const CompanyDataContext = createContext();

export const useCompanyData = () => useContext(CompanyDataContext);

export const CompanyDataProvider = ({ children }) => {
    const { user, isInitialized } = useAuth();
    const [pendingAds, setPendingAds] = useState([]);
    const [allAgents, setAllAgents] = useState([]);
    const [history, setHistory] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [dataLoaded, setDataLoaded] = useState(false);
    const [stats, setStats] = useState({ pendingAds: 0, proposalsCount: 0 });

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