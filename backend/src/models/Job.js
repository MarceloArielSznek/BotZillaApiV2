const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Job extends Model {}

Job.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  closing_date: {
    type: DataTypes.DATE
  },
  estimate_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'estimate',
      key: 'id'
    }
  },
  crew_leader_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'crew_member',
      key: 'id'
    }
  },
  branch_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'branch',
      key: 'id'
    }
  },
  note: {
    type: DataTypes.TEXT
  },
  review: {
    type: DataTypes.INTEGER
  },
  attic_tech_hours: {
    type: DataTypes.DECIMAL(10, 2)
  },
  crew_leader_hours: {
    type: DataTypes.DECIMAL(10, 2)
  },
  cl_estimated_plan_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Crew Leader Estimated Plan Hours from spreadsheet'
  },
  notification_sent: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false
  },
  status_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'job_status',
      key: 'id'
    },
    allowNull: true
  },
  // Campos para sincronización con Attic Tech
  attic_tech_job_id: {
    type: DataTypes.INTEGER,
    unique: true,
    allowNull: true
  },
  attic_tech_estimate_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'ID del estimate en Attic Tech'
  },
  last_known_status_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'job_status',
      key: 'id'
    },
    allowNull: true,
    comment: 'Estado anterior del job para detectar cambios'
  },
  last_synced_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  last_notification_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  sequelize,
  modelName: 'Job',
  tableName: 'job',
  schema: 'botzilla',
  timestamps: false
});

module.exports = Job; 