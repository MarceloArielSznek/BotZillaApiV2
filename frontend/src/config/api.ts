export const API_BASE_URL = 'http://localhost:3000/api';

export const API_ENDPOINTS = {
    AUTH: {
        LOGIN: '/auth/login',
        REGISTER: '/auth/register',
        LOGOUT: '/auth/logout',
        VERIFY: '/auth/verify'
    },
    USERS: {
        LIST: '/users',
        CREATE: '/users',
        GET: (id: string) => `/users/${id}`,
        UPDATE: (id: string) => `/users/${id}`,
        DELETE: (id: string) => `/users/${id}`
    }
}; 