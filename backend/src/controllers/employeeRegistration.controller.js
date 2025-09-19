const { logger } = require('../utils/logger');
const { Employee } = require('../models');
const makeWebhookService = require('../services/makeWebhook.service');
const { v4: uuidv4 } = require('uuid');

/**
 * Controlador para registro de empleados
 * Integrado con la base de datos y el webhook de Make.com
 */
class EmployeeRegistrationController {
    
    /**
     * Registrar un nuevo empleado
     * POST /api/employee-registration/register
     */
    async registerEmployee(req, res) {
        try {
            const { 
                firstName, lastName, street, city, state, zip, 
                dateOfBirth, email, phoneNumber, telegramId, branch, role 
            } = req.body;
            
            logger.info('New employee registration received', { email });

            // 1. Verificar si el email ya existe
            const existingEmployeeByEmail = await Employee.findOne({ where: { email: email.toLowerCase() } });
            if (existingEmployeeByEmail) {
                logger.warn('Registration attempt with existing email', { email });
                return res.status(409).json({ // 409 Conflict es más apropiado
                    success: false,
                    message: 'Email address is already registered.',
                    error: 'DUPLICATE_EMAIL'
                });
            }

            // 2. Verificar si el Telegram ID ya existe
            const existingEmployeeByTelegram = await Employee.findOne({ where: { telegram_id: telegramId } });
            if (existingEmployeeByTelegram) {
                logger.warn('Registration attempt with existing Telegram ID', { telegramId });
                return res.status(409).json({
                    success: false,
                    message: 'Telegram ID is already registered.',
                    error: 'DUPLICATE_TELEGRAM_ID'
                });
            }

            // 3. Crear nuevo empleado en la base de datos
            const newEmployee = await Employee.create({
                first_name: firstName,
                last_name: lastName,
                street: street,
                city: city,
                state: state,
                zip: zip,
                date_of_birth: dateOfBirth,
                email: email.toLowerCase(),
                phone_number: phoneNumber,
                telegram_id: telegramId,
                branch: branch,
                role: role,
                status: 'pending', // Estado inicial
                notes: `Employee registered via self-registration form on ${new Date().toISOString()}`
            });

            logger.info('Employee created successfully in DB', { employeeId: newEmployee.id });

            // 4. Enviar datos a Make.com (no bloquear la respuesta si falla)
            makeWebhookService.sendEmployeeRegistration(newEmployee)
                .catch(error => {
                    logger.error('Error sending to Make.com webhook (non-blocking)', {
                        employeeId: newEmployee.id,
                        error: error.message
                    });
                });

            res.status(201).json({
                success: true,
                message: 'Employee registration submitted successfully.',
                data: {
                    registrationId: newEmployee.employee_code,
                    employeeId: newEmployee.id,
                    email: newEmployee.email
                }
            });

        } catch (error) {
            logger.error('Error during employee registration', {
                message: error.message,
                stack: error.stack,
                // Incluir detalles del error de validación de Sequelize si existe
                validationErrors: error.errors ? error.errors.map(err => ({
                    field: err.path,
                    message: err.message,
                    value: err.value
                })) : undefined
            });

            // Manejar errores de validación de Sequelize de forma genérica
            if (error.name === 'SequelizeValidationError') {
                 return res.status(400).json({
                     success: false,
                     message: 'Database validation failed',
                     errors: error.errors.map(err => ({ field: err.path, message: err.message }))
                 });
            }
            
            res.status(500).json({
                success: false,
                message: 'Failed to submit employee registration.',
                error: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    // Mantener los otros métodos por si son usados en otras partes
    async getRegistrationStats(req, res) {
        res.status(501).json({ success: false, message: 'Stats are not implemented yet.' });
    }

    async validateTelegramId(req, res) {
        res.status(501).json({ success: false, message: 'Validation is not implemented yet.' });
    }

    async testMakeWebhook(req, res) {
        try {
            const isAvailable = await makeWebhookService.testWebhook();
            if (isAvailable) {
                res.json({ success: true, message: 'Make.com webhook is available.' });
            } else {
                res.status(503).json({ success: false, message: 'Make.com webhook is unavailable.' });
            }
        } catch (error) {
            res.status(500).json({ success: false, message: 'Error testing webhook.' });
        }
    }

    async getWebhookStatus(req, res) {
        const isConfigured = !!process.env.MAKE_WEBHOOK_URL;
        res.json({ success: true, data: { isConfigured } });
    }
}

module.exports = new EmployeeRegistrationController();
