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
app.use(limiter);

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

// Configuración CORS específica para producción
const corsOptions = {
    origin: function (origin, callback) {
        // En desarrollo, permitir cualquier origen
        if (process.env.NODE_ENV === 'development') {
            return callback(null, true);
        }
        
        // En producción, solo permitir dominios específicos
        const allowedOrigins = [
            process.env.FRONTEND_URL,
            'https://tudominio.com',
            'https://www.tudominio.com',
            'https://app.tudominio.com'
        ].filter(Boolean); // Remover valores undefined
        
        // Permitir requests sin origin (como apps móviles o Postman)
        if (!origin) return callback(null, true);
        
        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.warn('CORS blocked origin:', origin);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json()); // Habilitado para parsear JSON en el body

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
// app.use('/api/column-map', columnMapRoutes); // Eliminado
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