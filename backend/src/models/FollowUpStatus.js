'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FollowUpStatus = sequelize.define('FollowUpStatus', {
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
        type: DataTypes.STRING(7), // Hex color: #FF0000
        allowNull: true
    }
}, {
    sequelize,
    modelName: 'FollowUpStatus',
    tableName: 'follow_up_status',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FollowUpStatus;

