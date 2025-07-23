import axios from 'axios';
import { API_BASE_URL } from '../config/api';

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
      const response = await axios.post(`${API_BASE_URL}/auth/login`, credentials);
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
  }
};

export default authService; 