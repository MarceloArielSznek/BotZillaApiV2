import { api } from '../config/api';

export interface Branch {
  id: number;
  name: string;
  address: string;
}

export interface TriggerSyncResponse {
  success: boolean;
  message: string;
  data?: {
    branch: {
      id: number;
      name: string;
    };
    webhook_response?: any;
  };
  error?: string;
}

const performanceService = {
  /**
   * Obtener todos los branches disponibles (excluyendo Corporate)
   */
  getBranches: async (): Promise<Branch[]> => {
    try {
      const response = await api.get('/performance/branches');
      // Validación defensiva de la respuesta
      if (!response.data) {
        console.error('Empty response from /performance/branches');
        return [];
      }
      // Intentar diferentes estructuras de respuesta
      const branches = response.data.data || response.data.branches || response.data;
      if (Array.isArray(branches)) {
        return branches;
      }
      console.warn('Invalid response structure from /performance/branches:', response.data);
      return [];
    } catch (error: any) {
      console.error('Error fetching branches:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Activar sincronización de jobs con un status específico
   */
  triggerJobsSync: async (branchId: number, status: string, syncId: string): Promise<TriggerSyncResponse> => {
    try {
      const response = await api.post('/performance/trigger-sync', {
        branch_id: branchId,
        status: status,
        sync_id: syncId
      });
      return response.data;
    } catch (error: any) {
      console.error('Error triggering jobs sync:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener jobs de un sync específico
   */
  getSyncJobs: async (syncId: string): Promise<any> => {
    try {
      const response = await api.get(`/performance/sync-jobs/${syncId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching sync jobs:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Subir Excel de BuilderTrend para procesar shifts
   */
  uploadBuilderTrendExcel: async (file: File, syncId: string): Promise<any> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('sync_id', syncId);

      const response = await api.post('/performance/upload-buildertrend', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error uploading BuilderTrend Excel:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener shifts procesados para un sync_id
   */
  getProcessedShifts: async (syncId: string, aggregated: boolean = false): Promise<any> => {
    try {
      const response = await api.get(`/performance/processed-shifts/${syncId}`, {
        params: { aggregated: aggregated ? 'true' : 'false' }
      });
      return response.data;
    } catch (error: any) {
      console.error('Error fetching processed shifts:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Confirmar matches de jobs manualmente desde el modal
   */
  confirmJobMatches: async (syncId: string, matches: Array<{ job_name_excel: string; matched_sync_job_id: number | null }>): Promise<any> => {
    try {
      const response = await api.post('/performance/confirm-job-matches', {
        sync_id: syncId,
        matches
      });
      return response.data;
    } catch (error: any) {
      console.error('Error confirming job matches:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener shifts agregados por crew member y job
   */
  getAggregatedShifts: async (syncId: string): Promise<any> => {
    try {
      const response = await api.get(`/performance/aggregated-shifts/${syncId}`);
      return response.data;
    } catch (error: any) {
      console.error('Error fetching aggregated shifts:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Enviar shifts procesados a Make.com para escribir en spreadsheet
   */
  sendShiftsToSpreadsheet: async (syncId: string, selectedJobNames?: string[]): Promise<any> => {
    try {
      const response = await api.post('/performance/send-to-spreadsheet', {
        sync_id: syncId,
        selected_job_names: selectedJobNames // Opcional: si se envía, solo procesa estos jobs
      });
      return response.data;
    } catch (error: any) {
      console.error('Error sending shifts to spreadsheet:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener jobs desde el spreadsheet vía Make.com webhook
   * Envía el branch y fechas al backend, que llama al webhook de Make.com
   * Make.com devuelve un array de arrays donde la posición [2] contiene el nombre del job
   */
  fetchJobsFromSpreadsheet: async (branchName: string, fromDate: string, toDate: string): Promise<any> => {
    try {
      const response = await api.post('/performance/fetch-jobs-from-spreadsheet', {
        branchName,
        fromDate,
        toDate
      });
      // response.data ya contiene { success, message }
      return response.data;
    } catch (error: any) {
      console.error('Error fetching jobs from spreadsheet:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener jobs de la base de datos (polling)
   * Después de disparar el webhook, el frontend hace polling a este endpoint
   */
  getSpreadsheetJobsFromCache: async (syncId: string): Promise<any> => {
    try {
      const response = await api.get('/performance/spreadsheet-jobs-cache', {
        params: { syncId }
      });
      return response.data;
    } catch (error: any) {
      // Si es 404, significa que aún no llegaron los jobs
      if (error.response?.status === 404) {
        return { ready: false };
      }
      console.error('Error getting jobs from database:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Guardar datos de Performance permanentemente
   * Guarda jobs y shifts en las tablas principales (job y shift)
   */
  savePerformanceDataPermanently: async (syncId: string, selectedJobNames?: string[], autoApprove: boolean = false, modifiedShifts?: any[]): Promise<any> => {
    try {
      const response = await api.post('/performance/save-permanently', {
        sync_id: syncId,
        selected_job_names: selectedJobNames,
        auto_approve: autoApprove,
        modified_shifts: modifiedShifts || null
      });
      return response.data;
    } catch (error: any) {
      console.error('Error saving Performance data permanently:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Obtener jobs y shifts pendientes de aprobación
   */
  getPendingApproval: async (branchId?: number): Promise<any> => {
    try {
      const params = branchId ? { branch_id: branchId } : {};
      const response = await api.get('/performance/pending-approval', { params });
      return response.data;
    } catch (error: any) {
      console.error('Error getting pending approval:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Aprobar jobs y sus shifts
   */
  approveJobs: async (jobIds: number[]): Promise<any> => {
    try {
      const response = await api.post('/performance/approve-jobs', { job_ids: jobIds });
      return response.data;
    } catch (error: any) {
      console.error('Error approving jobs:', error.response?.data || error.message);
      throw error;
    }
  },

  /**
   * Rechazar shifts específicos
   */
  rejectShifts: async (shifts: Array<{ crew_member_id: number; job_id: number }>): Promise<any> => {
    try {
      const response = await api.post('/performance/reject-shifts', { shifts });
      return response.data;
    } catch (error: any) {
      console.error('Error rejecting shifts:', error.response?.data || error.message);
      throw error;
    }
  }
};

export default performanceService;

