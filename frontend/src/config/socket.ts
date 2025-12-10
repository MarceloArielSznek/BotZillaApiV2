import { io, Socket } from 'socket.io-client';

// Determinar la URL del socket basándose en el entorno
const getSocketUrl = () => {
  // En desarrollo, usar el mismo origen para que pase por el proxy de Vite
  if (import.meta.env.DEV) {
    return window.location.origin;
  }
  
  // En producción, usar la URL del backend
  return import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || window.location.origin;
};

const SOCKET_URL = getSocketUrl();

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      path: '/socket.io/',
    });
    
    socket.on('connect', () => {
      console.log('🔌 WebSocket connected:', socket?.id);
    });
    
    socket.on('disconnect', () => {
      console.log('🔌 WebSocket disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('🔌 WebSocket connection error:', error);
    });
  }
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

