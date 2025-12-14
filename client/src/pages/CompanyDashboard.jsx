// CompanyDashboard.jsx – CLEAN & API‑ALIGNED VERSION
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';

const CompanyDashboard = () => {
  const { user } = useAuth();
  const [agents, setAgents] = useState([]);
  const [approvedAds, setApprovedAds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!user?._id) return;

    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem('token');
        const api = axios.create({
          baseURL: import.meta.env.VITE_API_BASE_URL + '/api',
          headers: { Authorization: `Bearer ${token}` }
        });

        // 🔹 1. Fetch company agents (via users route)
        const agentsRes = await api.get('/users', {
          params: { userType: 'agent', companyId: user.companyId }
        });
        setAgents(agentsRes.data.users || []);

        // 🔹 2. Fetch approved ads PER AGENT (backend supports agent-only)
        const adsResults = await Promise.all(
          (agentsRes.data.users || []).map(agent =>
            api.get('/ads', { params: { agentId: agent._id } })
              .then(r => r.data)
              .catch(() => [])
          )
        );

        setApprovedAds(adsResults.flat());
      } catch (err) {
        console.error('❌ CompanyDashboard error:', err);
        setError('שגיאה בטעינת נתוני הדשבורד');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user?._id]);

  if (loading) return <p>טוען נתונים…</p>;
  if (error) return <p>{error}</p>;

  return (
    <div style={{ padding: '2rem' }}>
      <h1>דשבורד חברה</h1>

      <h2>סוכנים</h2>
      <ul>
        {agents.map(agent => (
          <li key={agent._id}>{agent.fullName} ({agent.email})</li>
        ))}
      </ul>

      <h2>מודעות מאושרות</h2>
      {approvedAds.length === 0 && <p>אין מודעות מאושרות</p>}
      <ul>
        {approvedAds.map(ad => (
          <li key={ad._id}>{ad.title}</li>
        ))}
      </ul>
    </div>
  );
};

export default CompanyDashboard;
