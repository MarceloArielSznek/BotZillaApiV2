'use strict';
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Warning extends Model {}

Warning.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    sales_person_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'sales_person',
            key: 'id'
        }
    },
    reason_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'warning_reason',
            key: 'id'
        }
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    sequelize,
    modelName: 'Warning',
    tableName: 'warning',
    schema: 'botzilla',
    timestamps: true, // Sequelize manejará created_at
    updatedAt: false // No necesitamos updatedAt para esta tabla
});

module.exports = Warning; 