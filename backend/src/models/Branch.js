'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Branch = sequelize.define('Branch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    telegram_group_id: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT
    }
}, {
    sequelize,
    modelName: 'branch_model', // Cambio aquí para evitar colisión de nombres
    tableName: 'branch',
    schema: 'botzilla',
    timestamps: false
});

module.exports = Branch; 