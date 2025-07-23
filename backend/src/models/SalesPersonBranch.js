'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const SalesPersonBranch = sequelize.define('SalesPersonBranch', {
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
    branch_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branch',
            key: 'id'
        }
    }
}, {
    tableName: 'sales_person_branch',
    schema: 'botzilla',
    timestamps: false
});

module.exports = SalesPersonBranch; 