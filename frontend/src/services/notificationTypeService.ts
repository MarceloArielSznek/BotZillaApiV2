import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface NotificationType {
    id: number;
    name: string;
}

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

const notificationTypeService = {
    getAll: async (): Promise<NotificationType[]> => {
        const response = await axios.get(`${API_BASE_URL}/notification-types`, getAuthHeaders());
        return response.data;
    },

    create: async (name: string): Promise<NotificationType> => {
        const response = await axios.post(`${API_BASE_URL}/notification-types`, { name }, getAuthHeaders());
        return response.data;
    },

    update: async (id: number, name: string): Promise<NotificationType> => {
        const response = await axios.put(`${API_BASE_URL}/notification-types/${id}`, { name }, getAuthHeaders());
        return response.data;
    },

    delete: async (id: number): Promise<void> => {
        await axios.delete(`${API_BASE_URL}/notification-types/${id}`, getAuthHeaders());
    },
};

export default notificationTypeService; 