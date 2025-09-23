import { api } from '../config/api';
import { PagedResponse } from '../interfaces/PagedResponse';
import { TelegramGroupCategory } from './telegramGroupCategoryService';

// Asumimos una interfaz para TelegramGroup
export interface TelegramGroup {
    id: number;
    name: string;
    branch_id: number | null;
    telegram_id: number;
    description: string | null;
    category_id: number | null;
    is_default: boolean;
    branch?: {
        id: number;
        name: string;
    };
    category?: TelegramGroupCategory;
}

export interface GetGroupsParams {
    page?: number;
    limit?: number;
    sortBy?: string;
    order?: 'ASC' | 'DESC';
    name?: string;
    branchId?: number | '';
    categoryId?: number | '';
}

const telegramGroupService = {
    getAll: async (params: GetGroupsParams = {}): Promise<PagedResponse<TelegramGroup>> => {
        // Clonar los parámetros para no modificar el objeto original
        const queryParams = { ...params };
        
        // Eliminar claves vacías para no enviarlas en la URL (ej. branchId: '')
        Object.keys(queryParams).forEach(key => {
            const typedKey = key as keyof GetGroupsParams;
            if (queryParams[typedKey] === '' || queryParams[typedKey] === null || queryParams[typedKey] === undefined) {
                delete queryParams[typedKey];
            }
        });

        const response = await api.get('/telegram-groups', { params: queryParams });
        return response.data;
    },

    getById: async (id: number): Promise<TelegramGroup> => {
        const response = await api.get(`/telegram-groups/${id}`);
        return response.data.data;
    },

    create: async (groupData: Omit<TelegramGroup, 'id' | 'branch' | 'category'>): Promise<TelegramGroup> => {
        const response = await api.post('/telegram-groups', groupData);
        return response.data.data;
    },

    update: async (id: number, groupData: Omit<TelegramGroup, 'id' | 'branch' | 'category'>): Promise<TelegramGroup> => {
        const response = await api.put(`/telegram-groups/${id}`, groupData);
        return response.data.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/telegram-groups/${id}`);
    }
};

export default telegramGroupService;
