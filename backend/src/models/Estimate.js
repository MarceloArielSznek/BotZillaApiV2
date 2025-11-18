'use strict';

const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');
const SalesPerson = require('./SalesPerson');
const Branch = require('./Branch');
const EstimateStatus = require('./EstimateStatus');
const PaymentMethod = require('./PaymentMethod');

const Estimate = sequelize.define('Estimate', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    attic_tech_estimate_id: {
        type: DataTypes.INTEGER,
        unique: true,
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    customer_name: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    customer_address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    customer_email: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    customer_phone: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    crew_notes: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    sales_person_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'sales_person',
            key: 'id'
        }
    },
    status_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'estimate_status',
            key: 'id'
        }
    },
    branch_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'branch',
            key: 'id'
        }
    },
    price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    retail_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    final_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    sub_service_retail_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    discount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    attic_tech_hours: {
        type: DataTypes.DECIMAL(10, 2)
    },
    payment_method_id: {
        type: DataTypes.INTEGER,
        allowNull: true,
        references: {
            model: 'payment_method',
            key: 'id'
        }
    },
    city_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true
    },
    state_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true
    },
    total_tax_rate: {
        type: DataTypes.DECIMAL(5, 4),
        allowNull: true
    },
    city_tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    state_tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    total_tax_amount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    price_before_taxes: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    price_after_taxes: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    snapshot_multiplier_ranges: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Snapshot de multiplier ranges vigentes cuando se creó el estimate'
    },
    at_created_date: {
        type: DataTypes.DATE,
        field: 'at_created_date'
    },
    at_updated_date: {
        type: DataTypes.DATE,
        field: 'at_updated_date'
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'created_at'
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: DataTypes.NOW,
        field: 'updated_at'
    }
}, {
    sequelize,
    modelName: 'Estimate',
    tableName: 'estimate',
    schema: 'botzilla',
    timestamps: true, // Habilitamos los timestamps de Sequelize
    createdAt: 'created_at', // Mapeamos al nombre de columna que prefiramos
    updatedAt: 'updated_at'
});

// Definir las asociaciones
Estimate.belongsTo(SalesPerson, { as: 'SalesPerson', foreignKey: 'sales_person_id' });
Estimate.belongsTo(Branch, { as: 'Branch', foreignKey: 'branch_id' });
Estimate.belongsTo(EstimateStatus, { as: 'EstimateStatus', foreignKey: 'status_id' });
Estimate.belongsTo(PaymentMethod, { as: 'PaymentMethod', foreignKey: 'payment_method_id' });

module.exports = Estimate; 