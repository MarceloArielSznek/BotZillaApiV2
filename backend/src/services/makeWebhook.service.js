const axios = require('axios');
const { logger } = require('../utils/logger');

/**
 * Servicio para integración con Make.com
 * Maneja el envío de datos de empleados registrados a Make.com
 */
class MakeWebhookService {
    
    constructor() {
        // URL del webhook de Make.com desde variables de entorno
        this.webhookUrl = process.env.MAKE_WEBHOOK_URL;
        this.isEnabled = !!this.webhookUrl;
        
        if (!this.isEnabled) {
            logger.warn('Make.com webhook not configured. Set MAKE_WEBHOOK_URL environment variable to enable.');
        }
    }

    /**
     * Enviar datos de registro de empleado a Make.com
     * @param {Object} employeeData - Datos del empleado registrado
     * @returns {Promise<boolean>} - True si se envió correctamente
     */
    async sendEmployeeRegistration(employeeData) {
        if (!this.isEnabled) {
            logger.warn('Make.com webhook is disabled. Skipping webhook call.');
            return false;
        }

        try {
            // Preparar payload para Make.com
            const payload = {
                event: 'employee_registration',
                timestamp: new Date().toISOString(),
                data: {
                    // Información básica del empleado
                    employeeId: employeeData.id,
                    employeeCode: employeeData.employee_code,
                    registrationId: employeeData.employee_code, // Mismo que employeeCode
                    
                    // Información personal
                    firstName: employeeData.first_name,
                    lastName: employeeData.last_name,
                    street: employeeData.street,
                    city: employeeData.city,
                    state: employeeData.state,
                    zip: employeeData.zip,
                    fullAddress: `${employeeData.street}, ${employeeData.city}, ${employeeData.state} ${employeeData.zip}`,
                    dateOfBirth: employeeData.date_of_birth,
                    fullName: `${employeeData.first_name} ${employeeData.last_name}`,
                    
                    // Información de contacto
                    email: employeeData.email,
                    phoneNumber: employeeData.phone_number,
                    telegramId: employeeData.telegram_id,
                    
                    // Información laboral
                    branch: employeeData.branch,
                    role: employeeData.role,
                    
                    // Estado y fechas
                    status: employeeData.status,
                    registrationDate: employeeData.registration_date,
                    createdAt: employeeData.created_at,
                    updatedAt: employeeData.updated_at,
                    
                    // Notas adicionales
                    notes: employeeData.notes || '',
                    
                    // Metadata adicional para Make.com
                    source: 'botzilla_employee_registration',
                    environment: process.env.NODE_ENV || 'production'
                }
            };

            logger.info('Sending employee registration to Make.com:', {
                employeeId: employeeData.id,
                employeeCode: employeeData.employee_code,
                fullName: `${employeeData.first_name} ${employeeData.last_name}`,
                email: employeeData.email,
                branch: employeeData.branch,
                role: employeeData.role,
                webhookUrl: this.webhookUrl.substring(0, 50) + '...' // Solo mostrar parte de la URL por seguridad
            });

            // Configurar timeout y headers
            const config = {
                timeout: 10000, // 10 segundos timeout
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotZilla-API/1.0'
                }
            };

            // Enviar datos a Make.com
            const response = await axios.post(this.webhookUrl, payload, config);

            logger.info('Employee registration sent to Make.com successfully:', {
                employeeId: employeeData.id,
                employeeCode: employeeData.employee_code,
                responseStatus: response.status,
                responseData: response.data
            });

            return true;

        } catch (error) {
            // Log detallado del error pero sin interrumpir el registro
            logger.error('Failed to send employee registration to Make.com:', {
                employeeId: employeeData.id,
                employeeCode: employeeData.employee_code,
                error: error.message,
                stack: error.stack,
                webhookUrl: this.webhookUrl ? this.webhookUrl.substring(0, 50) + '...' : 'not set',
                responseStatus: error.response?.status,
                responseData: error.response?.data,
                timeout: error.code === 'ECONNABORTED' ? true : false
            });

            // No lanzar error para que no interrumpa el registro del empleado
            // El registro debe completarse exitosamente aunque falle el webhook
            return false;
        }
    }

    /**
     * Enviar actualización de estado de empleado a Make.com
     * @param {Object} employeeData - Datos del empleado actualizado
     * @param {string} previousStatus - Estado anterior
     * @returns {Promise<boolean>} - True si se envió correctamente
     */
    async sendEmployeeStatusUpdate(employeeData, previousStatus) {
        if (!this.isEnabled) {
            logger.warn('Make.com webhook is disabled. Skipping status update webhook.');
            return false;
        }

        try {
            const payload = {
                event: 'employee_status_update',
                timestamp: new Date().toISOString(),
                data: {
                    employeeId: employeeData.id,
                    employeeCode: employeeData.employee_code,
                    fullName: `${employeeData.first_name} ${employeeData.last_name}`,
                    email: employeeData.email,
                    telegramId: employeeData.telegram_id,
                    branch: employeeData.branch,
                    role: employeeData.role,
                    previousStatus: previousStatus,
                    newStatus: employeeData.status,
                    approvedBy: employeeData.approved_by,
                    approvedDate: employeeData.approved_date,
                    notes: employeeData.notes || '',
                    source: 'botzilla_employee_status_update',
                    environment: process.env.NODE_ENV || 'production'
                }
            };

            const config = {
                timeout: 10000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotZilla-API/1.0'
                }
            };

            const response = await axios.post(this.webhookUrl, payload, config);

            logger.info('Employee status update sent to Make.com successfully:', {
                employeeId: employeeData.id,
                employeeCode: employeeData.employee_code,
                previousStatus,
                newStatus: employeeData.status,
                responseStatus: response.status
            });

            return true;

        } catch (error) {
            logger.error('Failed to send employee status update to Make.com:', {
                employeeId: employeeData.id,
                employeeCode: employeeData.employee_code,
                error: error.message,
                previousStatus,
                newStatus: employeeData.status
            });

            return false;
        }
    }

    /**
     * Verificar si el webhook está configurado y disponible
     * @returns {Promise<boolean>} - True si el webhook está disponible
     */
    async testWebhook() {
        if (!this.isEnabled) {
            return false;
        }

        try {
            const testPayload = {
                event: 'webhook_test',
                timestamp: new Date().toISOString(),
                data: {
                    message: 'Test webhook from BotZilla API',
                    source: 'botzilla_webhook_test',
                    environment: process.env.NODE_ENV || 'production'
                }
            };

            const config = {
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'User-Agent': 'BotZilla-API/1.0'
                }
            };

            const response = await axios.post(this.webhookUrl, testPayload, config);
            
            logger.info('Make.com webhook test successful:', {
                responseStatus: response.status,
                responseData: response.data
            });

            return true;

        } catch (error) {
            logger.error('Make.com webhook test failed:', {
                error: error.message,
                webhookUrl: this.webhookUrl ? this.webhookUrl.substring(0, 50) + '...' : 'not set'
            });

            return false;
        }
    }
}

module.exports = new MakeWebhookService();
