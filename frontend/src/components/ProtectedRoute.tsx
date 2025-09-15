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
  
  // Obtener datos de autenticación de forma consistente
  const token = authService.getToken();
  const user = authService.getCurrentUser();

  useEffect(() => {
    let isMounted = true; // Para evitar actualizaciones de estado en componentes desmontados

    const validateAuth = async () => {
      // Si no hay token, redirigir inmediatamente
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setIsValidating(false);
        }
        return;
      }

      // Si hay token, validar con el servidor
      try {
        const isValid = await authService.validateToken();
        
        if (isMounted) {
          setIsAuthenticated(isValid);
          
          // Si el token es inválido, limpiar y redirigir
          if (!isValid) {
            authService.logout();
          }
        }
      } catch (error) {
        if (import.meta.env.MODE === 'development') {
          console.error('Error validating token:', error);
        }
        
        if (isMounted) {
          setIsAuthenticated(false);
        }
      } finally {
        if (isMounted) {
          setIsValidating(false);
        }
      }
    };

    validateAuth();

    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [token]);

  // Verificación inicial inmediata - si no hay token, redirigir
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

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
    return <Navigate to="/dashboard/main" replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute; 