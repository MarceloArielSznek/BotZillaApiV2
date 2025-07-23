const { User, UserRol } = require('../models');
const bcrypt = require('bcryptjs');

async function createAdminUser() {
    try {
        // Ensure admin role exists
        const adminRole = await UserRol.findOne({ where: { name: 'admin' } });
        if (!adminRole) {
            console.error('Admin role not found. Please run database migrations first.');
            return;
        }

        // Create admin user
        const adminUser = await User.create({
            email: 'admin@botzilla.com',
            password: 'admin123', // Will be hashed by the model hook
            rol_id: adminRole.id,
            phone: null,
            telegram_id: null
        });

        console.log('Admin user created successfully:', adminUser.email);
    } catch (error) {
        console.error('Error creating admin user:', error);
    }
}

module.exports = { createAdminUser }; // Exportamos la función correctamente 