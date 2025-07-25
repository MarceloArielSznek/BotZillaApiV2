const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Shift extends Model {}

Shift.init({
  crew_member_id: {
    type: DataTypes.INTEGER,
    allowNull: false,
    primaryKey: true,
    references: {
      model: 'crew_member',
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
  hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  }
}, {
  sequelize,
  modelName: 'Shift',
  tableName: 'shift',
  schema: 'botzilla',
  timestamps: false
});

module.exports = Shift; 