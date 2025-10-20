import { api } from '../config/api';

export interface UserRole {
  id: number;
  name: string;
}

const userRoleService = {
  // GET /api/users/roles - Obtener todos los roles de usuario
  getAllRoles: async (): Promise<UserRole[]> => {
    try {
      const response = await api.get('/users/roles');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching user roles:', error.response?.data || error.message);
      throw error;
    }
  }
};

export default userRoleService;

