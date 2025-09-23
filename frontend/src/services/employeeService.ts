import { api } from '../config/api';
import { TelegramGroup } from './telegramGroupService'; // Importar la interfaz
import { PagedResponse } from '../interfaces/PagedResponse';

// La interfaz de Employee ya debe existir en otro lado, pero la definimos aquí
// para claridad si fuera necesario. Asumimos que la obtendremos de un archivo centralizado.
export interface Employee {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  status: 'pending' | 'approved' | 'rejected';
  role: 'crew_member' | 'crew_leader' | 'salesperson' | 'corporate';
  // ... otros campos
  telegramGroups?: TelegramGroup[];
}

const employeeService = {
    getAll: async (page = 1, limit = 20): Promise<PagedResponse<Employee>> => {
        const response = await api.get('/employees', { params: { page, limit } });
        return response.data;
    },

    getPending: async (): Promise<Employee[]> => {
        const response = await api.get('/employees/pending');
        return response.data.data;
    },

    getAssignedGroups: async (employeeId: number): Promise<TelegramGroup[]> => {
        const response = await api.get(`/employees/${employeeId}/groups`);
        return response.data.data;
    }
};

export default employeeService;
