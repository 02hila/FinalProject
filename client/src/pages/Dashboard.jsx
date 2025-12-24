// client/src/pages/Dashboard.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && user) {
            // הפניה לדשבורד המתאים לפי סוג המשתמש
            if (user.userType === 'admin') {
                navigate('/admin-dashboard', { replace: true });
            } else if (user.userType === 'company') {
                navigate('/company-dashboard', { replace: true });
            } else if (user.userType === 'agent') {
                navigate('/agent-dashboard', { replace: true });
            }
        }
    }, [user, loading, navigate]);

    // מסך טעינה בזמן ההפניה
    return (
        <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: 'white',
            fontSize: '24px',
            flexDirection: 'column'
        }}>
            <div style={{ fontSize: '48px', marginBottom: '20px' }}>⏳</div>
            <div>מעביר לדשבורד...</div>
        </div>
    );
};

export default Dashboard;