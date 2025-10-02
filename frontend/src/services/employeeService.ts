import { api } from '../config/api';
import { TelegramGroup } from './telegramGroupService'; // Importar la interfaz
import { PagedResponse } from '../interfaces';

export interface Branch {
    id: number;
    name: string;
}

export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: 'pending' | 'active' | 'inactive' | 'rejected';
  role: 'crew_member' | 'crew_leader' | 'salesperson' | 'corporate';
  branch_id: number | null;
  branch?: Branch;
  telegramGroups?: TelegramGroup[];
}

export interface GetEmployeesParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
    name?: string;
    role?: string;
    branchId?: number | '';
}

const employeeService = {
    getAll: async (params: GetEmployeesParams = {}): Promise<PagedResponse<Employee>> => {
        // Clonar los parámetros para no modificar el objeto original
        const queryParams = { ...params };
        
        // Eliminar claves vacías para no enviarlas en la URL
        Object.keys(queryParams).forEach(key => {
            const typedKey = key as keyof GetEmployeesParams;
            if (queryParams[typedKey] === '' || queryParams[typedKey] === null || queryParams[typedKey] === undefined) {
                delete queryParams[typedKey];
            }
        });

        const response = await api.get('/employees', { params: queryParams });
        return response.data;
    },

    getPending: async (): Promise<Employee[]> => {
        const response = await api.get('/employees/pending');
        return response?.data?.data || [];
    },

    getAssignedGroups: async (employeeId: number): Promise<TelegramGroup[]> => {
        const response = await api.get(`/employees/${employeeId}/groups`);
        return response.data.data;
    },

    activate: async (employeeId: number, data: {
        final_role: 'crew_member' | 'crew_leader' | 'sales_person';
        branches: number[];
        is_leader?: boolean;
        animal?: string;
        telegram_groups?: number[];
    }): Promise<{ success: boolean; message: string; data: any }> => {
        const response = await api.post(`/employees/${employeeId}/activate`, data);
        return response.data;
    },

    reject: async (employeeId: number, reason?: string): Promise<{ success: boolean; message: string }> => {
        const response = await api.post(`/employees/${employeeId}/reject`, { reason });
        return response.data;
    }
};

export default employeeService;
