import axios from 'axios';
import { API_BASE_URL } from '../config/api';
import authService from './authService';

export interface Notification {
    id: number;
    message: string;
    recipient_type: string;
    recipient_id: number;
    recipient_name: string | null;
    read_at: string | null;
    sent_to_telegram: boolean;
    created_at: string;
}

export interface FetchNotificationsParams {
    page?: number;
    limit?: number;
    recipientId?: number;
    recipientType?: string;
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
}

export interface FetchNotificationsResponse {
    data: Notification[];
    total: number;
    pages: number;
    currentPage: number;
}

export interface DashboardStats {
    sentToday: number;
    sentThisWeek: number;
    salespersonsOverLimit: { id: number; name: string; activeLeadsCount: string; }[];
    recentWarnings: (Notification & { salesPersonRecipient?: { name: string } })[];
    typeCounts: { name: string; count: string; }[];
}

const getAuthHeaders = () => {
    const token = authService.getToken();
    return {
        headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
        },
    };
};

const notificationService = {
    fetchNotifications: async (params: FetchNotificationsParams = {}): Promise<FetchNotificationsResponse> => {
        try {
            const response = await axios.get(`${API_BASE_URL}/notifications`, {
                ...getAuthHeaders(),
                params: params,
            });
            return response.data;
        } catch (error: any) {
            console.error('Error fetching notifications:', error.response?.data || error.message);
            throw error;
        }
    },

    fetchDashboardStats: async (): Promise<DashboardStats> => {
        try {
            const response = await axios.get(`${API_BASE_URL}/notifications/dashboard-stats`, getAuthHeaders());
            return response.data;
        } catch (error: any) {
            console.error('Error fetching notification dashboard stats:', error);
            throw error.response?.data || error;
        }
    },
};

export default notificationService; 