#!/usr/bin/env node

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Sequelize } = require('sequelize');

console.log('🔒 Probando conexión SSL a la base de datos...\n');

// Configuración con SSL
const sequelize = new Sequelize({
    dialect: 'postgres',
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    username: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    schema: process.env.DB_SCHEMA,
    logging: false,
    dialectOptions: {
        ssl: {
            require: true,
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true'
        }
    }
});

async function testConnection() {
    try {
        console.log('📊 Configuración de conexión:');
        console.log(`  Host: ${process.env.DB_HOST}:${process.env.DB_PORT}`);
        console.log(`  Database: ${process.env.DB_NAME}`);
        console.log(`  Schema: ${process.env.DB_SCHEMA}`);
        console.log(`  SSL: ${process.env.DB_SSL_ENABLED === 'true' ? 'HABILITADO' : 'DESHABILITADO'}`);
        console.log(`  Reject Unauthorized: ${process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true' ? 'SÍ' : 'NO'}\n`);

        console.log('🔌 Intentando conectar...');
        const connection = await sequelize.authenticate();
        
        console.log('✅ Conexión SSL exitosa!');
        console.log('🔒 La conexión está encriptada con SSL');
        
        // Probar una consulta simple
        const result = await sequelize.query('SELECT version() as version');
        console.log(`📋 Versión de PostgreSQL: ${result[0][0].version}`);
        
    } catch (error) {
        console.error('❌ Error de conexión SSL:');
        console.error(`  Tipo: ${error.name}`);
        console.error(`  Mensaje: ${error.message}`);
        
        if (error.message.includes('SSL')) {
            console.log('\n💡 Sugerencias:');
            console.log('  1. Verificar que PostgreSQL tenga SSL habilitado');
            console.log('  2. Verificar certificados SSL');
            console.log('  3. Intentar con DB_SSL_REJECT_UNAUTHORIZED=false');
        }
    } finally {
        await sequelize.close();
        console.log('\n🔌 Conexión cerrada');
    }
}

testConnection();
