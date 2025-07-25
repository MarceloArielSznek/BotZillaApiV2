const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class SpecialShift extends Model {}

SpecialShift.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  }
}, {
  sequelize,
  modelName: 'SpecialShift',
  tableName: 'special_shift',
  schema: 'botzilla',
  timestamps: false
});

module.exports = SpecialShift; 