'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserRol = sequelize.define('UserRol', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true
    }
}, {
    tableName: 'user_rol',
    schema: 'botzilla',
    timestamps: false
});

module.exports = UserRol; 