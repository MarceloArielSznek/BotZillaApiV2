import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface GenerateOperationPostResponse {
  eligible: boolean;
  post?: string;
  metrics: {
    atHours: number;
    clPlanHours: number;
    totalWorkedHours: number;
    totalSavedHours: number;
    jobBonusPool: number;
    plannedToSavePercent: number;
    potentialBonusPool: number;
    actualSavedPercent: number;
  };
  minSavedPercent?: number;
}

export async function generateOperationPost(jobId: number, notes?: string): Promise<GenerateOperationPostResponse> {
  const token = await authService.getToken();
  const resp = await axios.post(
    `${API_BASE_URL}/ai/generate-operation-post`,
    { jobId, notes },
    { headers: { Authorization: `Bearer ${token}` } }
  );
  return resp.data.data;
}

import { api } from '../config/api';

const systemService = {
    clearCache: async (): Promise<{ success: boolean; message: string; clearedItems: number }> => {
        const response = await api.post('/cache/clear-all');
        return response.data;
    },
};

export default systemService; 