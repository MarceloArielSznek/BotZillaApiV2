'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Branch = sequelize.define('Branch', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    },
    telegram_group_id: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT
    },
    attic_tech_branch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: 'Branch ID in Attic Tech API (for syncing data)'
    },
    branch_configuration_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'branch_configuration',
            key: 'id'
        },
        comment: 'FK to branch_configuration table'
    }
}, {
    sequelize,
    tableName: 'branch',
    schema: 'botzilla',
    timestamps: false
});

module.exports = Branch; 