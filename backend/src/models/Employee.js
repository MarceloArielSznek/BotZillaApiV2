const { Model, DataTypes } = require('sequelize');
const sequelize = require('../config/database');

class Employee extends Model {
  /**
   * Método para obtener el nombre completo del empleado
   */
  getFullName() {
    if (this.nickname) {
      return `${this.first_name} "${this.nickname}" ${this.last_name}`;
    }
    return `${this.first_name} ${this.last_name}`;
  }

  /**
   * Método para verificar si el empleado está activo
   */
  isActive() {
    return this.status === 'active';
  }

  /**
   * Método para obtener información resumida del empleado
   */
  getSummary() {
    return {
      id: this.id,
      fullName: this.getFullName(),
      email: this.email,
      phoneNumber: this.phone_number,
      status: this.status,
      registrationDate: this.registration_date,
      isActive: this.isActive()
    };
  }
}

Employee.init({
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true,
    allowNull: false
  },
  first_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'First name cannot be empty'
      },
      len: {
        args: [2, 50],
        msg: 'First name must be between 2 and 50 characters'
      },
      is: {
        args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/,
        msg: 'First name can only contain letters, spaces, hyphens and apostrophes'
      }
    }
  },
  last_name: {
    type: DataTypes.STRING(50),
    allowNull: false,
    validate: {
      notEmpty: {
        msg: 'Last name cannot be empty'
      },
      len: {
        args: [1, 50],
        msg: 'Last name must be between 1 and 50 characters'
      },
      is: {
        args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'\-0-9.]+$/,
        msg: 'Last name can only contain letters, numbers, spaces, hyphens, apostrophes and periods'
      }
    }
  },
  nickname: {
    type: DataTypes.STRING(30),
    allowNull: true,
    validate: {
      len: {
        args: [0, 30],
        msg: 'Nickname cannot exceed 30 characters'
      },
      is: {
        args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]*$/,
        msg: 'Nickname can only contain letters, spaces, hyphens and apostrophes'
      }
    }
  },
  email: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: {
      name: 'unique_employee_email',
      msg: 'Email address is already registered'
    },
    validate: {
      notEmpty: {
        msg: 'Email cannot be empty'
      },
      isEmail: {
        msg: 'Please provide a valid email address'
      },
      len: {
        args: [5, 100],
        msg: 'Email must be between 5 and 100 characters'
      }
    }
  },
  phone_number: {
    type: DataTypes.STRING(20),
    allowNull: true, // Nullable para pending employees
    validate: {
      len: {
        args: [10, 20],
        msg: 'Phone number must be between 10 and 20 characters'
      },
      is: {
        args: /^[\+]?[1-9][\d\s\-\(\)]{9,19}$/,
        msg: 'Please provide a valid phone number'
      }
    }
  },
  telegram_id: {
    type: DataTypes.STRING(20),
    allowNull: true, // Nullable para pending employees
    unique: {
      name: 'unique_employee_telegram_id',
      msg: 'Telegram ID is already registered'
    },
    validate: {
      len: {
        args: [5, 20],
        msg: 'Telegram ID must be between 5 and 20 characters'
      },
      isNumeric: {
        msg: 'Telegram ID must contain only numbers'
      }
    }
  },
  street: {
    type: DataTypes.STRING(200),
    allowNull: true, // Nullable para pending employees
    validate: {
      len: {
        args: [5, 200],
        msg: 'Street address must be between 5 and 200 characters'
      }
    }
  },
  city: {
    type: DataTypes.STRING(100),
    allowNull: true, // Nullable para pending employees
    validate: {
      len: {
        args: [2, 100],
        msg: 'City must be between 2 and 100 characters'
      },
      is: {
        args: /^[a-zA-ZÀ-ÿ\u00f1\u00d1\s'-]+$/,
        msg: 'City can only contain letters, spaces, hyphens and apostrophes'
      }
    }
  },
  state: {
    type: DataTypes.STRING(50),
    allowNull: true, // Nullable para pending employees
    validate: {
      len: {
        args: [2, 50],
        msg: 'State must be between 2 and 50 characters'
      }
    }
  },
  zip: {
    type: DataTypes.STRING(20),
    allowNull: true, // Nullable para pending employees
    validate: {
      len: {
        args: [3, 20],
        msg: 'Zip code must be between 3 and 20 characters'
      },
      is: {
        args: /^[0-9A-Za-z\s-]+$/,
        msg: 'Zip code can only contain letters, numbers, spaces and hyphens'
      }
    }
  },
  date_of_birth: {
    type: DataTypes.DATEONLY,
    allowNull: true, // Nullable para pending employees
    validate: {
      isDate: {
        msg: 'Please provide a valid date of birth'
      },
      isBefore: {
        args: new Date().toISOString().split('T')[0],
        msg: 'Date of birth must be in the past'
      },
      isAdult(value) {
        if (!value) return; // Skip validation if null (pending employee)
        
        const today = new Date();
        const birthDate = new Date(value);
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
          age--;
        }
        
        if (age < 16) {
          throw new Error('Employee must be at least 16 years old');
        }
      }
    }
  },
  branch_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'branch',
      key: 'id'
    }
  },
  role: {
    type: DataTypes.ENUM('crew_member', 'crew_leader', 'salesperson', 'corporate'),
    allowNull: false,
    validate: {
      isIn: {
        args: [['crew_member', 'crew_leader', 'salesperson', 'corporate']],
        msg: 'Role must be one of: crew_member, crew_leader, salesperson, corporate'
      }
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'active', 'inactive', 'rejected'),
    allowNull: false,
    defaultValue: 'pending',
    validate: {
      isIn: {
        args: [['pending', 'active', 'inactive', 'rejected']],
        msg: 'Status must be one of: pending, active, inactive, rejected'
      }
    }
  },
  registration_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  approved_date: {
    type: DataTypes.DATE,
    allowNull: true
  },
  approved_by: {
    type: DataTypes.INTEGER,
    allowNull: true,
    references: {
      model: 'user',
      key: 'id'
    },
    comment: 'ID del usuario que aprobó al empleado'
  },
  notes: {
    type: DataTypes.TEXT,
    allowNull: true,
    comment: 'Notas adicionales sobre el empleado'
  },
  employee_code: {
    type: DataTypes.STRING(20),
    allowNull: true,
    unique: {
      name: 'unique_employee_code',
      msg: 'Employee code is already in use'
    },
    comment: 'Código único del empleado para identificación interna'
  },
  attic_tech_user_id: {
    type: DataTypes.INTEGER,
    allowNull: true,
    unique: {
      name: 'unique_attic_tech_user_id',
      msg: 'Attic Tech User ID is already in use'
    },
    comment: 'ID del usuario en Attic Tech (para sincronización)',
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    comment: 'Indica si el empleado ha sido eliminado lógicamente'
  }
}, {
  sequelize,
  schema: 'botzilla',
  tableName: 'employee',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    {
      name: 'idx_employee_email',
      fields: ['email'],
      unique: true, // Unique index will still be created, but we'll manage uniqueness in hooks
      where: { is_deleted: false }
    },
    {
      name: 'idx_employee_telegram_id',
      fields: ['telegram_id'],
      unique: true, // Unique index will still be created, but we'll manage uniqueness in hooks
      where: { is_deleted: false, telegram_id: { [require('sequelize').Op.ne]: null } }
    },
    {
      name: 'idx_employee_status',
      fields: ['status']
    },
    {
      name: 'idx_employee_registration_date',
      fields: ['registration_date']
    },
    {
      name: 'idx_employee_full_name',
      fields: ['first_name', 'last_name']
    },
    {
      name: 'idx_employee_employee_code',
      fields: ['employee_code']
    }
  ],
  hooks: {
    beforeValidate: (employee, options) => {
      // Limpiar y normalizar datos antes de la validación
      if (employee.first_name) {
        employee.first_name = employee.first_name.trim();
      }
      if (employee.last_name) {
        employee.last_name = employee.last_name.trim();
      }
      if (employee.nickname) {
        employee.nickname = employee.nickname.trim() || null;
      }
      if (employee.email) {
        employee.email = employee.email.trim().toLowerCase();
      }
      if (employee.phone_number) {
        employee.phone_number = employee.phone_number.trim();
      }
      if (employee.telegram_id) {
        employee.telegram_id = employee.telegram_id.trim();
      }
    },
    beforeCreate: (employee, options) => {
      // Generar código de empleado si no se proporciona
      if (!employee.employee_code) {
        const timestamp = Date.now().toString().slice(-6);
        const initials = (employee.first_name.charAt(0) + employee.last_name.charAt(0)).toUpperCase();
        employee.employee_code = `EMP${initials}${timestamp}`;
      }
    }
  }
});

module.exports = Employee;
