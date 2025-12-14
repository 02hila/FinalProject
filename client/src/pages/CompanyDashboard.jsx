import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';

const CompanyDashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    const [pendingAds, setPendingAds] = useState([]);
    const [agents, setAgents] = useState([]);
    const [history, setHistory] = useState([]);
    const [proposals, setProposals] = useState([]);
    const [error, setError] = useState(null);

    const API_BASE = import.meta.env.VITE_API_BASE_URL;

    /* ================= Redirect Protection ================= */
    useEffect(() => {
        if (!loading) {
            if (!user) navigate('/login');
            else if (user.userType !== 'company') navigate('/dashboard');
        }
    }, [loading, user?.userType, navigate]);

    /* ================= Data Fetchers ================= */
    const fetchPendingAds = async (companyId) => {
        const res = await axios.get(`${API_BASE}/ads/pending/${companyId}`);
        setPendingAds(res.data || []);
    };

    const fetchAgents = async () => {
        const res = await axios.get(`${API_BASE}/users/agents`);
        setAgents(res.data || []);
    };

    const fetchHistory = async (companyId) => {
        const res = await axios.get(`${API_BASE}/ads/history/${companyId}`);
        setHistory(res.data || []);
    };

    const fetchProposals = async (companyId) => {
        const res = await axios.get(`${API_BASE}/proposals/company/${companyId}`);
        setProposals(res.data || []);
    };

    /* ================= Initial Load ================= */
    useEffect(() => {
        if (!user?._id) return;

        const loadAll = async () => {
            try {
                await Promise.all([
                    fetchPendingAds(user._id),
                    fetchAgents(),
                    fetchHistory(user._id),
                    fetchProposals(user._id)
                ]);
            } catch (err) {
                console.error(err);
                setError('Failed to load dashboard data');
            }
        };

        loadAll();
    }, [user?._id]);

    /* ================= Actions ================= */
    const handleApproveAd = async (adId) => {
        await axios.put(`${API_BASE}/ads/approve/${adId}`);
        setPendingAds(prev => prev.filter(ad => ad._id !== adId));
    };

    const handleRejectAd = async (adId) => {
        await axios.put(`${API_BASE}/ads/reject/${adId}`);
        setPendingAds(prev => prev.filter(ad => ad._id !== adId));
    };

    const handleApproveProposal = async (proposalId) => {
        await axios.put(`${API_BASE}/proposals/approve/${proposalId}`);
        setProposals(prev => prev.filter(p => p._id !== proposalId));
    };

    const handleRejectProposal = async (proposalId) => {
        await axios.put(`${API_BASE}/proposals/reject/${proposalId}`);
        setProposals(prev => prev.filter(p => p._id !== proposalId));
    };

    /* ================= Render ================= */
    if (loading) return <p>Loading...</p>;
    if (error) return <p>{error}</p>;

    return (
        <div className="company-dashboard">
            <h1>Company Dashboard</h1>

            <section>
                <h2>Pending Ads</h2>
                {pendingAds.length === 0 ? <p>No pending ads</p> : (
                    pendingAds.map(ad => (
                        <div key={ad._id}>
                            <span>{ad.title}</span>
                            <button onClick={() => handleApproveAd(ad._id)}>Approve</button>
                            <button onClick={() => handleRejectAd(ad._id)}>Reject</button>
                        </div>
                    ))
                )}
            </section>

            <section>
                <h2>Proposals</h2>
                {proposals.length === 0 ? <p>No proposals</p> : (
                    proposals.map(p => (
                        <div key={p._id}>
                            <span>{p.description}</span>
                            <button onClick={() => handleApproveProposal(p._id)}>Approve</button>
                            <button onClick={() => handleRejectProposal(p._id)}>Reject</button>
                        </div>
                    ))
                )}
            </section>
        </div>
    );
};

export default CompanyDashboard;