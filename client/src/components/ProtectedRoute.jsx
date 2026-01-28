/**
 * ProtectedRoute.jsx
 *
 * A route guard component that restricts access to authenticated users and optionally
 * enforces a specific user type (admin, company, or agent). Unauthenticated users are
 * redirected to the login page; authenticated users with the wrong type are redirected
 * to their own dashboard.
 *
 * Props:
 *  - children       (ReactNode)  The protected page content to render on success.
 *  - requiredUserType (string)   Optional. One of 'admin', 'company', or 'agent'.
 *
 * Used by: the main router (App.jsx) to wrap dashboard and other role-specific routes.
 */
import React from 'react';
import { Navigate } from 'react-router-dom';

/**
 * Renders its children only when the current user is authenticated and, if specified,
 * matches the required user type. Otherwise redirects appropriately.
 *
 * @param {Object}    props
 * @param {React.ReactNode} props.children          - Content to render when access is granted.
 * @param {string}          [props.requiredUserType] - If provided, the user must match this type.
 * @returns {React.ReactElement}
 */
const ProtectedRoute = ({ children, requiredUserType }) => {
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  // No token means the user is not logged in -- send to the login page.
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If a specific user type is required and the current user does not match,
  // redirect them to the dashboard that corresponds to their actual role.
  if (requiredUserType && userType !== requiredUserType) {

    let correctPath = '/dashboard';

    if (userType === 'admin') {
      correctPath = '/admin-dashboard';
    } else if (userType === 'company') {
      correctPath = '/company-dashboard';
    } else if (userType === 'agent') {
      correctPath = '/agent-dashboard';
    }

    return <Navigate to={correctPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
