import axios from 'axios';

// Configuración flexible de API
const getApiBaseUrl = () => {
    // Si estás usando ngrok, descomenta la línea de abajo y reemplaza con tu URL
    // return 'https://tu-dominio-ngrok.ngrok-free.app/api';
    
    // Para desarrollo local
    return import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api';
};

export const API_BASE_URL = getApiBaseUrl();

export const api = axios.create({
    baseURL: API_BASE_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
}, (error) => {
    return Promise.reject(error);
});


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