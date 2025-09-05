import { api } from '../config/api';

export interface NotificationType {
    id: number;
    name: string;
}


const notificationTypeService = {
    getAll: async (): Promise<NotificationType[]> => {
        const response = await api.get('/notification-types');
        return response.data;
    },

    create: async (name: string): Promise<NotificationType> => {
        const response = await api.post('/notification-types', { name });
        return response.data;
    },

    update: async (id: number, name: string): Promise<NotificationType> => {
        const response = await api.put(`/notification-types/${id}`, { name });
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/notification-types/${id}`);
    },
};

export default notificationTypeService; 