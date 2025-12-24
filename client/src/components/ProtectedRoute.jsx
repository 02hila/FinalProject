// client/src/components/ProtectedRoute.jsx
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
    // ✅ הוספנו תמיכה ב-admin
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