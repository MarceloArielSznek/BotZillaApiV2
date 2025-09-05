import { api } from '../config/api';
import type { 
  SalesPerson, 
  SalesPersonListParams, 
  SalesPersonListResponse, 
  UpdateSalesPersonData,
  CreateSalesPersonData,
  Branch
} from '@/interfaces';


const salespersonService = {
  // GET /api/salespersons - Obtener todos los salespersons
  getSalesPersons: async (params: SalesPersonListParams = {}): Promise<SalesPersonListResponse> => {
    try {
      const response = await api.get('/salespersons', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salespersons:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/for-filter - Obtener todos los salespersons para un filtro (sin paginación)
  getSalesPersonsForFilter: async (): Promise<SalesPerson[]> => {
    try {
      // Usamos el endpoint existente pero con un límite alto para traer a todos
      const response = await api.get('/salespersons', {
        params: { limit: 1000 } // Un número grande para asegurar que traemos a todos
      });
      return response.data.salespersons;
    } catch (error: any) {
      console.error('Error fetching salespersons for filter:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id - Obtener un salesperson específico
  getSalesPersonById: async (id: number): Promise<SalesPerson> => {
    try {
      const response = await api.get(`/salespersons/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons - Crear nuevo salesperson
  createSalesPerson: async (data: CreateSalesPersonData): Promise<SalesPerson> => {
    try {
      const response = await api.post('/salespersons', data);
      return response.data.salesPerson;
    } catch (error: any) {
      console.error('Error creating salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/salespersons/:id - Actualizar salesperson
  updateSalesPerson: async (id: number, data: UpdateSalesPersonData): Promise<SalesPerson> => {
    try {
      const response = await api.put(`/salespersons/${id}`, data);
      return response.data.salesPerson;
    } catch (error: any) {
      console.error('Error updating salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/salespersons/:id - Eliminar salesperson
  deleteSalesPerson: async (id: number): Promise<void> => {
    try {
      await api.delete(`/salespersons/${id}`);
    } catch (error: any) {
      console.error('Error deleting salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id/branches - Obtener branches de un salesperson
  getSalesPersonBranches: async (id: number): Promise<Branch[]> => {
    try {
      const response = await api.get(`/salespersons/${id}/branches`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salesperson branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:salespersonId/branches/:branchId - Añadir una branch
  addBranchToSalesperson: async (salespersonId: number, branchId: number): Promise<void> => {
    try {
      await api.post(`/salespersons/${salespersonId}/branches/${branchId}`, {});
    } catch (error: any) {
      console.error('Error adding branch to salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/salespersons/:salespersonId/branches/:branchId - Eliminar una branch
  removeBranchFromSalesperson: async (salespersonId: number, branchId: number): Promise<void> => {
    try {
      await api.delete(`/salespersons/${salespersonId}/branches/${branchId}`);
    } catch (error: any) {
      console.error('Error removing branch from salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:id/warning - Incrementar warning count
  incrementWarning: async (id: number): Promise<{ warningCount: number }> => {
    try {
      const response = await api.post(`/salespersons/${id}/warning`, {});
      return response.data;
    } catch (error: any) {
      console.error('Error incrementing warning:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id/active-estimates
  getActiveEstimates: async (id: number): Promise<any[]> => {
    try {
      const response = await api.get(`/salespersons/${id}/active-estimates`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching active estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:id/send-report
  sendReport: async (id: number): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await api.post(`/salespersons/${id}/send-report`, {});
      return response.data;
    } catch (error: any) {
      console.error('Error sending report:', error.response?.data || error.message);
      throw error;
    }
  },

  toggleSalesPersonStatus: async (id: number, isActive: boolean): Promise<SalesPerson> => {
    try {
      const response = await api.patch(`/salespersons/${id}/status`, { is_active: isActive });
      return response.data.salesPerson;
    } catch (error: any) {
      console.error('Error toggling salesperson status:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/automations/clean-duplicate-salespersons - Limpiar duplicados
  cleanDuplicateSalesPersons: async (): Promise<{ success: boolean; message: string; totalDuplicates: number; totalDeactivated: number; logs: string[] }> => {
    try {
      const response = await api.post('/automations/clean-duplicate-salespersons', {});
      return response.data;
    } catch (error: any) {
      console.error('Error cleaning duplicate salespersons:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default salespersonService;
