'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SmsBatch = sequelize.define('SmsBatch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false,
        comment: 'Nombre del batch (ej: "Orange County - Dec 2025")'
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Descripción opcional del batch'
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'user',
            key: 'id'
        },
        comment: 'Usuario que creó el batch'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'draft',
        allowNull: false,
        comment: 'draft, ready, sent, cancelled'
    },
    total_estimates: {
        type: DataTypes.INTEGER,
        defaultValue: 0,
        allowNull: false,
        comment: 'Total de estimates en el batch (calculado automáticamente)'
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'JSON con filtros aplicados: {priceRange, dateRange, branch, salesperson, etc}'
    }
}, {
    sequelize,
    modelName: 'SmsBatch',
    tableName: 'sms_batch',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = SmsBatch;

