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
    warning_count: {
        type: DataTypes.INTEGER,
        defaultValue: 0
    }
}, {
    sequelize,
    modelName: 'sales_person', // Cambio aquí para evitar colisión de nombres
    tableName: 'sales_person',
    schema: 'botzilla',
    timestamps: false
});

module.exports = SalesPerson; 