'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ChatMessage = sequelize.define('ChatMessage', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    chat_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'chat',
            key: 'id'
        }
    },
    sender_type: {
        type: DataTypes.ENUM('agent', 'customer', 'system'),
        allowNull: false
    },
    sender_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    message_text: {
        type: DataTypes.TEXT,
        allowNull: false
    },
    metadata: {
        type: DataTypes.JSONB,
        defaultValue: {},
        allowNull: true,
        comment: 'Datos adicionales: attachments, external IDs (WhatsApp, Telegram), read receipts, etc.'
    },
    sent_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    read_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'ChatMessage',
    tableName: 'chat_message',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: false // No necesitamos updated_at en mensajes
});

module.exports = ChatMessage;

