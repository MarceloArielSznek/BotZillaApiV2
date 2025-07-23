import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface Estimate {
  id: number;
  name: string;
  price: string; // Puede ser string si el backend lo envía como tal
  retail_cost: string;
  final_price: string;
  sub_service_retail_cost: string;
  discount: string;
  attic_tech_hours: number;
  customer_name: string;
  customer_address: string;
  crew_notes: string;
  at_created_date: string;
  at_updated_date: string;
  created_at: string; // El timestamp de nuestra BD
  updated_at: string; // El timestamp de nuestra BD
  Branch: {
    id: number;
    name: string;
  } | null;
  SalesPerson: {
    id: number;
    name: string;
  } | null;
  EstimateStatus: {
    id: number;
    name: string;
  } | null;
}

export interface FetchEstimatesParams {
  page?: number;
  limit?: number;
  branch?: number;
  salesperson?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
}

export interface SyncEstimatesParams {
  branchId?: number;
  statusId?: number;
  startDate?: string;
  endDate?: string;
  page?: number;
  limit?: number;
}

export interface FetchEstimatesResponse {
  data: Estimate[];
  total: number;
  pages: number;
  currentPage: number;
}

export interface SyncEstimatesResponse {
  success: boolean;
  message: string;
  summary: {
    totalFetched: number;
    newEstimates: number;
    updatedEstimates: number;
    newSalesPersons: number;
    newBranches: number;
    newStatuses: number;
  };
}

export interface Branch {
  id: number;
  name: string;
  address: string;
}

export interface SalesPerson {
  id: number;
  name: string;
  phone: string;
}

export interface EstimateStatus {
  id: number;
  name: string;
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

const estimateService = {
  // Fetch estimates from local database
  fetchEstimates: async (params: FetchEstimatesParams = {}): Promise<FetchEstimatesResponse> => {
    try {
      // Para un GET request, los parámetros se envían en la configuración `params` de axios
      const response = await axios.get(
        `${API_BASE_URL}/estimates`,
        { ...getAuthHeaders(), params: params }
      );
      return response.data;
    } catch (error: any) {
      console.error('Error fetching estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  // Sync estimates from Attic Tech
  syncEstimates: async (params: SyncEstimatesParams): Promise<any> => {
    try {
      // Limpiamos el objeto de parámetros para no enviar undefined o strings vacíos
      const cleanParams = Object.entries(params).reduce((acc, [key, value]) => {
        if (value !== undefined && value !== '') {
          (acc as any)[key] = value;
        }
        return acc;
      }, {} as SyncEstimatesParams);

      const response = await axios.post(
        `${API_BASE_URL}/estimates/sync-estimates`,
        cleanParams,
        getAuthHeaders()
      );
      return response.data;
    } catch (error: any) {
      console.error('Error syncing estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get branches for filters
  getBranches: async (): Promise<Branch[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/branches`,
        { ...getAuthHeaders(), params: { limit: 50 } } // Límite ajustado a 50
      );
      return response.data.branches || response.data;
    } catch (error: any) {
      console.error('Error fetching branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get sales persons for filters
  getSalesPersons: async (params?: { branchId?: number }): Promise<SalesPerson[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/salespersons`,
        { ...getAuthHeaders(), params: { ...params, limit: 50 } } // Unir params con el límite
      );
      return response.data.salespersons || response.data;
    } catch (error: any) {
      console.error('Error fetching sales persons:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get estimate statuses for filters
  getEstimateStatuses: async (): Promise<EstimateStatus[]> => {
    try {
      const response = await axios.get(
        `${API_BASE_URL}/estimate-statuses`,
        { ...getAuthHeaders(), params: { limit: 50 } } // Límite ajustado a 50
      );
      return response.data.statuses || response.data;
    } catch (error: any) {
      console.error('Error fetching estimate statuses:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default estimateService; 