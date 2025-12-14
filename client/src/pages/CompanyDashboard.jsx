// CompanyDashboard.jsx - MINIMAL DEBUG VERSION
import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

const CompanyDashboard = () => {
    const { user, loading, handleLogout } = useAuth();
    const navigate = useNavigate();
    const [debugInfo, setDebugInfo] = useState('');

    // 🔴 DEBUG
    useEffect(() => {
        console.log('🔵 CompanyDashboard mounted');
        console.log('🔵 loading:', loading);
        console.log('🔵 user:', user);
        
        setDebugInfo(`
            Loading: ${loading}
            User exists: ${!!user}
            User ID: ${user?._id || 'NONE'}
            User Type: ${user?.userType || 'NONE'}
            Company Name: ${user?.companyName || 'NONE'}
        `);
    }, [loading, user]);

    // Redirect if no user
    useEffect(() => {
        if (!loading && !user) {
            console.log('❌ No user, redirecting to login');
            navigate('/login');
        }
    }, [loading, user, navigate]);

    if (loading) {
        return <div style={{ padding: '50px', fontSize: '24px' }}>⏳ טוען...</div>;
    }

    if (!user) {
        return <div style={{ padding: '50px', fontSize: '24px' }}>❌ אין משתמש</div>;
    }

    return (
        <div style={{ padding: '2rem', fontFamily: 'Arial' }}>
            <h1>✅ CompanyDashboard עובד!</h1>
            <h2>שלום {user?.companyName || user?.fullName}!</h2>
            
            <div style={{ 
                background: '#f0f0f0', 
                padding: '20px', 
                borderRadius: '8px',
                marginTop: '20px',
                whiteSpace: 'pre-wrap',
                fontFamily: 'monospace'
            }}>
                <strong>Debug Info:</strong>
                {debugInfo}
            </div>

            <button 
                onClick={handleLogout}
                style={{
                    marginTop: '20px',
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