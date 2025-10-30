const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const estimatesRoutes = require('./routes/estimates.routes');
const branchesRoutes = require('./routes/branches.routes');
const salespersonsRoutes = require('./routes/salespersons.routes');
const statusesRoutes = require('./routes/statuses.routes');
const crewRoutes = require('./routes/crew.routes');
const automationsRoutes = require('./routes/automations.routes');
const notificationRoutes = require('./routes/notifications.routes');
const notificationTypeRoutes = require('./routes/notificationType.routes');
const notificationTemplateRoutes = require('./routes/notificationTemplate.routes');
const dashboardRoutes = require('./routes/dashboard.routes');
const makeRoutes = require('./routes/make.routes');
const jobsRoutes = require('./routes/jobs.routes');
const specialShiftRoutes = require('./routes/specialShift.routes');
const cacheRoutes = require('./routes/cache.routes');
const aiRoutes = require('./routes/ai.routes');
const healthRoutes = require('./routes/health.routes');
const columnMapRoutes = require('./routes/columnMap.routes');
const shiftApprovalRoutes = require('./routes/shiftApproval.routes');
const employeeRegistrationRoutes = require('./routes/employeeRegistration.routes');
const onboardingRoutes = require('./routes/onboarding.routes'); // Nueva ruta
const telegramGroupRoutes = require('./routes/telegramGroups.routes'); // Ruta para CRUD
const employeeRoutes = require('./routes/employees.routes'); // Ruta para Empleados
const telegramGroupCategoryRoutes = require('./routes/telegramGroupCategory.routes'); // Ruta para Categorías
const inspectionReportsRoutes = require('./routes/inspectionReports.routes.js');
const jobSyncRoutes = require('./routes/jobSync.routes');
const jobStatusRoutes = require('./routes/jobStatus.routes');
const atticTechUserRoutes = require('./routes/atticTechUser.routes');
const atticTechSyncRoutes = require('./routes/atticTechSync.routes');
const performanceRoutes = require('./routes/performance.routes');
const overrunReportRoutes = require('./routes/overrunReport.routes');
// const botRoutes = require('./routes/bot.routes'); // No longer needed
const { logger, requestLogger, errorLogger } = require('./utils/logger');
const { caches } = require('./utils/cache');

const app = express();

// Configurar trust proxy solo para Cloudflare y Nginx
app.set('trust proxy', [
    '127.0.0.1',      // Nginx local
    '::1',            // Nginx local IPv6
    '173.245.48.0/20', // Cloudflare IPs
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22'
]);

// CORS debe ir lo más arriba posible
// Configuración CORS específica para desarrollo
const corsOptions = {
    origin: function (origin, callback) {
        // En desarrollo, permitir localhost en cualquier puerto
        if (!origin || 
            (typeof origin === 'string' && (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:'))) ||
            process.env.NODE_ENV === 'development') {
            callback(null, true);
        } else if (process.env.NODE_ENV === 'production') {
            // En producción, usar lista de orígenes permitidos
            const allowedOrigins = [
                process.env.FRONTEND_URL,
                'https://yallaprojects.com'
            ].filter(Boolean);
            
            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        } else {
            console.log('✅ CORS: Permitiendo por defecto');
            callback(null, true);
        }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    optionsSuccessStatus: 204
};

// Preflight y CORS: garantizar respuestas correctas ANTES de otros middlewares
app.use((req, res, next) => {
    const origin = req.get('origin');
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        if (origin) {
            res.header('Access-Control-Allow-Origin', origin);
        } else {
            res.header('Access-Control-Allow-Origin', '*');
        }
        res.header('Access-Control-Allow-Credentials', 'true');
        res.header('Vary', 'Origin');
    }

    if (req.method === 'OPTIONS') {
        const requestHeaders = req.get('Access-Control-Request-Headers');
        // Asegurar Allow-Origin también en preflight
        if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
            if (origin) {
                res.header('Access-Control-Allow-Origin', origin);
            } else {
                res.header('Access-Control-Allow-Origin', '*');
            }
            res.header('Access-Control-Allow-Credentials', 'true');
            res.header('Vary', 'Origin');
        }
        res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
        if (requestHeaders) {
            res.header('Access-Control-Allow-Headers', requestHeaders);
        } else {
            res.header('Access-Control-Allow-Headers', 'Authorization,Content-Type,Accept,Origin');
        }
        res.header('Access-Control-Max-Age', '86400');
        return res.status(204).end();
    }
    next();
});
app.use(cors(corsOptions));

// Middlewares de logging (antes que todo)
app.use(requestLogger);

// Middlewares de seguridad
app.use(helmet());

// Rate limiting para protección básica
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 100, // máximo 100 requests por IP por ventana
    message: {
        success: false,
        message: 'Demasiadas solicitudes desde esta IP, intenta de nuevo en 15 minutos'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Aplicar rate limiting a todas las rutas
app.use(limiter); // Volver a habilitar el rate limiter

// Rate limiting más estricto para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login por IP
    message: {
        success: false,
        message: 'Demasiados intentos de login, intenta de nuevo en 15 minutos'
    },
    skipSuccessfulRequests: true,
});

