'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalesPerson = sequelize.define('SalesPerson', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true
    },
    telegram_id: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    employee_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'employee',
            key: 'id'
        }
    },
    warning_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'sales_person', // Cambio aquí para evitar colisión de nombres
    tableName: 'sales_person',
    schema: 'botzilla',
    timestamps: false
});

module.exports = SalesPerson; 