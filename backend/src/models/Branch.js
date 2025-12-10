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
    // attic_branch_id es opcional y solo existe en algunos entornos
    // Se define aquí pero puede no existir en la BD de producción
    attic_branch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        unique: true,
        comment: 'Branch ID in Attic MS SQL DB (dim_attic_branch.branch_id) for New Performance System - OPCIONAL'
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
    timestamps: false,
    // Excluir attic_branch_id por defecto (campo opcional que puede no existir en producción)
    defaultScope: {
        attributes: {
            exclude: ['attic_branch_id'] // Excluir por defecto, se puede incluir explícitamente si existe
        }
    }
});

module.exports = Branch; 