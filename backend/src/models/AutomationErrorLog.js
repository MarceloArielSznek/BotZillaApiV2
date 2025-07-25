const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class AutomationErrorLog extends Model {}

AutomationErrorLog.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  sheet_name: {
    type: DataTypes.STRING,
    allowNull: false
  },
  row_number: {
    type: DataTypes.INTEGER,
    allowNull: false
  },
  error_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  raw_data: {
    type: DataTypes.JSONB,
    allowNull: true
  },
  status: {
    type: DataTypes.STRING,
    defaultValue: 'pending', // pending, resolved, ignored
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'AutomationErrorLog',
  tableName: 'automation_error_log',
  schema: 'botzilla',
  timestamps: true, // Use default createdAt/updatedAt
  updatedAt: 'updated_at',
  createdAt: 'created_at'
});

module.exports = AutomationErrorLog; 