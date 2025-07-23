const app = require('./app');
const sequelize = require('./config/database');
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

async function startServer() {
    try {
        await diagnoseDatabase();
        
        app.listen(PORT, () => {
            console.log(`🚀 Server is running on port ${PORT}`);
        });
    } catch (error) {
        console.error('🚫 Unable to start server due to database connection issue.');
    }
}

startServer(); 