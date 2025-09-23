'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const TelegramGroup = sequelize.define('TelegramGroup', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false
    },
    branch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'branch',
            key: 'id'
        }
    },
    telegram_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT
    },
    category_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'telegram_group_category',
            key: 'id'
        }
    },
    is_default: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    sequelize,
    tableName: 'telegram_group',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = TelegramGroup;
