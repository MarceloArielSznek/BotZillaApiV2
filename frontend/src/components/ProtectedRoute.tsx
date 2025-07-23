import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import authService from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = [] }) => {
  const location = useLocation();
  const user = authService.getCurrentUser();
  const isAuthenticated = !!authService.getToken();

  if (!isAuthenticated) {
    // Not logged in, redirect to login page with return url
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    // Role not authorized, redirect to home page
    return <Navigate to="/dashboard/estimates" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 