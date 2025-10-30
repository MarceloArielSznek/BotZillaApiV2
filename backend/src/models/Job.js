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
    type: DataTypes.DATE,
    comment: 'Fecha de cierre del job (puede venir de Performance spreadsheet)'
  },
  sold_price: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Precio final cobrado al cliente (obtenido de Performance spreadsheet)'
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
    allowNull: true,
    references: {
      model: 'employee', // Cambiado de 'crew_member' a 'employee' para permitir asignaciones a empleados pendientes
      key: 'id'
    },
    comment: 'References employee.id (not crew_member.id). Allows jobs to be assigned to pending employees.'
  },
  branch_id: {
    type: DataTypes.INTEGER,
    references: {
      model: 'branch',
      key: 'id'
    }
  },
  review: {
    type: DataTypes.INTEGER
  },
  attic_tech_hours: {
    type: DataTypes.DECIMAL(10, 2)
  },
  cl_estimated_plan_hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: true,
    comment: 'Crew Leader Estimated Plan Hours from spreadsheet (will come from future job sync)'
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
  },
  performance_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'synced',
    validate: {
      isIn: {
        args: [['synced', 'pending_approval', 'approved']],
        msg: 'performance_status must be synced, pending_approval, or approved'
      }
    },
    comment: 'Estado de aprobación de Performance: synced (normal), pending_approval (esperando), approved (aprobado)'
  },
  overrun_report_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'overrun_report',
      key: 'id'
    },
    comment: 'Foreign key to overrun_report table (nullable)'
  },
  operation_post_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'operation_command_post',
      key: 'id'
    },
    comment: 'Foreign key to operation_command_post table (nullable)'
  },
  in_payload: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indicates if job is in PayLoad external system. User can toggle this manually.'
  },
  registration_alert_sent: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indicates if a Make.com registration alert has been sent for this job. Prevents spam. Reset when CL changes or completes registration.'
  }
}, {
  sequelize,
  modelName: 'Job',
  tableName: 'job',
  schema: 'botzilla',
  timestamps: false
});

module.exports = Job; 