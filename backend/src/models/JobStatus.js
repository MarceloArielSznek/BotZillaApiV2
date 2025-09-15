const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class JobStatus extends Model {}

JobStatus.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true
  }
}, {
  sequelize,
  modelName: 'JobStatus',
  tableName: 'job_status',
  schema: 'botzilla',
  timestamps: false
});

module.exports = JobStatus;
