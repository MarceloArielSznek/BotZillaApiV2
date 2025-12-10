const http = require('http');
const app = require('./app');
const sequelize = require('./config/database');
const { initializeSocket } = require('./socket/socketServer');
require('dotenv').config();

const PORT = process.env.PORT || 3000;

async function diagnoseDatabase() {
    try {
        await sequelize.authenticate();
        
        const [results] = await sequelize.query(`
            SELECT current_database() as database_name, 
                   current_schema() as current_schema;
        `);

        const { database_name, current_schema } = results[0];
        console.log(`✅ Database connection successful. Using '${database_name}' database and '${current_schema}' schema.`);
        
    } catch (error) {
        console.error('❌ Database connection failed:', error.message);
        throw error;
    }
}

// Heartbeat para mantener la conexión activa
function setupDatabaseHeartbeat() {
    const HEARTBEAT_INTERVAL = 30000; // 30 segundos
    
    setInterval(async () => {
        try {
            await sequelize.query('SELECT 1');
            console.log('💓 Database heartbeat OK');
        } catch (error) {
            console.error('❌ Database heartbeat failed:', error.message);
            // Intentar reconectar
            try {
                await sequelize.authenticate();
                console.log('✅ Database reconnected successfully');
            } catch (reconnectError) {
                console.error('❌ Failed to reconnect to database:', reconnectError.message);
            }
        }
    }, HEARTBEAT_INTERVAL);
    
    console.log(`💓 Database heartbeat started (every ${HEARTBEAT_INTERVAL / 1000}s)`);
}

async function startServer() {
    try {
        await diagnoseDatabase();
        
        // Iniciar heartbeat para mantener conexión viva
        setupDatabaseHeartbeat();
        
        // Crear servidor HTTP
        const server = http.createServer(app);
        
        // Inicializar Socket.io
        initializeSocket(server);
        
        // Iniciar servidor
        server.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
            console.log(`🔌 WebSocket server ready`);
        });
    } catch (error) {
        console.error('🚫 Unable to start server due to database connection issue.');
    }
}

startServer(); 