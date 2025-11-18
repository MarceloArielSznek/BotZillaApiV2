'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const FollowUpTicket = sequelize.define('FollowUpTicket', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    estimate_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'estimate',
            key: 'id'
        }
    },
    followed_up: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        allowNull: false
    },
    status_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'follow_up_status',
            key: 'id'
        }
    },
    label_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'follow_up_label',
            key: 'id'
        }
    },
    chat_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'chat',
            key: 'id'
        }
    },
    notes: {
        type: DataTypes.TEXT,
        allowNull: true,
        comment: 'Notas internas del equipo (no visibles para el cliente)'
    },
    assigned_to: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'users',
            key: 'id'
        }
    },
    follow_up_date: {
        type: DataTypes.DATEONLY,
        allowNull: true,
        comment: 'Fecha programada para follow-up'
    },
    last_contact_date: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Última vez que se contactó al cliente'
    }
}, {
    sequelize,
    modelName: 'FollowUpTicket',
    tableName: 'follow_up_ticket',
    schema: 'botzilla',
    timestamps: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = FollowUpTicket;

