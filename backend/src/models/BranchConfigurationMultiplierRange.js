const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class BranchConfigurationMultiplierRange extends Model {}

BranchConfigurationMultiplierRange.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    branch_configuration_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'branch_configuration',
            key: 'id'
        },
        comment: 'FK to branch_configuration'
    },
    multiplier_range_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'multiplier_range',
            key: 'id'
        },
        comment: 'FK to multiplier_range'
    }
}, {
    sequelize,
    tableName: 'branch_configuration_multiplier_range',
    schema: 'botzilla',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: false
});

module.exports = BranchConfigurationMultiplierRange;

