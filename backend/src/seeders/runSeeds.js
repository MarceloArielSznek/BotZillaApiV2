const sequelize = require('../config/database');
const { UserRol } = require('../models');

async function createInitialRoles() {
    try {
        await UserRol.bulkCreate([
            { name: 'admin' },
            { name: 'user' },
            { name: 'client' }
        ], {
            ignoreDuplicates: true,
            fields: ['name'] // Solo el campo name
        });
        console.log('Roles iniciales creados exitosamente');
    } catch (error) {
        console.error('Error creando roles:', error.message);
        throw error;
    }
}

async function runAllSeeds() {
    try {
        // Conectar a la base de datos
        await sequelize.authenticate();
        console.log('Conexión a la base de datos establecida.');

        // Crear roles (necesario antes del admin user)
        await createInitialRoles();

        // Importar y ejecutar el seed del admin
        const { createAdminUser } = require('./adminUser');
        await createAdminUser();

        console.log('¡Todos los seeds ejecutados exitosamente!');
        process.exit(0);
    } catch (error) {
        console.error('Error ejecutando seeds:', error.message);
        process.exit(1);
    }
}

// Ejecutar todos los seeds
runAllSeeds(); 