'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FollowUpLabel = sequelize.define('FollowUpLabel', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    color: {
        type: DataTypes.STRING(7), // Hex color: #3B82F6
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'FollowUpLabel',
    tableName: 'follow_up_label',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FollowUpLabel;

