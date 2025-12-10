const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class DailyShift extends Model {}

DailyShift.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  job_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'job',
      key: 'id'
    }
  },
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    references: {
      model: 'employee',
      key: 'id'
    }
  },
  shift_date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    comment: 'Date of the shift (report_date from Attic)'
  },
  regular_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  overtime_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  double_overtime_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    defaultValue: 0.00
  },
  total_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  clocked_in_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  clocked_out_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  job_gk: {
    type: DataTypes.BIGINT,
    allowNull: true,
    comment: 'Foreign key to Attic dim_jobsite.job_gk'
  },
  attic_branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Branch ID from Attic DB'
  },
  synced_from_attic: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: true,
    comment: 'Indicates if shift was imported from Attic DB'
  },
  approved: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'DailyShift',
  tableName: 'daily_shift',
  schema: 'botzilla',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      unique: true,
      fields: ['job_id', 'employee_id', 'shift_date'],
      name: 'unique_daily_shift'
    }
  ]
});

module.exports = DailyShift;

