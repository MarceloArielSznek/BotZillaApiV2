import axios from 'axios';
import { API_BASE_URL } from '@/config/api';
import authService from '@/services/authService';
import { 
  SalesPerson, 
  SalesPersonListParams, 
  SalesPersonListResponse, 
  UpdateSalesPersonData 
} from '@/interfaces';

const getAuthHeaders = () => {
  const token = authService.getToken();
  return {
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  };
};

const salespersonService = {
  // GET /api/salespersons - Obtener todos los salespersons
  getSalesPersons: async (params: SalesPersonListParams = {}): Promise<SalesPersonListResponse> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/salespersons`,
        {
          ...getAuthHeaders(),
          params
        }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salespersons:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id - Obtener un salesperson específico
  getSalesPersonById: async (id: number): Promise<SalesPerson> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/salespersons/${id}`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons - Crear nuevo salesperson
  createSalesPerson: async (data: CreateSalesPersonData): Promise<SalesPerson> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/salespersons`,
        data,
        getAuthHeaders()
      );
      return response.data.salesPerson;
    } catch (error: any) {
      console.error('Error creating salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/salespersons/:id - Actualizar salesperson
  updateSalesPerson: async (id: number, data: UpdateSalesPersonData): Promise<SalesPerson> => {
    try {
      const response = await axios.put(
        `${API_BASE_URL}/salespersons/${id}`,
        data,
        getAuthHeaders()
      );
      return response.data.salesPerson;
    } catch (error: any) {
      console.error('Error updating salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/salespersons/:id - Eliminar salesperson
  deleteSalesPerson: async (id: number): Promise<void> => {
    try {
      await axios.delete(
        `${API_BASE_URL}/salespersons/${id}`,
        getAuthHeaders()
      );
    } catch (error: any) {
      console.error('Error deleting salesperson:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id/branches - Obtener branches de un salesperson
  getSalesPersonBranches: async (id: number): Promise<SalesPersonBranches> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/salespersons/${id}/branches`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching salesperson branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:id/branches - Asignar branches a salesperson
  assignBranches: async (id: number, branchIds: number[]): Promise<void> => {
    try {
      await axios.post(
        `${API_BASE_URL}/salespersons/${id}/branches`,
        { branchIds },
        getAuthHeaders()
      );
    } catch (error: any) {
      console.error('Error assigning branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:id/warning - Incrementar warning count
  incrementWarning: async (id: number): Promise<{ warningCount: number }> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/salespersons/${id}/warning`,
        {},
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error incrementing warning:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/salespersons/:id/active-estimates
  getActiveEstimates: async (id: number): Promise<any[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/salespersons/${id}/active-estimates`,
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching active estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/salespersons/:id/send-report
  sendReport: async (id: number): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(
        `${API_BASE_URL}/salespersons/${id}/send-report`,
        {},
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error sending report:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default salespersonService; 