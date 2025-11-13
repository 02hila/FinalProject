// client/frontend-react/src/components/ProtectedRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, requiredUserType }) => {
  const token = localStorage.getItem('token');
  const userType = localStorage.getItem('userType');

  // אם אין טוקן - שלח ללוגין
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // אם נדרש סוג משתמש והוא לא תואם - שלח לדשבורד הנכון
  if (requiredUserType && userType !== requiredUserType) {
    const correctPath = userType === 'agent' ? '/agent-dashboard' : '/company-dashboard';
    return <Navigate to={correctPath} replace />;
  }

  return children;
};

export default ProtectedRoute;
