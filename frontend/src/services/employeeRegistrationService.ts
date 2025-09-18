import { api } from '../config/api';

// Interfaces para el servicio
export interface EmployeeRegistrationData {
  firstName: string;
  lastName: string;
  street: string;
  city: string;
  state: string;
  zip: string;
  dateOfBirth: string;
  email: string;
  phoneNumber: string;
  telegramId: string;
  branch: string;
  role: 'crew_member' | 'crew_leader' | 'salesperson' | '';
}

// Fixed list of available branches
export const AVAILABLE_BRANCHES = [
  'San Diego',
  'Orange County', 
  'San Bernardino',
  'Los Angeles',
  'Everett (North Seattle)',
  'Kent (South Seattle)'
] as const;

export type BranchType = typeof AVAILABLE_BRANCHES[number];

export interface RegistrationResponse {
  success: boolean;
  message: string;
  data?: {
    registrationId: string;
    fullName: string;
    email: string;
    status: string;
    submittedAt: string;
  };
  error?: string;
}

export interface RegistrationStats {
  totalRegistrations: number;
  pendingReview: number;
  approved: number;
  rejected: number;
  lastRegistration: string | null;
  registrationsThisWeek: number;
  registrationsThisMonth: number;
}

export interface StatsResponse {
  success: boolean;
  data: RegistrationStats;
  error?: string;
}

export interface TelegramValidationResponse {
  success: boolean;
  data?: {
    telegramId: string;
    isValid: boolean;
    message: string;
  };
  error?: string;
}

