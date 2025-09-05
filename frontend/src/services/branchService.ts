import { api } from '../config/api';

export interface Branch {
  id: number;
  name: string;
  address: string;
  telegram_group_id?: string;
  stats?: {
    salesPersonsCount: number;
    estimatesCount: number;
    totalRevenue: number;
  };
}

export interface BranchListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeStats?: boolean;
}

export interface BranchListResponse {
  branches: Branch[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateBranchData {
  name: string;
  address?: string;
  telegram_group_id?: string;
}

export interface UpdateBranchData {
  name: string;
  address?: string;
  telegram_group_id?: string;
}


const branchService = {
  // GET /api/branches - Obtener todas las branches
  getBranches: async (params: BranchListParams = {}): Promise<BranchListResponse> => {
    try {
      const response = await api.get('/branches', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/branches/:id - Obtener una branch específica
  getBranchById: async (id: number): Promise<Branch> => {
    try {
      const response = await api.get(`/branches/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching branch:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/branches - Crear nueva branch
  createBranch: async (data: CreateBranchData): Promise<Branch> => {
    try {
      const response = await api.post('/branches', data);
      return response.data.branch;
    } catch (error: any) {
      console.error('Error creating branch:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/branches/:id - Actualizar branch
  updateBranch: async (id: number, data: UpdateBranchData): Promise<Branch> => {
    try {
      const response = await api.put(`/branches/${id}`, data);
      return response.data.branch;
    } catch (error: any) {
      console.error('Error updating branch:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/branches/:id - Eliminar branch
  deleteBranch: async (id: number): Promise<void> => {
    try {
      await api.delete(`/branches/${id}`);
    } catch (error: any) {
      console.error('Error deleting branch:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/branches/:id/salespersons - Asignar salesperson a branch
  assignSalesPerson: async (branchId: number, salesPersonId: number): Promise<void> => {
    try {
      await api.post(`/branches/${branchId}/salespersons`, { salesPersonId });
    } catch (error: any) {
      console.error('Error assigning salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/branches/:id/salespersons/:salesPersonId - Remover salesperson de branch
  removeSalesPerson: async (branchId: number, salesPersonId: number): Promise<void> => {
    try {
      await api.delete(`/branches/${branchId}/salespersons/${salesPersonId}`);
    } catch (error: any) {
      console.error('Error removing salesperson:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default branchService; 