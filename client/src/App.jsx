import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';

const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CompanyDashboard = lazy(() => import('./pages/CompanyDashboard'));
const CompanyProfile = lazy(() => import('./pages/CompanyProfile'));
const AgentDashboard = lazy(() => import('./pages/AgentDashboard'));
const MyCampaigns = lazy(() => import('./pages/MyCampaigns'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
const MyAds = lazy(() => import('./pages/MyAds'));
const AdGenerator = lazy(() => import('./pages/Adgenerator'));

const PageLoader = () => (
  <div style={{
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#667eea',
    fontSize: '24px'
  }}>
    טוען...
  </div>
);

function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* נתיבים פתוחים */}
        <Route path="/" element={<Login />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} /> 
        
        {/* נתיבים מוגנים */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company-dashboard"
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/company-profile"
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent-dashboard"
          element={
            <ProtectedRoute requiredUserType="agent">
              <AgentDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-campaigns"
          element={
            <ProtectedRoute requiredUserType="agent">
              <MyCampaigns />
            </ProtectedRoute>
          }
        />
        <Route
          path="/agent-profile"
          element={
            <ProtectedRoute requiredUserType="agent">
              <AgentProfile />
            </ProtectedRoute>
          }
        />
        <Route
          path="/my-ads"
          element={
            <ProtectedRoute requiredUserType="agent">
              <MyAds />
            </ProtectedRoute>
          }
        />
        
        {/* ✅ נתיב חדש למחולל המודעות! */}
        <Route
          path="/ad-generator"
          element={
            <ProtectedRoute requiredUserType="agent">
              <AdGenerator />
            </ProtectedRoute>
          }
        />

        {/* נתיב Catch-all */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Suspense>
  );
}

export default App;