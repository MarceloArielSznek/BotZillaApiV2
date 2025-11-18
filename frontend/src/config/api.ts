import axios from 'axios';

// Configuración flexible de API con proxy
const getApiBaseUrl = () => {
    // En desarrollo, usar proxy (sin localhost:3000)
    if (import.meta.env.DEV) {
        return '/api'; // Proxy manejará la redirección
    }
    
    // En producción, usar la URL del entorno
    return import.meta.env.VITE_API_BASE_URL || '/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Map para controlar requests en progreso
const pendingRequests = new Map();

export const api = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000, // 30 segundos timeout
    withCredentials: true, // Incluir cookies/credenciales
    headers: {
        'Content-Type': 'application/json'
    }
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('token');
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Crear una clave única para el request
    const requestKey = `${config.method?.toUpperCase()}_${config.url}`;
    
    // Cancelar request anterior si existe
    if (pendingRequests.has(requestKey)) {
        const controller = pendingRequests.get(requestKey);
        controller.abort();
        pendingRequests.delete(requestKey);
    }
    
    // Crear nuevo AbortController para este request
    const controller = new AbortController();
    config.signal = controller.signal;
    pendingRequests.set(requestKey, controller);
    
    if (import.meta.env.MODE === 'development') {
        console.log(`🚀 API Request: ${config.method?.toUpperCase()} ${config.url}`);
    }
    
    return config;
}, (error) => {
    console.error('❌ Request interceptor error:', error);
    return Promise.reject(error);
});

// Interceptor de respuesta para manejar errores de autenticación
api.interceptors.response.use(
    (response) => {
        // Limpiar request del map cuando se complete exitosamente
        const requestKey = `${response.config.method?.toUpperCase()}_${response.config.url}`;
        pendingRequests.delete(requestKey);
        
        if (import.meta.env.MODE === 'development') {
            console.log(`✅ API Response: ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`);
        }
        return response;
    },
    async (error) => {
        const originalRequest = error.config;
        
        // Limpiar request del map cuando hay error
        if (originalRequest) {
            const requestKey = `${originalRequest.method?.toUpperCase()}_${originalRequest.url}`;
            pendingRequests.delete(requestKey);
        }
        
        // Log detallado del error (solo errores importantes)
        if (import.meta.env.MODE === 'development' && 
            !error.message.includes('canceled') &&
            !error.message.includes('ERR_CANCELED')) {
            console.error('💥 API Error:', {
                message: error.message,
                status: error.response?.status,
                url: error.config?.url,
                method: error.config?.method,
                hasResponse: !!error.response,
                isNetworkError: !error.response
            });
        }
        
        // Error 401 - Token expirado o inválido
        if (error.response?.status === 401) {
            // Evitar loops infinitos de retry
            if (originalRequest._retry) {
                if (import.meta.env.MODE === 'development') {
                    console.warn('🔒 Sesión definitivamente expirada - redirigiendo al login');
                }
                
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                
                // Redirigir al login solo si no estamos ya en la página de login
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
            
            // Primer intento de retry con delay
            originalRequest._retry = true;
            
            if (import.meta.env.MODE === 'development') {
                console.warn('🔄 Error 401 - intentando retry en 500ms...');
            }
            
            // Pequeño delay antes del retry para evitar spam de requests
            await new Promise(resolve => setTimeout(resolve, 500));
            
            // Verificar si aún tenemos token
            const token = localStorage.getItem('token');
            if (token) {
                return api(originalRequest);
            }
        }
        
        // Errores de red (sin respuesta del servidor)
        if (!error.response) {
            // Ignorar errores de requests cancelados (navegación rápida)
            if (error.code === 'ERR_CANCELED' || error.message.includes('canceled')) {
                if (import.meta.env.MODE === 'development') {
                    console.log('🔄 Request cancelado (navegación rápida) - ignorando');
                }
                // Retornar un error silencioso que no se propague
                return Promise.resolve({ data: null, canceled: true });
            }

            // Detectar errores de CORS específicamente (solo si realmente es CORS)
            if (error.message.includes('blocked by CORS policy') || 
                (error.message.includes('CORS') && error.message.includes('Access-Control-Allow-Origin'))) {
                if (import.meta.env.MODE === 'development') {
                    console.error('🚨 Error de CORS real detectado:', error.message);
                    console.error('🔧 Verifica que el backend esté corriendo en http://localhost:3000');
                    console.error('🔧 Y que CORS esté configurado correctamente');
                }
                
                // No reintentar errores de CORS, redirigir al login
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                if (!window.location.pathname.includes('/login')) {
                    window.location.href = '/login';
                }
                return Promise.reject(error);
            }
            
            // Solo reintentar si parece ser un error de red real, no de navegación
            if (!originalRequest._networkRetry && 
                !error.message.includes('ERR_FAILED') && 
                !error.message.includes('fetch')) {
                originalRequest._networkRetry = true;
                if (import.meta.env.MODE === 'development') {
                    console.warn('🌐 Error de red - reintentando en 1s...', error.message);
                }
                await new Promise(resolve => setTimeout(resolve, 1000));
                return api(originalRequest);
            } else {
                if (import.meta.env.MODE === 'development') {
                    console.warn('🚨 Error de red (probablemente navegación rápida):', error.message);
                }
                // No redirigir al login por errores de navegación rápida
                return Promise.reject(error);
            }
        }
        
        // Error 500+ del servidor
        if (error.response?.status >= 500) {
            if (!originalRequest._serverRetry) {
                originalRequest._serverRetry = true;
                if (import.meta.env.MODE === 'development') {
                    console.warn('🔧 Error del servidor - reintentando en 2s...');
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
                return api(originalRequest);
            }
        }
        
        // En producción, no mostrar detalles de errores de API
        if (import.meta.env.MODE === 'production') {
            // Crear error genérico sin exponer URLs o detalles internos
            const sanitizedError = new Error('Error de conexión');
            return Promise.reject(sanitizedError);
        }
        
        return Promise.reject(error);
    }
);


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

// Función para cancelar todos los requests pendientes
export const cancelAllPendingRequests = () => {
    pendingRequests.forEach((controller, key) => {
        controller.abort();
        if (import.meta.env.MODE === 'development') {
            console.log(`🚫 Cancelando request: ${key}`);
        }
    });
    pendingRequests.clear();
};

// Servicio para branch configurations
export const branchConfigurationsService = {
    getAll: () => api.get('/branch-configurations'),
    getById: (id: number) => api.get(`/branch-configurations/${id}`)
}; 