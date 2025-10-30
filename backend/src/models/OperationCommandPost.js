'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OperationCommandPost = sequelize.define('OperationCommandPost', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    post: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Long text post with operation command celebration message'
    },
    created_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        allowNull: false,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    tableName: 'operation_command_post',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

module.exports = OperationCommandPost;

