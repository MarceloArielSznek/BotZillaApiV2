'use strict';
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class NotificationType extends Model {}

NotificationType.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    }
}, {
    sequelize,
    modelName: 'NotificationType',
    tableName: 'notification_type',
    schema: 'botzilla',
    timestamps: false
});

module.exports = NotificationType; 