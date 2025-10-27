'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OverrunReport = sequelize.define('OverrunReport', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false
    },
    report: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Long text report with investigation details'
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
    tableName: 'overrun_report',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    underscored: true
});

module.exports = OverrunReport;

