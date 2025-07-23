'use strict';
const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class WarningReason extends Model {}

WarningReason.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    }
}, {
    sequelize,
    modelName: 'WarningReason',
    tableName: 'warning_reason',
    schema: 'botzilla',
    timestamps: false
});

module.exports = WarningReason; 