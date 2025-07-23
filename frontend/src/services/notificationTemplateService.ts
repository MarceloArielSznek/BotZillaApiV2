import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';
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


const getAuthHeaders = () => {
    const token = authService.getToken();
    if (!token) {
        throw new Error('No authentication token found');
    }
    return {
        headers: {
            Authorization: `Bearer ${token}`,
        },
    };
};

const notificationTemplateService = {
    getAll: async (): Promise<NotificationTemplate[]> => {
        const response = await axios.get(`${API_BASE_URL}/notification-templates`, getAuthHeaders());
        return response.data;
    },

    create: async (data: CreateTemplateData): Promise<NotificationTemplate> => {
        const response = await axios.post(`${API_BASE_URL}/notification-templates`, data, getAuthHeaders());
        return response.data;
    },

    update: async (id: number, data: UpdateTemplateData): Promise<NotificationTemplate> => {
        const response = await axios.put(`${API_BASE_URL}/notification-templates/${id}`, data, getAuthHeaders());
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await axios.delete(`${API_BASE_URL}/notification-templates/${id}`, getAuthHeaders());
    },
};

export default notificationTemplateService; 