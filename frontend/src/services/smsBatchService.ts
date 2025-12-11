import { api } from '../config/api';

export interface SmsBatch {
  id: number;
  name: string;
  description?: string;
  created_by?: number;
  status: 'draft' | 'ready' | 'sent' | 'cancelled';
  total_estimates: number;
  metadata?: any;
  created_at: string;
  updated_at: string;
  creator?: {
    id: number;
    email: string;
  };
  estimates?: any[];
}

export interface CreateBatchFromFiltersParams {
  name: string;
  description?: string;
  filters: {
    priceMin?: number;
    priceMax?: number;
    startDate?: string;
    endDate?: string;
    branch?: number;
    salesperson?: number;
    followUpStatus?: number;
    followUpLabel?: number;
  };
}

export interface CreateBatchFromSelectionParams {
  name: string;
  description?: string;
  estimateIds: number[];
}

const smsBatchService = {
  // Listar todos los batches
  getAllBatches: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
    search?: string;
  }): Promise<{ data: SmsBatch[]; total: number; pages: number; currentPage: number }> => {
    const response = await api.get('/sms-batches', { params });
    // Si el request fue cancelado, retornar estructura vacía
    if (!response.data || response.data.canceled) {
      return { data: [], total: 0, pages: 0, currentPage: 1 };
    }
    return response.data;
  },

  // Obtener batch por ID
  getBatchById: async (id: number): Promise<SmsBatch> => {
    const response = await api.get(`/sms-batches/${id}`);
    // Si el request fue cancelado, lanzar error
    if (!response.data || response.data.canceled) {
      throw new Error('Request was canceled');
    }
    // Verificar que la respuesta tenga la estructura esperada
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response structure');
    }
    return response.data.data;
  },

  // Crear batch desde filtros
  createBatchFromFilters: async (params: CreateBatchFromFiltersParams): Promise<SmsBatch & { warnings?: any }> => {
    const response = await api.post('/sms-batches/filter', params);
    if (!response.data || response.data.canceled) {
      throw new Error('Request was canceled');
    }
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response structure');
    }
    return {
      ...response.data.data,
      warnings: response.data.warnings
    };
  },

  // Crear batch desde selección manual
  createBatchFromSelection: async (params: CreateBatchFromSelectionParams): Promise<SmsBatch & { warnings?: any }> => {
    const response = await api.post('/sms-batches/selection', params);
    if (!response.data || response.data.canceled) {
      throw new Error('Request was canceled');
    }
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response structure');
    }
    return {
      ...response.data.data,
      warnings: response.data.warnings
    };
  },

  // Actualizar batch
  updateBatch: async (id: number, updates: Partial<SmsBatch>): Promise<SmsBatch> => {
    const response = await api.put(`/sms-batches/${id}`, updates);
    if (!response.data || response.data.canceled) {
      throw new Error('Request was canceled');
    }
    if (!response.data || !response.data.data) {
      throw new Error('Invalid response structure');
    }
    return response.data.data;
  },

  // Eliminar batch
  deleteBatch: async (id: number): Promise<void> => {
    await api.delete(`/sms-batches/${id}`);
  },

  // Agregar estimates al batch
  addEstimatesToBatch: async (batchId: number, estimateIds: number[]): Promise<void> => {
    await api.post(`/sms-batches/${batchId}/estimates`, { estimateIds });
  },

  // Remover estimate del batch
  removeEstimateFromBatch: async (batchId: number, estimateId: number): Promise<void> => {
    await api.delete(`/sms-batches/${batchId}/estimates/${estimateId}`);
  },

  // Enviar batch a Make.com/QUO vía webhook
  sendBatchToQuo: async (batchId: number, message: string): Promise<{ total_sent: number; webhook_response: any }> => {
    const response = await api.post(`/sms-batches/${batchId}/send`, {
      message
    });
    return response.data.data;
  },
};

export default smsBatchService;

