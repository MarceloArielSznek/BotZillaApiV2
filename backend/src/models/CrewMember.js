'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const CrewMember = sequelize.define('CrewMember', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        validate: {
            notEmpty: true,
            len: [2, 100]
        }
    },
    phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        validate: {
            is: /^\+?[\d\s\-\(\)]+$/
        }
    },
    telegram_id: {
        type: DataTypes.STRING(50),
        allowNull: true,
        validate: {
            is: /^@?[a-zA-Z0-9_]+$/
        }
    },
    is_leader: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: false
    }
}, {
    tableName: 'crew_member',
    schema: 'botzilla',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['phone'],
            where: {
                phone: {
                    [require('sequelize').Op.ne]: null
                }
            }
        },
        {
            unique: true,
            fields: ['telegram_id'],
            where: {
                telegram_id: {
                    [require('sequelize').Op.ne]: null
                }
            }
        }
    ]
});

module.exports = CrewMember; 