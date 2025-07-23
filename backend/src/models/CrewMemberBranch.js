'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CrewMemberBranch = sequelize.define('CrewMemberBranch', {
    crew_member_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'crew_member',
            key: 'id'
        }
    },
    branch_id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
            model: 'branch',
            key: 'id'
        }
    }
}, {
    tableName: 'crew_member_branch',
    schema: 'botzilla',
    timestamps: false
});

module.exports = CrewMemberBranch; 