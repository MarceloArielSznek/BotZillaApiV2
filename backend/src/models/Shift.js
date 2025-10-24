const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Shift extends Model {}

Shift.init({
  crew_member_id: {
    type: DataTypes.INTEGER,
    allowNull: false, // NOT NULL - es parte de la PK
    primaryKey: true,
    references: {
      model: 'employee', // Ahora apunta a employee en lugar de crew_member
      key: 'id'
    },
    comment: 'ID del empleado (PK compuesta). Apunta a employee.id para soportar Performance shifts'
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
  employee_id: {
    type: DataTypes.INTEGER,
    allowNull: true, // Nullable - usado para shifts de Performance
    references: {
      model: 'employee',
      key: 'id'
    },
    comment: 'ID del empleado (usado para referencia adicional en shifts de Performance)'
  },
  hours: {
    type: DataTypes.DECIMAL(10, 2),
    allowNull: false
  },
  approved_shift: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica si el shift ha sido aprobado manualmente por un usuario'
  },
  performance_status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'approved',
    validate: {
      isIn: {
        args: [['pending_approval', 'approved', 'rejected']],
        msg: 'performance_status must be pending_approval, approved, or rejected'
      }
    },
    comment: 'Estado de aprobación: pending_approval (esperando), approved (aprobado), rejected (rechazado)'
  }
}, {
  sequelize,
  modelName: 'Shift',
  tableName: 'shift',
  schema: 'botzilla',
  timestamps: false
});

module.exports = Shift; 