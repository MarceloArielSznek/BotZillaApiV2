const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PaymentMethod = sequelize.define('PaymentMethod', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(50),
        allowNull: false,
        unique: true,
        comment: 'Nombre del método de pago (credit, cash, financing, etc.)'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW
    }
}, {
    tableName: 'payment_method',
    schema: 'botzilla',
    timestamps: false,
    indexes: [
        {
            unique: true,
            fields: ['name']
        }
    ]
});

module.exports = PaymentMethod;

