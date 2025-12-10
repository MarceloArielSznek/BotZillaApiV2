import { api } from '../config/api';

export interface FollowUpStatus {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export interface FollowUpLabel {
  id: number;
  name: string;
  description?: string;
  color?: string;
}

export interface ChatMessage {
  id: number;
  chat_id: number;
  sender_type: 'agent' | 'customer' | 'system';
  sender_name: string;
  message_text: string;
  metadata?: any;
  sent_at: string;
  read_at?: string;
}

export interface Chat {
  id: number;
  messages: ChatMessage[];
}

export interface FollowUpTicket {
  id: number;
  estimate_id: number;
  followed_up: boolean;
  status_id?: number;
  label_id?: number;
  chat_id?: number;
  notes?: string;
  assigned_to?: number;
  follow_up_date?: string;
  last_contact_date?: string;
  created_at: string;
  updated_at: string;
  status?: FollowUpStatus;
  label?: FollowUpLabel;
  assignedUser?: {
    id: number;
    email: string;
    phone?: string;
  };
  chat?: Chat;
}

const followUpTicketService = {
  // Obtener ticket por estimate_id
  getTicketByEstimateId: async (estimateId: number): Promise<FollowUpTicket> => {
    const response = await api.get(`/follow-up-tickets/by-estimate/${estimateId}`);
    // Handle cancelled requests from axios interceptor
    if ((response as any)?.canceled || !response || !response.data) {
      throw new Error('Request was cancelled or invalid response');
    }
    return response.data.data;
  },

  // Actualizar ticket
  updateTicket: async (ticketId: number, updates: Partial<FollowUpTicket>): Promise<FollowUpTicket> => {
    const response = await api.put(`/follow-up-tickets/${ticketId}`, updates);
    if ((response as any)?.canceled || !response || !response.data) {
      throw new Error('Request was cancelled or invalid response');
    }
    return response.data.data;
  },

  // Obtener o crear chat
  getOrCreateChat: async (ticketId: number): Promise<Chat> => {
    const response = await api.get(`/follow-up-tickets/${ticketId}/chat`);
    if ((response as any)?.canceled || !response || !response.data) {
      throw new Error('Request was cancelled or invalid response');
    }
    return response.data.data;
  },

  // Agregar mensaje al chat
  addMessageToChat: async (chatId: number, message: {
    sender_type: 'agent' | 'customer' | 'system';
    sender_name: string;
    message_text: string;
    metadata?: any;
    send_sms?: boolean; // Si es true, envía SMS a través del webhook
  }): Promise<ChatMessage> => {
    const response = await api.post(`/follow-up-tickets/chat/${chatId}/messages`, message);
    if ((response as any)?.canceled || !response || !response.data) {
      throw new Error('Request was cancelled or invalid response');
    }
    return response.data.data;
  },

  // Obtener todos los statuses
  getAllStatuses: async (): Promise<FollowUpStatus[]> => {
    const response = await api.get('/follow-up-tickets/statuses');
    if ((response as any)?.canceled || !response || !response.data) {
      return [];
    }
    return response.data.data || [];
  },

  // Obtener todos los labels
  getAllLabels: async (): Promise<FollowUpLabel[]> => {
    const response = await api.get('/follow-up-tickets/labels');
    if ((response as any)?.canceled || !response || !response.data) {
      return [];
    }
    return response.data.data || [];
  },

  // Obtener todos los chats con historial (inbox)
  getAllChats: async (params?: { limit?: number; offset?: number; branchId?: number; salesPersonId?: number }): Promise<{
    data: Array<{
      id: number;
      ticketId: number;
      estimateId: number;
      customerName: string;
      customerPhone: string;
      lastMessage: {
        text: string;
        sender: string;
        senderType: string;
        sentAt: string;
      };
      updatedAt: string;
      unreadCount: number;
      branchId?: number;
      branchName?: string;
      salesPersonId?: number;
      salesPersonName?: string;
    }>;
    total: number;
  }> => {
    const response = await api.get('/follow-up-tickets/chats', { params });
    if ((response as any)?.canceled || !response || !response.data) {
      // Retornar estructura vacía en lugar de lanzar error
      return { data: [], total: 0 };
    }
    return response.data;
  },

  // Marcar mensajes como leídos
  markMessagesAsRead: async (chatId: number): Promise<void> => {
    const response = await api.put(`/follow-up-tickets/chat/${chatId}/read`);
    if ((response as any)?.canceled || !response || !response.data) {
      // Ignorar errores de requests canceladas
      return;
    }
  },

  // Limpiar todos los mensajes del chat
  clearChat: async (chatId: number): Promise<void> => {
    const response = await api.delete(`/follow-up-tickets/chat/${chatId}/messages`);
    if ((response as any)?.canceled || !response || !response.data) {
      throw new Error('Request was cancelled or invalid response');
    }
  },
};

export default followUpTicketService;

