const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class SheetColumnMap extends Model {}

SheetColumnMap.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  sheet_name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  field_name: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  column_index: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  type: {
    type: DataTypes.TEXT,
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'SheetColumnMap',
  tableName: 'sheet_column_map',
  schema: 'botzilla',
  timestamps: false, // No 'createdAt' or 'updatedAt' fields
  indexes: [
    {
      unique: true,
      fields: ['sheet_name', 'field_name']
    }
  ]
});

module.exports = SheetColumnMap; 