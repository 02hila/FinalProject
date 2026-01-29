/**
 * App.jsx -- Root Route Definitions
 *
 * Purpose:
 *   Declares every client-side route in the application and maps each route to
 *   its corresponding page component. Routes that require authentication or a
 *   specific user role are wrapped in <ProtectedRoute>.
 *
 * Key exports:
 *   - default App  -- the top-level component rendered by main.jsx.
 *
 * Connections:
 *   - Mounted inside AuthProvider (see main.jsx), so every page can access auth state.
 *   - Uses React.lazy + Suspense for code-splitting; heavy pages are loaded on demand.
 *   - ProtectedRoute reads the current user's type from AuthContext to enforce
 *     role-based access (admin, company, agent).
 */

import { lazy, Suspense } from 'react';
import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import ConfirmRedirect from './pages/Confirmredirect';


import Register from './pages/Register';
import AgentDashboard from './pages/AgentDashboard.jsx';
import LandingPage from './pages/LandingPage';
import QRAnalytics from './pages/QRAnalytics';
import CompanyQRAnalytics from './components/CompanyQRAnalytics';
import AdminDashboard from './pages/AdminDashboard';
import HelpButton from './components/HelpButton';

// Lazy-loaded pages -- each creates a separate bundle chunk to improve initial load time
const Login = lazy(() => import('./pages/Login'));
const FAQHelp = lazy(() => import('./pages/FAQHelp'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const CompanyDashboard = lazy(() => import('./pages/CompanyDashboard'));
const CompanyProfile = lazy(() => import('./pages/Companyprofile'));
const MyCampaigns = lazy(() => import('./pages/MyCampaigns'));
const AgentProfile = lazy(() => import('./pages/AgentProfile'));
const MyAds = lazy(() => import('./pages/MyAds'));
const AdGenerator = lazy(() => import('./pages/AdGeneratorM'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));

/**
 * Full-screen loading indicator displayed while a lazy-loaded page chunk is being fetched.
 * @returns {JSX.Element} A centered "loading" message in Hebrew.
 */
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

/**
 * Root application component.
 * Wraps all routes in a Suspense boundary so lazy-loaded pages show PageLoader while resolving.
 *
 * Route categories:
 *   - Public:   landing page, login, register, ad redirect, legal pages
 *   - Admin:    admin dashboard (requiredUserType="admin")
 *   - Company:  company dashboard, profile, QR analytics (requiredUserType="company")
 *   - Agent:    agent dashboard, campaigns, ads, ad generator, QR analytics (requiredUserType="agent")
 *
 * @returns {JSX.Element}
 */
function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <HelpButton />
      <Routes>
<Route
    path="/admin-dashboard"
    element={
        <ProtectedRoute requiredUserType="admin">
            <AdminDashboard />
        </ProtectedRoute>
    }
/>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/ad/:adId" element={<ConfirmRedirect />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/faq" element={<FAQHelp />} />

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
          path="/company-qr-analytics"
          element={
            <ProtectedRoute requiredUserType="company">
              <CompanyQRAnalytics />
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

        <Route
          path="/ad-generator"
          element={
            <ProtectedRoute requiredUserType="agent">
              <AdGenerator />
            </ProtectedRoute>
          }
        />

        <Route
          path="/qr-analytics"
          element={
            <ProtectedRoute requiredUserType="agent">
              <QRAnalytics />
            </ProtectedRoute>
          }
        />

        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
    </Suspense>
  );
}

export default App;
