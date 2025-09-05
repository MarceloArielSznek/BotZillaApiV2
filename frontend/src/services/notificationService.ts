import { api } from '../config/api';

export interface Notification {
    id: number;
    message: string;
    recipient_type: string;
    recipient_id: number;
    recipient_name: string | null;
    read_at?: string | null;
    sent_to_telegram?: boolean;
    created_at: string;
}

export interface FetchNotificationsParams {
    page?: number;
    limit?: number;
    recipientId?: number;
    recipientType?: string;
    sort_by?: string;
    sort_order?: 'ASC' | 'DESC';
    notificationTypeId?: number;
    notificationTypeName?: string;
    dateFrom?: string; // ISO date
    dateTo?: string;   // ISO date
    recipientName?: string;
    level?: string;
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
    recentCongratulations: (Notification & { salesPersonRecipient?: { name: string } })[];
    typeCounts: { name: string; count: string; }[];
    typeCountsToday: { name: string; count: string; }[];
    typeCountsThisWeek: { name: string; count: string; }[];
    currentWarnings: { id: number; name: string; warning_count: number; activeLeadsCount: string; }[];
}


const notificationService = {
    fetchNotifications: async (params: FetchNotificationsParams = {}): Promise<FetchNotificationsResponse> => {
        try {
            const response = await api.get('/notifications', {
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
            const response = await api.get('/notifications/dashboard-stats');
            return response.data;
        } catch (error: any) {
            console.error('Error fetching notification dashboard stats:', error);
            throw error.response?.data || error;
        }
    },
};

export default notificationService; 