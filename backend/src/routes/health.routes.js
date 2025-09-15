const express = require('express');
const router = express.Router();
const sequelize = require('../config/database');

// Simple ping endpoint
router.get('/ping', (req, res) => {
    res.json({ 
        status: 'pong', 
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// CORS test endpoint (solo para desarrollo)
router.post('/cors-test', (req, res) => {
    // Solo disponible en desarrollo (NODE_ENV no definido o development)
    if (process.env.NODE_ENV && process.env.NODE_ENV !== 'development') {
        return res.status(404).json({ message: 'Not found' });
    }
    
    res.json({
        status: 'cors-working',
        timestamp: new Date().toISOString(),
        message: 'CORS is working correctly!'
    });
});

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        // Test database connection
        await sequelize.authenticate();
        
        const dbStats = {
            pool: {
                total: sequelize.connectionManager.pool.size,
                used: sequelize.connectionManager.pool.used,
                waiting: sequelize.connectionManager.pool.pending
            }
        };
        
        res.json({
            status: 'healthy',
            timestamp: new Date().toISOString(),
            database: 'connected',
            dbStats,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    } catch (error) {
        console.error('[HEALTH] Database connection failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: error.message,
            uptime: process.uptime(),
            memory: process.memoryUsage()
        });
    }
});

// Database connection test
router.get('/db-test', async (req, res) => {
    try {
        console.log('[DB-TEST] 🔍 Testing database connection...');
        
        const startTime = Date.now();
        await sequelize.authenticate();
        const connectionTime = Date.now() - startTime;
        
        console.log('[DB-TEST] ✅ Database connected successfully in', connectionTime, 'ms');
        
        // Test a simple query
        const queryStartTime = Date.now();
        const result = await sequelize.query('SELECT 1 as test');
        const queryTime = Date.now() - queryStartTime;
        
        console.log('[DB-TEST] ✅ Test query executed in', queryTime, 'ms');
        
        res.json({
            status: 'success',
            connectionTime: `${connectionTime}ms`,
            queryTime: `${queryTime}ms`,
            result: result[0]
        });
    } catch (error) {
        console.error('[DB-TEST] ❌ Database test failed:', error);
        res.status(500).json({
            status: 'error',
            message: error.message,
            type: error.name
        });
    }
});

module.exports = router;
