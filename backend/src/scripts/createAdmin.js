const { User, UserRol } = require('../models');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function createAdminUser() {
    try {
        // Asegurarnos que existe el rol de admin
        let adminRole = await UserRol.findOne({ where: { name: 'admin' } });
        if (!adminRole) {
            adminRole = await UserRol.create({
                name: 'admin',
                description: 'Administrator role'
            });
            console.log('Admin role created');
        }

        // Verificar si el usuario admin ya existe
        let adminUser = await User.findOne({ where: { email: 'admin@botzilla.com' } });
        
        if (!adminUser) {
            // Crear el usuario admin
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            
            adminUser = await User.create({
                email: 'admin@botzilla.com',
                password: hashedPassword,
                rol_id: adminRole.id,
                phone: '123456789',
                telegram_id: 'admin'
            });
            console.log('Admin user created successfully');
        } else {
            // Actualizar la contraseña del admin
            const salt = await bcrypt.genSalt(10);
            const hashedPassword = await bcrypt.hash('admin123', salt);
            await adminUser.update({ password: hashedPassword });
            console.log('Admin password updated successfully');
        }

        console.log('Admin user details:');
        console.log('Email: admin@botzilla.com');
        console.log('Password: admin123');
        
        process.exit(0);
    } catch (error) {
        console.error('Error creating admin user:', error);
        process.exit(1);
    }
}

createAdminUser(); 