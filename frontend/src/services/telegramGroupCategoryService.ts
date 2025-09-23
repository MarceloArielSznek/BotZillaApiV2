import { api } from '@/config/api';

export interface TelegramGroupCategory {
    id: number;
    name: string;
}

const telegramGroupCategoryService = {
    getAll: async (): Promise<TelegramGroupCategory[]> => {
        const response = await api.get('/telegram-group-categories');
        return response.data.data;
    }
};

export default telegramGroupCategoryService;