// Servicio para manejo de registro de empleados
const employeeRegistrationService = {
  
  /**
   * Registrar un nuevo empleado
   * POST /api/employee-registration/register
   */
  registerEmployee: async (employeeData: EmployeeRegistrationData): Promise<RegistrationResponse> => {
    try {
      // Validaciones básicas en el frontend
      if (!employeeData.firstName?.trim()) {
        throw new Error('First name is required');
      }
      
      if (!employeeData.lastName?.trim()) {
        throw new Error('Last name is required');
      }
      
      if (!employeeData.street?.trim()) {
        throw new Error('Street address is required');
      }
      
      if (!employeeData.city?.trim()) {
        throw new Error('City is required');
      }
      
      if (!employeeData.state?.trim()) {
        throw new Error('State is required');
      }
      
      if (!employeeData.zip?.trim()) {
        throw new Error('Zip code is required');
      }
      
      if (!employeeData.dateOfBirth?.trim()) {
        throw new Error('Date of birth is required');
      }
      
      if (!employeeData.email?.trim()) {
        throw new Error('Email is required');
      }
      
      if (!employeeData.phoneNumber?.trim()) {
        throw new Error('Phone number is required');
      }
      
      if (!employeeData.telegramId?.trim()) {
        throw new Error('Telegram ID is required');
      }
      
      if (!employeeData.branch) {
        throw new Error('Branch selection is required');
      }
      
      if (!employeeData.role) {
        throw new Error('Role selection is required');
      }

      // Limpiar datos antes del envío
      const cleanData = {
        firstName: employeeData.firstName.trim(),
        lastName: employeeData.lastName.trim(),
        street: employeeData.street.trim(),
        city: employeeData.city.trim(),
        state: employeeData.state.trim(),
        zip: employeeData.zip.trim(),
        dateOfBirth: employeeData.dateOfBirth.trim(),
        email: employeeData.email.trim().toLowerCase(),
        phoneNumber: employeeData.phoneNumber.trim(),
        telegramId: employeeData.telegramId?.trim() || '',
        branch: employeeData.branch,
        role: employeeData.role
      };

      console.log('Submitting employee registration:', {
        ...cleanData,
        telegramId: cleanData.telegramId ? '***' : '' // No loguear el ID completo por seguridad
      });

      const response = await api.post('/employee-registration/register', cleanData);

      console.log('Registration response received:', {
        success: response.data.success,
        registrationId: response.data.data?.registrationId
      });

      return response.data;

    } catch (error: any) {
      console.error('Employee registration error:', {
        message: error.response?.data?.message || error.message,
        status: error.response?.status,
        errors: error.response?.data?.errors
      });

      // Manejar errores de validación del backend
      if (error.response?.status === 400) {
        const backendMessage = error.response.data?.message || 'Invalid data provided';
        const validationErrors = error.response.data?.errors;
        
        if (validationErrors && validationErrors.length > 0) {
          const errorMessages = validationErrors.map((err: any) => err.message).join(', ');
          throw new Error(errorMessages);
        }
        
        throw new Error(backendMessage);
      }

      // Errores de red o servidor
      if (error.response?.status >= 500) {
        throw new Error('Server error. Please try again later.');
      }

      // Error genérico
      throw new Error(error.response?.data?.message || error.message || 'Registration failed');
    }
  },

  /**
   * Obtener estadísticas de registros (requiere autenticación)
   * GET /api/employee-registration/stats
   */
  getRegistrationStats: async (): Promise<StatsResponse> => {
    try {
      const response = await api.get('/employee-registration/stats');
      return response.data;
    } catch (error: any) {
      console.error('Error fetching registration stats:', error.response?.data || error.message);
      
      return {
        success: false,
        data: {
          totalRegistrations: 0,
          pendingReview: 0,
          approved: 0,
          rejected: 0,
          lastRegistration: null,
          registrationsThisWeek: 0,
          registrationsThisMonth: 0
        },
        error: error.response?.data?.message || 'Failed to fetch statistics'
      };
    }
  },

  /**
   * Validar formato de Telegram ID
   * POST /api/employee-registration/validate-telegram
   */
  validateTelegramId: async (telegramId: string): Promise<TelegramValidationResponse> => {
    try {
      if (!telegramId?.trim()) {
        return {
          success: false,
          error: 'Telegram ID is required'
        };
      }

      const response = await api.post('/employee-registration/validate-telegram', {
        telegramId: telegramId.trim()
      });

      return response.data;

    } catch (error: any) {
      console.error('Telegram validation error:', error.response?.data || error.message);
      
      return {
        success: false,
        error: error.response?.data?.message || 'Validation failed'
      };
    }
  },

  /**
   * Validar email en tiempo real (opcional)
   */
  validateEmail: (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  /**
   * Validar teléfono en tiempo real (opcional)
   */
  validatePhoneNumber: (phoneNumber: string): boolean => {
    // Remover espacios, guiones y paréntesis para validación
    const cleanPhone = phoneNumber.replace(/[\s\-\(\)]/g, '');
    const phoneRegex = /^[\+]?[1-9][\d]{9,19}$/;
    return phoneRegex.test(cleanPhone);
  },


  /**
   * Generar URL del bot de Telegram (configurable)
   */
  getTelegramBotUrl: (): string => {
    // URL del bot oficial de BotZilla con comando /id automático
    return 'https://t.me/BotzillaAP_bot';
  },

  /**
   * Verificar si el formulario está completo
   */
  isFormComplete: (data: EmployeeRegistrationData): boolean => {
    return !!(
      data.firstName?.trim() &&
      data.lastName?.trim() &&
      data.street?.trim() &&
      data.city?.trim() &&
      data.state?.trim() &&
      data.zip?.trim() &&
      data.dateOfBirth?.trim() &&
      data.email?.trim() &&
      data.phoneNumber?.trim() &&
      data.telegramId?.trim() &&
      data.branch &&
      data.role
    );
  },

  /**
   * Obtener progreso del formulario (porcentaje)
   */
  getFormProgress: (data: EmployeeRegistrationData): number => {
    const requiredFields = ['firstName', 'lastName', 'street', 'city', 'state', 'zip', 'dateOfBirth', 'email', 'phoneNumber', 'telegramId', 'branch', 'role'];
    
    let filledRequired = 0;
    
    requiredFields.forEach(field => {
      const value = data[field as keyof EmployeeRegistrationData];
      if (field === 'branch' || field === 'role') {
        if (value) filledRequired++;
      } else if (typeof value === 'string' && value.trim()) {
        filledRequired++;
      }
    });
    
    return Math.round((filledRequired / requiredFields.length) * 100);
  },


  /**
   * Formatear nombre completo
   */
  formatFullName: (firstName: string, lastName: string): string => {
    return `${firstName.trim()} ${lastName.trim()}`;
  },

  /**
   * Validar fecha de nacimiento (debe ser mayor de 16 años)
   */
  validateDateOfBirth: (dateOfBirth: string): boolean => {
    if (!dateOfBirth) return false;
    
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    
    if (birthDate >= today) return false;
    
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    const actualAge = monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate()) 
      ? age - 1 
      : age;
    
    return actualAge >= 16;
  }
};

export default employeeRegistrationService;
