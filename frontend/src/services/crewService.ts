import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface CrewMember {
  id: number;
  name: string;
  phone?: string;
  telegram_id?: string;
  is_leader: boolean;
  animal?: string | null;
  branches?: Branch[];
  stats?: {
    branchesCount: number;
  };
}

export interface Branch {
  id: number;
  name: string;
  address?: string;
}

export interface CrewMemberListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeStats?: boolean;
  branchId?: number;
  isLeader?: boolean;
}

export interface CrewMemberListResponse {
  crewMembers: CrewMember[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateCrewMemberData {
  name: string;
  phone?: string;
  telegram_id?: string;
  is_leader?: boolean;
  branchIds?: number[];
  animal?: string;
}

export interface UpdateCrewMemberData {
  name: string;
  phone?: string;
  telegram_id?: string;
  is_leader?: boolean;
  animal?: string | null;
}

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

const crewService = {
  // GET /api/crew-members - Obtener todos los crew members
  getCrewMembers: async (params: CrewMemberListParams = {}): Promise<CrewMemberListResponse> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crew-members`,
        {
          ...getAuthHeaders(),
          params
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching crew members:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/crew-members/:id - Obtener un crew member específico
  getCrewMemberById: async (id: number): Promise<CrewMember> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crew-members/${id}`,
        getAuthHeaders()
      );
      return response.data.crewMember;
    } catch (error: any) {
      console.error('Error fetching crew member:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/crew-members - Crear nuevo crew member
  createCrewMember: async (data: CreateCrewMemberData): Promise<CrewMember> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/crew-members`,
        data,
        getAuthHeaders()
      );
      return response.data.crewMember;
    } catch (error: any) {
      console.error('Error creating crew member:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/crew-members/:id - Actualizar crew member
  updateCrewMember: async (id: number, data: UpdateCrewMemberData): Promise<CrewMember> => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/crew-members/${id}`,
        data,
        getAuthHeaders()
      );
      return response.data.crewMember;
    } catch (error: any) {
      console.error('Error updating crew member:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/crew-members/:id - Eliminar crew member
  deleteCrewMember: async (id: number): Promise<void> => {
    try {
      await axios.delete(
        `${API_BASE_URL}/crew-members/${id}`,
        getAuthHeaders()
      );
    } catch (error: any) {
      console.error('Error deleting crew member:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/crew-members/:id/branches - Obtener branches de un crew member
  getCrewMemberBranches: async (id: number): Promise<Branch[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/crew-members/${id}/branches`,
        getAuthHeaders()
      );
      return response.data.branches;
    } catch (error: any) {
      console.error('Error fetching crew member branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/crew-members/:id/branches - Asignar branches a crew member
  assignBranches: async (id: number, branchIds: number[]): Promise<void> => {
    try {
      await axios.post(
        `${API_BASE_URL}/crew-members/${id}/branches`,
        { branchIds },
        getAuthHeaders()
      );
    } catch (error: any) {
      console.error('Error assigning branches:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default crewService; 