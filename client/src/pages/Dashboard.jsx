/**
 * Dashboard.jsx
 *
 * Generic routing dashboard that redirects authenticated users to their
 * role-specific dashboard based on userType.
 *
 * Route: /dashboard
 * Access: All authenticated users (admin, company, agent).
 * API: None -- purely a client-side redirect.
 * Context: AuthContext -- provides the current user and loading state.
 *
 * Redirect mapping:
 *   admin   -> /admin-dashboard
 *   company -> /company-dashboard
 *   agent   -> /agent-dashboard
 *
 * Renders a loading screen while waiting for auth state to resolve.
 */

// client/src/pages/Dashboard.jsx
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

/**
 * Dashboard component.
 *
 * Acts as a routing gateway. Once the user object is available, it
 * navigates to the correct role-based dashboard using replace so the
 * user cannot navigate "back" to this intermediate page.
 *
 * @returns {JSX.Element} A loading indicator shown during the redirect.
 */
const Dashboard = () => {
    const { user, loading } = useAuth();
    const navigate = useNavigate();

    /** Redirect to the appropriate dashboard once the user and auth state are resolved. */
    useEffect(() => {
        if (!loading && user) {
            if (user.userType === 'admin') {
                navigate('/admin-dashboard', { replace: true });
            } else if (user.userType === 'company') {
                navigate('/company-dashboard', { replace: true });
            } else if (user.userType === 'agent') {
                navigate('/agent-dashboard', { replace: true });
            }
        }
    }, [user, loading, navigate]);

    // Loading screen displayed while the redirect is in progress
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
