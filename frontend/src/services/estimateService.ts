import { api, API_BASE_URL } from '../config/api';
import authService from './authService';
import axios from 'axios';

export interface Estimate {
  id: number;
  name: string;
  price: number | null; // Puede ser string si el backend lo envía como tal
  retail_cost: number | null;
  final_price: number | null;
  sub_service_retail_cost: number | null;
  discount: number | null;
  attic_tech_hours: number | null;
  customer_name: string;
  customer_address: string;
  customer_email?: string | null;
  customer_phone?: string | null;
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
  has_job?: boolean;
  job?: { id: number; name: string };
}

export interface FetchEstimatesParams {
  page?: number;
  limit?: number;
  branch?: number;
  salesperson?: number;
  status?: number;
  startDate?: string;
  endDate?: string;
  has_job?: boolean;
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


const estimateService = {
  // Fetch estimates from local database
  fetchEstimates: async (params: FetchEstimatesParams = {}): Promise<FetchEstimatesResponse> => {
    try {
      // Para un GET request, los parámetros se envían en la configuración `params` de axios
      const response = await api.get('/estimates', {
        params: params
      });
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

      // Log de los parámetros que se envían
      console.log('🔍 Frontend - Parámetros de sync enviados:', {
        originalParams: params,
        cleanParams: cleanParams,
        hasParams: Object.keys(cleanParams).length > 0
      });

      const response = await api.post('/estimates/sync-estimates', cleanParams);
      return response.data;
    } catch (error: any) {
      console.error('Error syncing estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get branches for filters
  getBranches: async (): Promise<Branch[]> => {
    try {
      const response = await api.get('/branches', {
        params: { limit: 50 } // Límite ajustado a 50
      });
      return response.data.branches || response.data;
    } catch (error: any) {
      console.error('Error fetching branches:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get sales persons for filters
  getSalesPersons: async (params?: { branchId?: number }): Promise<SalesPerson[]> => {
    try {
      const response = await api.get('/salespersons', {
        params: { ...params, limit: 50 } // Unir params con el límite
      });
      return response.data.salespersons || response.data;
    } catch (error: any) {
      console.error('Error fetching sales persons:', error.response?.data || error.message);
      throw error;
    }
  },

  // Get estimate statuses for filters
  getEstimateStatuses: async (): Promise<EstimateStatus[]> => {
    try {
      const response = await api.get('/estimate-statuses', {
        params: { limit: 50 } // Límite ajustado a 50
      });
      return response.data.statuses || response.data;
    } catch (error: any) {
      console.error('Error fetching estimate statuses:', error.response?.data || error.message);
      throw error;
    }
  },

  getSoldEstimates: async (): Promise<Estimate[]> => {
    try {
      const response = await api.get('/estimates/sold');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching sold estimates:', error.response?.data || error.message);
      throw error;
    }
  },

  getEstimateDetails: async (id: number): Promise<Estimate> => {
    try {
      const response = await api.get(`/estimates/${id}`);
      return response.data;
    } catch (error: any) {
      console.error(`Error fetching estimate details for id ${id}:`, error.response?.data || error.message);
      throw error;
    }
  },
};

export default estimateService; 