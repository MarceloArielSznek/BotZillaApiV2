import { api } from '../config/api';

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
  const resp = await api.post('/ai/generate-operation-post', { jobId, notes });
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