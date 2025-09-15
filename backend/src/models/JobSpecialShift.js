const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class JobSpecialShift extends Model {}

JobSpecialShift.init({
  special_shift_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'special_shift',
      key: 'id'
    }
  },
  job_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'job',
      key: 'id'
    }
  },
  date: {
    type: DataTypes.DATE,
    allowNull: false
  },
  hours: {
    type: DataTypes.DECIMAL(10, 2)
  },
  approved_shift: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica si el special shift ha sido aprobado manualmente por un usuario'
  }
}, {
  sequelize,
  modelName: 'JobSpecialShift',
  tableName: 'job_special_shift',
  schema: 'botzilla',
  timestamps: false
});

module.exports = JobSpecialShift; 