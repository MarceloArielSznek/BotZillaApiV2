'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmployeeTelegramGroup = sequelize.define('EmployeeTelegramGroup', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    employee_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'employee',
            key: 'id'
        }
    },
    telegram_group_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'telegram_group',
            key: 'id'
        }
    },
    status_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'group_membership_status',
            key: 'id'
        }
    },
    joined_at: {
        type: DataTypes.DATE
    },
    blocked_at: {
        type: DataTypes.DATE
    }
}, {
    sequelize,
    tableName: 'employee_telegram_group',
    schema: 'botzilla',
    timestamps: false
});

module.exports = EmployeeTelegramGroup;
