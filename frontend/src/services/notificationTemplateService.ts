import { api } from '../config/api';
import { type NotificationType } from './notificationTypeService';

export interface NotificationTemplate {
    id: number;
    name: string;
    notification_type_id: number;
    level: number | null;
    template_text: string;
    notificationType?: NotificationType;
}

export type CreateTemplateData = Omit<NotificationTemplate, 'id' | 'notificationType'>;
export type UpdateTemplateData = Partial<CreateTemplateData>;



const notificationTemplateService = {
    getAll: async (): Promise<NotificationTemplate[]> => {
        const response = await api.get('/notification-templates');
        return response.data;
    },

    create: async (data: CreateTemplateData): Promise<NotificationTemplate> => {
        const response = await api.post('/notification-templates', data);
        return response.data;
    },

    update: async (id: number, data: UpdateTemplateData): Promise<NotificationTemplate> => {
        const response = await api.put(`/notification-templates/${id}`, data);
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await api.delete(`/notification-templates/${id}`);
    },
};

export default notificationTemplateService; 