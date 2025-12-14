// CompanyDashboard.jsx - WITH DATA LOADING
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { getAgents, getPendingAds } from '../services/companyService';

const CompanyDashboard = () => {
    const { user, loading, handleLogout } = useAuth();
    const navigate = useNavigate();
    
    const [agents, setAgents] = useState([]);
    const [pendingAds, setPendingAds] = useState([]);
    const [dataLoading, setDataLoading] = useState(false);
    const [error, setError] = useState(null);

    // Redirect if no user
    useEffect(() => {
        if (!loading && !user) {
            console.log('❌ No user, redirecting to login');
            navigate('/login');
        }
    }, [loading, user, navigate]);

    // Fetch data
    useEffect(() => {
        if (!user?._id || loading) {
            console.log('⏸️ Skipping data fetch - user not ready');
            return;
        }

        const fetchData = async () => {
            console.log('🔵 Starting data fetch for user:', user._id);
            setDataLoading(true);
            setError(null);

            try {
                // Test 1: Fetch agents
                console.log('📞 Calling getAgents...');
                const agentsData = await getAgents();
                console.log('📦 getAgents result:', agentsData);
                
                if (agentsData.success) {
                    setAgents(agentsData.agents || []);
                    console.log('✅ Agents loaded:', agentsData.agents?.length);
                } else {
                    console.log('⚠️ getAgents failed:', agentsData.error);
                }

                // Test 2: Fetch pending ads
                console.log('📞 Calling getPendingAds...');
                const pendingData = await getPendingAds(user._id);
                console.log('📦 getPendingAds result:', pendingData);
                
                if (pendingData.success) {
                    setPendingAds(pendingData.ads || []);
                    console.log('✅ Pending ads loaded:', pendingData.ads?.length);
                } else {
                    console.log('⚠️ getPendingAds failed:', pendingData.error);
                }

            } catch (err) {
                console.error('❌ Fatal error in fetchData:', err);
                setError(err.message);
            } finally {
                setDataLoading(false);
                console.log('✅ Data fetch complete');
            }
        };

        fetchData();
    }, [user?._id, loading]);

    if (loading) {
        return <div style={{ padding: '50px', fontSize: '24px' }}>⏳ טוען משתמש...</div>;
    }

    if (!user) {
        return <div style={{ padding: '50px', fontSize: '24px' }}>❌ אין משתמש</div>;
    }

    return (
        <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
            <h1>✅ דשבורד חברה</h1>
            <h2>שלום {user?.companyName || user?.fullName}!</h2>

            {dataLoading && (
                <div style={{ padding: '20px', background: '#fff3cd', borderRadius: '8px', margin: '20px 0' }}>
                    ⏳ טוען נתונים מהשרת...
                </div>
            )}

            {error && (
                <div style={{ padding: '20px', background: '#f8d7da', color: '#721c24', borderRadius: '8px', margin: '20px 0' }}>
                    ❌ שגיאה: {error}
                </div>
            )}

            <div style={{ marginTop: '30px' }}>
                <h3>👥 סוכנים ({agents.length})</h3>
                {agents.length === 0 ? (
                    <p>אין סוכנים</p>
                ) : (
                    <ul>
                        {agents.map(agent => (
                            <li key={agent._id}>
                                {agent.fullName} - {agent.email}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <div style={{ marginTop: '30px' }}>
                <h3>⏰ מודעות ממתינות ({pendingAds.length})</h3>
                {pendingAds.length === 0 ? (
                    <p>אין מודעות ממתינות</p>
                ) : (
                    <ul>
                        {pendingAds.map(ad => (
                            <li key={ad._id}>
                                {ad.title || 'ללא כותרת'} - {ad.agentId?.fullName || 'סוכן לא ידוע'}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            <button 
                onClick={handleLogout}
                style={{
                    marginTop: '30px',
                    padding: '10px 20px',
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: '5px',
                    cursor: 'pointer'
                }}
            >
                התנתק
            </button>
        </div>
    );
};

export default CompanyDashboard;