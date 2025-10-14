/**
 * Servicio para buscar usuarios en Attic Tech
 */

import { api } from '../config/api';

export interface AtticTechUser {
  attic_tech_id: number;
  name: string;
  email: string;
  role: 'crew_member' | 'crew_leader' | 'salesperson';
  is_leader: boolean;
  branches: string[];
  isVerified: boolean;
  isBlocked: boolean;
}

export interface SearchUserResponse {
  success: boolean;
  message: string;
  data?: AtticTechUser;
}

/**
 * Buscar usuario en Attic Tech por email
 */
const searchUserByEmail = async (email: string): Promise<SearchUserResponse> => {
  const response = await api.post('/attic-tech-users/search', { email });
  return response.data;
};

export default {
  searchUserByEmail
};

