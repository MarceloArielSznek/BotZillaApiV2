const { Sequelize } = require('sequelize');
require('dotenv').config();

// Log para debugging de configuración (solo en desarrollo)
if (process.env.NODE_ENV === 'development') {
    console.log('🔧 DATABASE CONFIG:');
    console.log(`  Host: ${process.env.DB_HOST}`);
    console.log(`  Port: ${process.env.DB_PORT}`);
    console.log(`  Database: ${process.env.DB_NAME}`);
    console.log(`  Username: ${process.env.DB_USER}`);
    console.log(`  Schema: ${process.env.DB_SCHEMA}`);
    console.log(`  SSL: ${process.env.DB_SSL_ENABLED || 'false'}`);
    console.log('');
}

const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    schema: process.env.DB_SCHEMA,
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    define: {
        timestamps: true,
        underscored: true,
        schema: process.env.DB_SCHEMA
    },
    dialectOptions: {
        ssl: process.env.DB_SSL_ENABLED === 'true' ? {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
        } : false
    },
    pool: {
        max: 5,
        min: 0,
        acquire: 30000,
        idle: 10000
    }
});

module.exports = sequelize; 