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

            // Manejar errores de validación de Sequelize con mensajes claros
            if (error.name === 'SequelizeValidationError') {
                const friendlyErrors = error.errors.map(err => {
                    let friendlyMessage = err.message;
                    
                    // Mensajes más amigables para el usuario
                    switch (err.path) {
                        case 'first_name':
                            if (err.message.includes('between 2 and 50')) {
                                friendlyMessage = 'El nombre debe tener entre 2 y 50 caracteres';
                            } else if (err.message.includes('letters')) {
                                friendlyMessage = 'El nombre solo puede contener letras, espacios, guiones y apostrofes';
                            }
                            break;
                        case 'last_name':
                            if (err.message.includes('between 2 and 50')) {
                                friendlyMessage = 'El apellido debe tener entre 2 y 50 caracteres';
                            } else if (err.message.includes('letters')) {
                                friendlyMessage = 'El apellido solo puede contener letras, espacios, guiones y apostrofes';
                            }
                            break;
                        case 'email':
                            if (err.message.includes('valid email')) {
                                friendlyMessage = 'Por favor proporciona una dirección de email válida';
                            } else if (err.message.includes('between 5 and 100')) {
                                friendlyMessage = 'El email debe tener entre 5 y 100 caracteres';
                            }
                            break;
                        case 'phone_number':
                            if (err.message.includes('between 10 and 20')) {
                                friendlyMessage = 'El número de teléfono debe tener entre 10 y 20 caracteres';
                            }
                            break;
                        case 'street':
                            if (err.message.includes('between 5 and 100')) {
                                friendlyMessage = 'La dirección debe tener al menos 5 caracteres';
                            }
                            break;
                        case 'city':
                            if (err.message.includes('between 2 and 50')) {
                                friendlyMessage = 'La ciudad debe tener entre 2 y 50 caracteres';
                            }
                            break;
                        case 'state':
                            if (err.message.includes('between 2 and 50')) {
                                friendlyMessage = 'El estado debe tener entre 2 y 50 caracteres';
                            }
                            break;
                        case 'zip':
                            if (err.message.includes('between 3 and 20')) {
                                friendlyMessage = 'El código postal debe tener entre 3 y 20 caracteres';
                            }
                            break;
                        case 'date_of_birth':
                            if (err.message.includes('at least 16 years old')) {
                                friendlyMessage = 'Debes tener al menos 16 años para registrarte';
                            } else if (err.message.includes('valid date')) {
                                friendlyMessage = 'Por favor proporciona una fecha de nacimiento válida';
                            } else if (err.message.includes('past')) {
                                friendlyMessage = 'La fecha de nacimiento debe ser anterior a hoy';
                            }
                            break;
                        case 'branch':
                            if (err.message.includes('Branch selection is required')) {
                                friendlyMessage = 'Debes seleccionar una sucursal';
                            } else if (err.message.includes('available locations')) {
                                friendlyMessage = 'Debes seleccionar una sucursal válida de la lista';
                            }
                            break;
                        case 'role':
                            friendlyMessage = 'Debes seleccionar un rol válido';
                            break;
                    }
                    
                    return {
                        field: err.path,
                        message: friendlyMessage,
                        value: err.value
                    };
                });

                return res.status(400).json({
                    success: false,
                    message: 'Por favor corrige los siguientes errores:',
                    errors: friendlyErrors
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
