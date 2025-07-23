'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EstimateStatus = sequelize.define('EstimateStatus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'estimate_status_model', // Cambio aquí para evitar colisión de nombres
    tableName: 'estimate_status',
    schema: 'botzilla',
    timestamps: false
});

module.exports = EstimateStatus; 