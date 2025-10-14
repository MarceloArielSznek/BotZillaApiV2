import { api } from '../config/api';
import type { EstimateStatus, SpecialShift } from '../interfaces';

export interface EstimateStatus {
  id: number;
  name: string;
  stats?: {
    estimatesCount: number;
    recentEstimates: number;
    totalRevenue: number;
  };
}

export interface StatusListParams {
  page?: number;
  limit?: number;
  search?: string;
  includeStats?: boolean;
}

export interface StatusListResponse {
  statuses: EstimateStatus[];
  pagination: {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface CreateStatusData {
  name: string;
}

export interface UpdateStatusData {
  name: string;
}

export interface StatusAnalyticsParams {
  startDate?: string;
  endDate?: string;
  groupBy?: 'status' | 'month' | 'week';
}

export interface StatusAnalytics {
  statusId: number;
  statusName: string;
  totalEstimates: number;
  totalRevenue: number;
  averageValue: number;
  percentage: number;
}

export interface StatusAnalyticsResponse {
  analytics: StatusAnalytics[];
  summary: {
    totalStatuses: number;
    totalEstimates: number;
    totalRevenue: number;
    period: {
      startDate: string;
      endDate: string;
    };
  };
}


export const getStatuses = async (): Promise<EstimateStatus[]> => {
    const response = await api.get('/estimate-statuses');
    return response.data.statuses;
};

export const getStatusAnalytics = async () => {
    const response = await api.get('/estimate-statuses/analytics');
    return response.data.analytics;
};

export const getSpecialShifts = async (): Promise<SpecialShift[]> => {
    const response = await api.get('/special-shifts');
    return response.data;
};

export const getJobStatuses = async (): Promise<{ id: number; name: string }[]> => {
    const response = await api.get('/job-statuses');
    return response.data;
};

const statusService = {
  // GET /api/estimate-statuses - Obtener todos los estimate statuses
  getStatuses: async (params: StatusListParams = {}): Promise<StatusListResponse> => {
    try {
      const response = await api.get('/estimate-statuses', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching statuses:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/estimate-statuses/:id - Obtener un estimate status específico
  getStatusById: async (id: number): Promise<EstimateStatus> => {
    try {
      const response = await api.get(`/estimate-statuses/${id}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching status:', error.response?.data || error.message);
      throw error;
    }
  },

  // POST /api/estimate-statuses - Crear nuevo estimate status
  createStatus: async (data: CreateStatusData): Promise<EstimateStatus> => {
    try {
      const response = await api.post('/estimate-statuses', data);
      return response.data.status;
    } catch (error: any) {
      console.error('Error creating status:', error.response?.data || error.message);
      throw error;
    }
  },

  // PUT /api/estimate-statuses/:id - Actualizar estimate status
  updateStatus: async (id: number, data: UpdateStatusData): Promise<EstimateStatus> => {
    try {
      const response = await api.put(`/estimate-statuses/${id}`, data);
      return response.data.status;
    } catch (error: any) {
      console.error('Error updating status:', error.response?.data || error.message);
      throw error;
    }
  },

  // DELETE /api/estimate-statuses/:id - Eliminar estimate status
  deleteStatus: async (id: number): Promise<void> => {
    try {
      await api.delete(`/estimate-statuses/${id}`);
    } catch (error: any) {
      console.error('Error deleting status:', error.response?.data || error.message);
      throw error;
    }
  },

  // GET /api/estimate-statuses/analytics - Obtener analytics de statuses
  getStatusAnalytics: async (params: StatusAnalyticsParams = {}): Promise<StatusAnalyticsResponse> => {
    try {
      const response = await api.get('/estimate-statuses/analytics', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching status analytics:', error.response?.data || error.message);
      throw error;
    }
  },
};

export default statusService; 