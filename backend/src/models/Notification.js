'use strict';
const {
  Model, DataTypes
} = require('sequelize');
const sequelize = require('../config/database');

class Notification extends Model {
  static associate(models) {
    Notification.belongsTo(models.SalesPerson, {
      foreignKey: 'recipient_id',
      constraints: false, // This allows polymorphic association
      as: 'salesPersonRecipient'
    });
    // Link to NotificationType
    Notification.belongsTo(models.NotificationType, {
      foreignKey: 'notification_type_id',
      as: 'notificationType'
    });
  }
}
Notification.init({
  id: {
    allowNull: false,
    autoIncrement: true,
    primaryKey: true,
    type: DataTypes.INTEGER
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  recipient_type: {
    type: DataTypes.STRING,
    allowNull: false
  },
  recipient_id: {
    type: DataTypes.INTEGER
  },
  notification_type_id: { // Added field
    type: DataTypes.INTEGER,
    references: {
      model: 'notification_type',
      key: 'id'
    }
  },
  created_at: {
    allowNull: false,
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  sequelize,
  modelName: 'Notification',
  tableName: 'notification',
  schema: 'botzilla',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: false, 
});
module.exports = Notification; 