import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { cancelAllPendingRequests } from '../config/api';

export const useRouteChange = () => {
  const location = useLocation();

  useEffect(() => {
    // Cancelar todos los requests pendientes cuando cambie la ruta
    cancelAllPendingRequests();
    
    if (import.meta.env.MODE === 'development') {
      console.log('🔄 Ruta cambiada a:', location.pathname);
    }
  }, [location.pathname]);
};
