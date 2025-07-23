'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserBranch = sequelize.define('UserBranch', {
    user_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'user',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    },
    branch_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        references: {
            model: 'branch',
            key: 'id'
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE'
    }
}, {
    tableName: 'user_branch',
    schema: 'botzilla',
    timestamps: false
});

module.exports = UserBranch; 