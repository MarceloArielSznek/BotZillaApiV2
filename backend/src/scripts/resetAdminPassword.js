const { User } = require('../models');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function resetAdminPassword() {
    try {
        // Buscar el usuario admin
        const admin = await User.findOne({ where: { email: 'admin@botzilla.com' } });
        
        if (!admin) {
            console.log('Usuario admin no encontrado');
            process.exit(1);
        }

        // Generar nuevo hash de contraseña
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash('admin123', salt);

        // Actualizar la contraseña directamente en la base de datos
        await User.update(
            { password: hashedPassword },
            { 
                where: { email: 'admin@botzilla.com' },
                individualHooks: false // Evitar el hook de beforeSave
            }
        );

        console.log('Contraseña de admin reseteada exitosamente');
        console.log('Email: admin@botzilla.com');
        console.log('Nueva contraseña: admin123');
        
        // Verificar que la contraseña se actualizó correctamente
        const updatedAdmin = await User.findOne({ where: { email: 'admin@botzilla.com' } });
        const isValid = await bcrypt.compare('admin123', updatedAdmin.password);
        console.log('Verificación de contraseña:', isValid ? 'Exitosa' : 'Fallida');
        console.log('Hash de contraseña actual:', updatedAdmin.password);

        process.exit(0);
    } catch (error) {
        console.error('Error reseteando contraseña de admin:', error);
        process.exit(1);
    }
}

resetAdminPassword(); 