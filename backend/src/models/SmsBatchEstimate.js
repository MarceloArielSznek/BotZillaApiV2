'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SmsBatchEstimate = sequelize.define('SmsBatchEstimate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    batch_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'sms_batch',
            key: 'id'
        },
        comment: 'ID del batch'
    },
    estimate_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'estimate',
            key: 'id'
        },
        comment: 'ID del estimate'
    },
    status: {
        type: DataTypes.STRING(50),
        defaultValue: 'pending',
        allowNull: false,
        comment: 'pending, sent, failed, skipped'
    },
    sent_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Fecha en que se envió el mensaje'
    },
    error_message: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Mensaje de error si falló el envío'
    }
}, {
    sequelize,
    modelName: 'SmsBatchEstimate',
    tableName: 'sms_batch_estimate',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'added_at',
    updatedAt: false
});

module.exports = SmsBatchEstimate;

