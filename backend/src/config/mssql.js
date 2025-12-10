/**
 * MS SQL Server Configuration
 * Conexión a la base de datos de Attic/BuilderTrend
 */

const sql = require('mssql');
const { logger } = require('../utils/logger');

// Configuración de la conexión
const config = {
    user: process.env.MSSQL_USER,
    password: process.env.MSSQL_PASSWORD,
    server: process.env.MSSQL_HOST,
    port: parseInt(process.env.MSSQL_PORT || '1433'),
    database: process.env.MSSQL_DATABASE,
    options: {
        encrypt: process.env.MSSQL_ENCRYPT === 'true',
        trustServerCertificate: true,
        enableArithAbort: true,
        connectionTimeout: 30000,
        requestTimeout: 30000
    },
    pool: {
        max: 10,
        min: 0,
        idleTimeoutMillis: 30000
    }
};

// Pool de conexiones global
let pool = null;

/**
 * Obtener o crear el pool de conexiones
 * @returns {Promise<sql.ConnectionPool>}
 */
async function getPool() {
    if (!pool) {
        try {
            logger.info('Initializing MS SQL connection pool', {
                server: config.server,
                database: config.database,
                user: config.user
            });
            
            pool = await new sql.ConnectionPool(config).connect();
            
            logger.info('MS SQL connection pool initialized successfully');
            
            // Manejar errores del pool
            pool.on('error', err => {
                logger.error('MS SQL pool error', {
                    error: err.message,
                    stack: err.stack
                });
            });
            
        } catch (error) {
            logger.error('Failed to initialize MS SQL connection pool', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    return pool;
}

/**
 * Cerrar el pool de conexiones
 */
async function closePool() {
    if (pool) {
        try {
            await pool.close();
            pool = null;
            logger.info('MS SQL connection pool closed');
        } catch (error) {
            logger.error('Error closing MS SQL pool', {
                error: error.message
            });
        }
    }
}

/**
 * Ejecutar una query
 * @param {string} query - Query SQL
 * @param {Object} params - Parámetros para la query
 * @returns {Promise<any>}
 */
async function executeQuery(query, params = {}) {
    const currentPool = await getPool();
    const request = currentPool.request();
    
    // Agregar parámetros
    for (const [key, value] of Object.entries(params)) {
        request.input(key, value);
    }
    
    const result = await request.query(query);
    return result;
}

module.exports = {
    sql,
    getPool,
    closePool,
    executeQuery
};