// Quitamos el preflight manual (lo maneja cors) y dejamos solo uno

// Middleware adicional para logging
app.use((req, res, next) => {
    // Solo log detallado en desarrollo (NODE_ENV no definido o development)
    if (!process.env.NODE_ENV || process.env.NODE_ENV === 'development') {
        console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
    }
    next();
});

app.use(express.json({ limit: '10mb' })); // Habilitado para parsear JSON en el body

// Timeout para requests
app.use((req, res, next) => {
    req.setTimeout(30000, () => {
        console.log('[TIMEOUT] Request timeout after 30s:', req.method, req.path);
        if (!res.headersSent) {
            res.status(408).json({ 
                success: false, 
                message: 'Request timeout' 
            });
        }
    });
    next();
});

// Log del inicio de la aplicación
logger.info('BotZilla API V2 iniciando...', {
    nodeEnv: process.env.NODE_ENV,
    logLevel: process.env.LOG_LEVEL || 'INFO'
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/estimates', estimatesRoutes);
app.use('/api/branches', branchesRoutes);
app.use('/api/salespersons', salespersonsRoutes);
app.use('/api/estimate-statuses', statusesRoutes);
app.use('/api/crew-members', crewRoutes);
app.use('/api/automations', automationsRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-types', notificationTypeRoutes);
app.use('/api/notification-templates', notificationTemplateRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/make', makeRoutes);
app.use('/api/jobs', jobsRoutes);
app.use('/api/special-shifts', specialShiftRoutes);
app.use('/api/cache', cacheRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api', healthRoutes);
app.use('/api/column-map', columnMapRoutes);
app.use('/api/shift-approval', shiftApprovalRoutes);
app.use('/api/employee-registration', employeeRegistrationRoutes);
app.use('/api/attic-tech-users', atticTechUserRoutes);
app.use('/api/attic-tech-sync', atticTechSyncRoutes);
app.use('/api/onboarding', onboardingRoutes); // Nueva ruta
app.use('/api/telegram-groups', telegramGroupRoutes); // Ruta para CRUD
app.use('/api/employees', employeeRoutes); // Ruta para Empleados
app.use('/api/telegram-group-categories', telegramGroupCategoryRoutes); // Ruta para Categorías
app.use('/api/inspection-reports', inspectionReportsRoutes);
app.use('/api/job-sync', jobSyncRoutes);
app.use('/api/job-statuses', jobStatusRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/overrun-reports', overrunReportRoutes);
// app.use('/api/bot', botRoutes); // No longer needed

// Health check endpoint
app.get('/health', (req, res) => {
    logger.debug('Health check requested');
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Cache stats endpoint (solo en desarrollo)
app.get('/api/cache/stats', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: 'Not found' });
    }
    
    const stats = Object.keys(caches).reduce((acc, key) => {
        acc[key] = caches[key].getStats();
        return acc;
    }, {});
    
    res.json(stats);
});

// Cache clear endpoint (solo en desarrollo)
app.delete('/api/cache', (req, res) => {
    if (process.env.NODE_ENV === 'production') {
        return res.status(404).json({ message: 'Not found' });
    }
    
    const cleared = Object.keys(caches).reduce((acc, key) => {
        acc[key] = caches[key].clear();
        return acc;
    }, {});
    
    logger.info('Cache manually cleared', cleared);
    res.json({ message: 'Cache cleared', cleared });
});

// 404 handler
app.use('*', (req, res) => {
    logger.warn('Route not found', {
        method: req.method,
        url: req.originalUrl,
        ip: req.ip
    });
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Error handling middleware con logging
app.use(errorLogger);
app.use((err, req, res, next) => {
    const statusCode = err.status || err.statusCode || 500;
    const message = err.message || 'Internal Server Error';
    
    res.status(statusCode).json({
        success: false,
        message,
        error: process.env.NODE_ENV === 'development' ? {
            stack: err.stack,
            details: err
        } : undefined,
        requestId: req.requestId
    });
});

// Graceful shutdown
process.on('SIGTERM', () => {
    logger.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

// Cleanup logs antiguos cada día
setInterval(() => {
    logger.cleanupOldLogs(30);
}, 24 * 60 * 60 * 1000);

module.exports = app; 