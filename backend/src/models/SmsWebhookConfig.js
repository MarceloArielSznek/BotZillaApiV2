'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SmsWebhookConfig = sequelize.define('SmsWebhookConfig', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(255),
        allowNull: false
    },
    provider: {
        type: DataTypes.STRING(50),
        allowNull: false,
        comment: 'Provider: make_com, quo, etc.'
    },
    webhook_url: {
        type: DataTypes.STRING(500),
        allowNull: false
    },
    api_key: {
        type: DataTypes.STRING(255),
        allowNull: true
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {}
    }
}, {
    sequelize,
    modelName: 'SmsWebhookConfig',
    tableName: 'sms_webhook_config',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = SmsWebhookConfig;

