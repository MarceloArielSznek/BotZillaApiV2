import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { CircularProgress, Box } from '@mui/material';
import authService from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles = [] }) => {
  const location = useLocation();
  const [isValidating, setIsValidating] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const user = authService.getCurrentUser();
  const token = authService.getToken();

  // Verificación inicial inmediata - si no hay token, no mostrar nada
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  useEffect(() => {
    const validateAuth = async () => {
      // Si no hay token, redirigir inmediatamente
      if (!token) {
        setIsAuthenticated(false);
        setIsValidating(false);
        return;
      }

      // Si hay token, validar con el servidor
      try {
        const isValid = await authService.validateToken();
        setIsAuthenticated(isValid);
        
        // Si el token es inválido, limpiar y redirigir
        if (!isValid) {
          authService.logout();
        }
      } catch (error) {
        console.error('Error validating token:', error);
        setIsAuthenticated(false);
        authService.logout();
      } finally {
        setIsValidating(false);
      }
    };

    validateAuth();
  }, [token]);

  // Mostrar loading mientras valida
  if (isValidating) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  // No autenticado - redirigir a login
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Verificar roles si es necesario
  if (allowedRoles.length > 0 && user && !allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard/estimates" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 