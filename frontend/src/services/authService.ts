import { api } from '../config/api';

interface LoginCredentials {
  email: string;
  password: string;
}

interface AuthResponse {
  id: number;
  email: string;
  role: string;
  token: string;
}

const authService = {
  login: async (credentials: LoginCredentials): Promise<AuthResponse> => {
    try {
      console.log('Intentando login con:', credentials.email);
      const response = await api.post('/auth/login', credentials);
      console.log('Respuesta del servidor:', response.data);
      
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify({
          id: response.data.id,
          email: response.data.email,
          role: response.data.role
        }));
        return response.data;
      } else {
        throw new Error('Token no recibido del servidor');
      }
    } catch (error: any) {
      console.error('Error en login:', error.response?.data || error.message);
      throw error;
    }
  },

  logout: () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  getCurrentUser: () => {
    try {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        return {
          id: user.id,
          email: user.email,
          role: user.role
        };
      }
      return null;
    } catch (error) {
      console.error('Error al obtener usuario actual:', error);
      return null;
    }
  },

  getToken: () => {
    return localStorage.getItem('token');
  },

  // Verificar si el token es válido
  validateToken: async (): Promise<boolean> => {
    const token = localStorage.getItem('token');
    if (!token) return false;

    try {
      const response = await api.get('/auth/verify');
      // Verificar si es una respuesta cancelada
      if (response && typeof response === 'object' && 'canceled' in response) {
        return true; // Asumir válido si fue cancelado
      }
      return response.status === 200;
    } catch (error: any) {
      // Si es un error de cancelación, asumir que el token es válido
      if (error.message && error.message.includes('canceled')) {
        return true;
      }
      
      // Solo limpiar localStorage para errores reales de autenticación
      if (error.response && error.response.status === 401) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        return false;
      }
      
      // Para otros errores (red, etc), asumir válido temporalmente
      return true;
    }
  }
};

export default authService; 