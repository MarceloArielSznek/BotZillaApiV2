const { DataTypes, Model } = require('sequelize');
const sequelize = require('../config/database');

class MultiplierRange extends Model {}

MultiplierRange.init({
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true
    },
    name: {
        type: DataTypes.STRING(100),
        allowNull: false,
        comment: 'Range name (e.g., "LOW $0-$1700")'
    },
    min_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
        comment: 'Minimum cost for this range'
    },
    max_cost: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment: 'Maximum cost for this range (null = no limit)'
    },
    lowest_multiple: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: false,
        comment: 'Lowest multiplier for this range'
    },
    highest_multiple: {
        type: DataTypes.DECIMAL(5, 3),
        allowNull: false,
        comment: 'Highest multiplier for this range'
    },
    at_multiplier_id: {
        type: DataTypes.INTEGER,
        unique: true,
        allowNull: false,
        field: 'at_multiplier_range_id', // Mapear al nombre real de la columna en BD
        comment: 'Multiplier range ID in Attic Tech API (unique identifier)'
    },
    at_created_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Created date in Attic Tech'
    },
    at_updated_at: {
        type: DataTypes.DATE,
        allowNull: true,
        comment: 'Updated date in Attic Tech'
    }
}, {
    sequelize,
    tableName: 'multiplier_range',
    schema: 'botzilla',
    timestamps: true,
    underscored: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at'
});

module.exports = MultiplierRange;

