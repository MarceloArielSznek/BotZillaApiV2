const axios = require('axios');
const { logger } = require('../utils/logger');
const { v4: uuidv4 } = require('uuid');

// Almacenamiento simple en memoria para el estado del webhook
let isWebhookAvailable = null;
let lastCheck = 0;
const CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutos

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

    /**
     * Enviar recordatorio de registro a un employee
     * @param {object} employeeData - Datos del empleado
     */
    async sendRegistrationReminder(employeeData) {
        // Convertir a array y usar la función bulk
        return this.sendBulkRegistrationReminders([employeeData]);
    }

    /**
     * Enviar recordatorios de registro a múltiples employees (bulk)
     * @param {Array<object>} employeesData - Array de datos de empleados
     */
    async sendBulkRegistrationReminders(employeesData) {
        const webhookUrl = process.env.MAKE_REGISTRATION_REMINDER_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.warn('MAKE_REGISTRATION_REMINDER_WEBHOOK_URL not configured. Skipping reminder webhook.');
            return false;
        }

        if (!Array.isArray(employeesData) || employeesData.length === 0) {
            logger.warn('No employees data provided for bulk reminders');
            return false;
        }

        try {
            const payload = {
                event: 'bulk_registration_reminder',
                timestamp: new Date().toISOString(),
                count: employeesData.length,
                employees: employeesData.map(emp => ({
                    id: emp.employeeId,
                    first_name: emp.firstName,
                    last_name: emp.lastName,
                    full_name: `${emp.firstName} ${emp.lastName}`,
                    email: emp.email,
                    role: emp.role,
                    branch: emp.branchName,
                    registration_date: emp.registrationDate,
                    registration_url: emp.registrationUrl
                })),
                environment: process.env.NODE_ENV || 'production'
            };

            logger.info('Sending bulk registration reminder webhook to Make.com', {
                count: employeesData.length,
                emails: employeesData.map(e => e.email).join(', ')
            });

            await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': uuidv4()
                },
                timeout: 30000 // 30 segundos para bulk
            });

            logger.info('Bulk registration reminder webhook sent successfully', {
                count: employeesData.length
            });
            return true;

        } catch (error) {
            logger.error('Error sending bulk registration reminder webhook', {
                message: error.message,
                count: employeesData.length,
                responseData: error.response?.data
            });
            throw error;
        }
    }

    /**
     * Enviar notificación de resultados de sync de estimates
     * @param {object} syncResults - Resultados del sync
     * @param {number} syncResults.newCount - Nuevos estimates creados
     * @param {number} syncResults.updatedCount - Estimates actualizados
     * @param {number} syncResults.totalFetched - Total de estimates obtenidos de AT
     * @param {string} syncResults.startDate - Fecha de inicio del rango
     * @param {string} syncResults.endDate - Fecha de fin del rango
     * @param {number} syncResults.durationSeconds - Duración del sync en segundos
     * @param {string} syncResults.status - Estado: 'success' o 'error'
     * @param {string} syncResults.error - Mensaje de error si falló
     */
    async sendSyncEstimatesResult(syncResults) {
        const webhookUrl = process.env.MAKE_SYNC_CALLBACK_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.info('MAKE_SYNC_CALLBACK_WEBHOOK_URL not configured. Skipping sync result notification.');
            return false;
        }

        try {
            const payload = {
                event: 'sync_estimates_completed',
                timestamp: new Date().toISOString(),
                status: syncResults.status || 'success',
                results: {
                    total_fetched: syncResults.totalFetched || 0,
                    new_estimates: syncResults.newCount || 0,
                    updated_estimates: syncResults.updatedCount || 0,
                    total_processed: (syncResults.newCount || 0) + (syncResults.updatedCount || 0)
                },
                date_range: {
                    start_date: syncResults.startDate,
                    end_date: syncResults.endDate
                },
                performance: {
                    duration_seconds: syncResults.durationSeconds || 0,
                    duration_minutes: Math.round((syncResults.durationSeconds || 0) / 60 * 10) / 10
                },
                error: syncResults.error || null,
                environment: process.env.NODE_ENV || 'production'
            };

            logger.info('Sending sync estimates result to Make.com', {
                status: payload.status,
                newCount: syncResults.newCount,
                updatedCount: syncResults.updatedCount,
                duration: `${payload.performance.duration_minutes} min`
            });

            await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': uuidv4()
                },
                timeout: 10000
            });

            logger.info('Sync estimates result notification sent successfully');
            return true;

        } catch (error) {
            logger.error('Error sending sync estimates result webhook', {
                message: error.message,
                responseData: error.response?.data
            });
            // No throw - no queremos que esto bloquee el proceso principal
            return false;
        }
    }

    /**
     * Enviar alerta de crew leader sin registro
     * Se usa cuando se asigna un job a un crew leader que NO tiene telegram_id
     * 
     * @param {object} crewLeaderData - Datos del crew leader sin registro
     * @param {number} crewLeaderData.crewLeaderId - ID del crew leader
     * @param {string} crewLeaderData.crewLeaderName - Nombre completo
     * @param {string} crewLeaderData.crewLeaderEmail - Email
     * @param {string} crewLeaderData.jobName - Nombre del job asignado
     * @param {string} crewLeaderData.branchName - Branch del job
     * @param {string} crewLeaderData.registrationUrl - URL para registrarse
     */
    async sendCrewLeaderRegistrationAlert(crewLeaderData) {
        const webhookUrl = process.env.MAKE_CREW_LEADER_ALERT_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.info('MAKE_CREW_LEADER_ALERT_WEBHOOK_URL not configured. Skipping crew leader alert.');
            return false;
        }

        try {
            // Generar mensaje descriptivo según el caso
            let message;
            if (crewLeaderData.notInDatabase) {
                message = `Crew Leader "${crewLeaderData.crewLeaderName}" was assigned to job "${crewLeaderData.jobName}" but is NOT in our database yet. Please run sync-users first, then send them the registration link.`;
            } else if (crewLeaderData.hasTelegramId && crewLeaderData.activeUser === false) {
                message = `Crew Leader "${crewLeaderData.crewLeaderName}" was assigned to job "${crewLeaderData.jobName}" and has registered with Telegram, but is still PENDING APPROVAL. Please approve them to start receiving job notifications.`;
            } else {
                message = `Crew Leader "${crewLeaderData.crewLeaderName}" was assigned to job "${crewLeaderData.jobName}" but hasn't registered with their Telegram ID yet. Please send them the registration link.`;
            }

            const payload = {
                event: 'crew_leader_needs_registration',
                timestamp: new Date().toISOString(),
                message: message, // Mensaje descriptivo para Make.com
                crew_leader: {
                    id: crewLeaderData.crewLeaderId,
                    name: crewLeaderData.crewLeaderName,
                    email: crewLeaderData.crewLeaderEmail,
                    branch: crewLeaderData.branchName,
                    active_user: crewLeaderData.activeUser === true, // Solo true si explícitamente es true
                    has_telegram_id: crewLeaderData.hasTelegramId === true // true si completó registro
                },
                job: {
                    name: crewLeaderData.jobName,
                    status: 'Plans In Progress'
                },
                registration_url: crewLeaderData.registrationUrl,
                environment: process.env.NODE_ENV || 'production'
            };

            logger.info('Sending crew leader registration alert to Make.com', {
                crewLeaderId: crewLeaderData.crewLeaderId,
                crewLeaderName: crewLeaderData.crewLeaderName,
                jobName: crewLeaderData.jobName
            });

            await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': uuidv4()
                },
                timeout: 10000
            });

            logger.info('Crew leader registration alert sent successfully');
            return true;

        } catch (error) {
            logger.error('Error sending crew leader registration alert', {
                message: error.message,
                responseData: error.response?.data
            });
            return false;
        }
    }

    /**
     * Envía una actualización de membresía de grupo a Make.com
     * @param {object} payload
     * @param {string} payload.employeeTelegramId - El ID de Telegram del empleado
     * @param {string} payload.employeeName - El nombre completo del empleado
     * @param {Array<object|string>} payload.groups - Para 'add', array de objetos {id, name}. Para 'remove', array de strings con IDs.
     * @param {'add' | 'remove'} payload.action - La acción a realizar
     */
    async sendGroupMembershipUpdate({ employeeTelegramId, employeeName, groups, action }) {
        const webhookUrl = process.env.MAKE_MEMBERSHIP_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.warn('MAKE_MEMBERSHIP_WEBHOOK_URL no está configurado. Saltando envío de webhook.');
            return;
        }

        if (!employeeTelegramId || !groups || groups.length === 0) {
            logger.info('No hay datos de membresía para enviar al webhook. Saltando.');
            return;
        }

        let payloadBody;

        if (action === 'add') {
            // Formato para 'add': necesita nombres para los enlaces de invitación
            payloadBody = {
                employee_telegram_id: employeeTelegramId,
                employee_name: employeeName, // Añadir nombre
                groups_to_add: groups.map(group => ({
                    telegram_id: group.telegram_id.toString(),
                    // Acortar el nombre si excede los 32 caracteres
                    invite_link_name: group.name.length > 32 ? group.name.substring(0, 32) : group.name
                })),
                action: 'add'
            };
        } else { // 'remove' o 'kick'
            payloadBody = {
                employee_telegram_id: employeeTelegramId,
                employee_name: employeeName, 
                group_telegram_ids: groups.map(group => group.telegram_id.toString()),
                action: action // será 'remove' o 'kick'
            };
        }

        try {
            logger.info(`Enviando webhook de membresía de grupo a Make.com`, { action, employeeName, count: groups.length });
            await axios.post(webhookUrl, payloadBody, {
                headers: {
                    'Content-Type': 'application/json',
                    'X-Request-ID': uuidv4() // Para trazabilidad
                },
                timeout: 10000 // 10 segundos de timeout
            });
            logger.info(`Webhook de membresía enviado exitosamente.`);
        } catch (error) {
            // Loguear el error pero no dejar que bloquee la operación principal
            logger.error('Error enviando el webhook de membresía a Make.com', {
                message: error.message,
                responseData: error.response?.data
            });
        }
    }
}

module.exports = new MakeWebhookService();
