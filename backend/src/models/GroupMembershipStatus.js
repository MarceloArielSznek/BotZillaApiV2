'use strict';
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const GroupMembershipStatus = sequelize.define('GroupMembershipStatus', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true
    }
}, {
    sequelize,
    tableName: 'group_membership_status',
    schema: 'botzilla',
    timestamps: false
});

module.exports = GroupMembershipStatus;
