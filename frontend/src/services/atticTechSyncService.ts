/**
 * Servicio para sincronización con Attic Tech
 */

import { api } from '../config/api';

export interface EmployeeStats {
  total: number;
  pending: number;
  pending_ready_to_activate: number;
  pending_awaiting_registration: number;
  active: number;
  rejected: number;
  from_attic_tech: number;
  manual: number;
}

export interface SyncResult {
  total_users_in_at: number;
  valid_users: number;
  new_employees: number;
  updated_employees: number;
  skipped: number;
  errors: number;
  error_details: Array<{
    email: string;
    name: string;
    error: string;
  }>;
}

/**
 * Obtener estadísticas de employees
 */
export const getEmployeeStats = async (): Promise<EmployeeStats> => {
  const response = await api.get('/attic-tech-sync/stats');
  return response.data.data;
};

/**
 * Sincronizar usuarios desde Attic Tech
 */
export const syncUsersFromAtticTech = async (): Promise<SyncResult> => {
  const response = await api.post('/attic-tech-sync/sync-users');
  return response.data.data;
};

export default {
  getEmployeeStats,
  syncUsersFromAtticTech
};

