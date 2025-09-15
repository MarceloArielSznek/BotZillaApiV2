import { api } from '../config/api';

// Interfaces para el servicio
export interface EmployeeRegistrationData {
  firstName: string;
  lastName: string;
  nickname?: string;
  email: string;
  phoneNumber: string;
  telegramId: string;
}

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
      
      if (!employeeData.email?.trim()) {
        throw new Error('Email is required');
      }
      
      if (!employeeData.phoneNumber?.trim()) {
        throw new Error('Phone number is required');
      }
      
      if (!employeeData.telegramId?.trim()) {
        throw new Error('Telegram ID is required');
      }

      // Limpiar datos antes del envío
      const cleanData = {
        firstName: employeeData.firstName.trim(),
        lastName: employeeData.lastName.trim(),
        nickname: employeeData.nickname?.trim() || '',
        email: employeeData.email.trim().toLowerCase(),
        phoneNumber: employeeData.phoneNumber.trim(),
        telegramId: employeeData.telegramId?.trim() || ''
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
   * Formatear nombre para display
   */
  formatFullName: (firstName: string, lastName: string, nickname?: string): string => {
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    return nickname?.trim() ? `${fullName} (${nickname.trim()})` : fullName;
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
      data.email?.trim() &&
      data.phoneNumber?.trim() &&
      data.telegramId?.trim()
    );
  },

  /**
   * Obtener progreso del formulario (porcentaje)
   */
  getFormProgress: (data: EmployeeRegistrationData): number => {
    const requiredFields = ['firstName', 'lastName', 'email', 'phoneNumber', 'telegramId'];
    const optionalFields = ['nickname'];
    
    let filledRequired = 0;
    let filledOptional = 0;
    
    requiredFields.forEach(field => {
      if (data[field as keyof EmployeeRegistrationData]?.trim()) {
        filledRequired++;
      }
    });
    
    optionalFields.forEach(field => {
      if (data[field as keyof EmployeeRegistrationData]?.trim()) {
        filledOptional++;
      }
    });
    
    // 80% por campos requeridos, 20% por opcionales
    const requiredProgress = (filledRequired / requiredFields.length) * 80;
    const optionalProgress = (filledOptional / optionalFields.length) * 20;
    
    return Math.round(requiredProgress + optionalProgress);
  }
};

export default employeeRegistrationService;
