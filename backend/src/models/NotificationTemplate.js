'use strict';
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class NotificationTemplate extends Model {}

NotificationTemplate.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        unique: true
    },
    notification_type_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'notification_type',
            key: 'id'
        }
    },
    level: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    template_text: {
        type: DataTypes.TEXT,
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'NotificationTemplate',
    tableName: 'notification_templates',
    schema: 'botzilla',
    timestamps: false
});

module.exports = NotificationTemplate; 