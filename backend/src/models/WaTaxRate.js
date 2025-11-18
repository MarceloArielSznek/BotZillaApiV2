'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const WaTaxRate = sequelize.define('WaTaxRate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    zip_code: {
        type: DataTypes.STRING(10),
        allowNull: false,
        unique: true
    },
    city_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    county_name: {
        type: DataTypes.STRING(100),
        allowNull: true
    },
    city_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'City tax rate (ejemplo: 0.037 para 3.7%)'
    },
    state_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        defaultValue: 0.065,
        comment: 'State tax rate de WA (6.5% fijo)'
    },
    total_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: false,
        comment: 'Total tax rate (state + city)'
    },
    effective_date: {
        type: DataTypes.DATEONLY,
        allowNull: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    sequelize,
    modelName: 'WaTaxRate',
    tableName: 'wa_tax_rates',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = WaTaxRate;

