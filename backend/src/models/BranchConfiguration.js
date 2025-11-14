const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class BranchConfiguration extends Model {}

BranchConfiguration.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    at_config_id: {
        type: DataTypes.INTEGER,
        unique: true,
        allowNull: false,
        comment: 'Configuration ID in Attic Tech API'
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Configuration name (e.g., "LA Configuration")'
    },
    
    // Base Constants
    base_hourly_rate: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    average_work_day_hours: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    waste_factor: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: true
    },
    credit_card_fee: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: true
    },
    gas_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    truck_average_mpg: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    labor_hours_load_unload: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    sub_multiplier: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: true
    },
    cash_factor: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: true
    },
    max_discount: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    address: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    min_retail_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    b2b_max_discount: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    quality_control_visit_price: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true
    },
    bonus_pool_percentage: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: true
    },
    bonus_payout_cutoff: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    leaderboard_color_percentage: {
        type: DataTypes.DECIMAL(5, 2),
        allowNull: true
    },
    max_open_estimates: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    
    // Finance Factors (JSONB)
    finance_factors: {
        type: DataTypes.JSONB,
        allowNull: true,
        comment: 'Finance factors by month: {"3": 1.5, "6": 1.25, "12": 1.15}'
    },
    
    // Timestamps from Attic Tech
    at_created_at: {
        type: DataTypes.DATE,
        allowNull: true
    },
    at_updated_at: {
        type: DataTypes.DATE,
        allowNull: true
    }
}, {
    sequelize,
    tableName: 'branch_configuration',
    schema: 'botzilla',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = BranchConfiguration;

