'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const bcrypt = require('bcryptjs');

const User = sequelize.define('User', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    rol_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'user_rol',
            key: 'id'
        }
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true,
        validate: {
            isEmail: true
        }
    },
    password: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    telegram_id: {
        type: DataTypes.STRING(50),
        allowNull: true
    }
}, {
    tableName: 'user',
    schema: 'botzilla',
    timestamps: false, // Desactivamos timestamps por ahora
    hooks: {
        beforeSave: async (user) => {
            if (user.changed('password')) {
                console.log('[USER MODEL] Hasheando nueva contraseña');
                const salt = await bcrypt.genSalt(10);
                user.password = await bcrypt.hash(user.password, salt);
                console.log('[USER MODEL] Contraseña hasheada exitosamente');
            }
        }
    }
});

// Método de instancia para validar contraseña
User.prototype.validatePassword = async function(password) {
    console.log('[USER MODEL] Validando contraseña para usuario:', this.email);
    console.log('[USER MODEL] Contraseña almacenada (hash):', this.password);
    try {
        const isValid = await bcrypt.compare(password, this.password);
        console.log('[USER MODEL] Resultado de validación:', isValid);
        return isValid;
    } catch (error) {
        console.error('[USER MODEL] Error al validar contraseña:', error);
        return false;
    }
};

module.exports = User; 