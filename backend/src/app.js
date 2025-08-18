const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
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

// Middlewares de logging (antes que todo)
app.use(requestLogger);

// Middlewares de seguridad
app.use(helmet());

// Configuración CORS más permisiva para desarrollo con ngrok
const corsOptions = {
    origin: function (origin, callback) {
        // Permite cualquier origen durante desarrollo
        // En producción, especifica los dominios permitidos
        callback(null, true);
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