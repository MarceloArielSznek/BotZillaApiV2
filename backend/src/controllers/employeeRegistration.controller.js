const { logger } = require('../utils/logger');
const { Employee, User } = require('../models');
const { Op } = require('sequelize');

/**
 * Controlador para registro de empleados
 * Integrado con modelo Employee de la base de datos
 */
class EmployeeRegistrationController {
    
    /**
     * Registrar un nuevo empleado
     * POST /api/employee-registration/register
     */
    async registerEmployee(req, res) {
        try {
            const { firstName, lastName, nickname, email, phoneNumber, telegramId } = req.body;

            logger.info('New employee registration received:', {
                firstName,
                lastName,
                nickname: nickname || 'N/A',
                email,
                phoneNumber,
                telegramId: telegramId ? '***' : 'N/A', // No loguear el ID completo por seguridad
                timestamp: new Date().toISOString(),
                ip: req.ip,
                userAgent: req.get('User-Agent')
            });

            // Verificar si el email ya existe
            const existingEmployeeByEmail = await Employee.findOne({ where: { email: email.toLowerCase() } });
            if (existingEmployeeByEmail) {
                logger.warn('Registration attempt with existing email:', { email });
                return res.status(400).json({
                    success: false,
                    message: 'Email address is already registered',
                    error: 'DUPLICATE_EMAIL'
                });
            }

            // Verificar si el Telegram ID ya existe
            const existingEmployeeByTelegram = await Employee.findOne({ where: { telegram_id: telegramId } });
            if (existingEmployeeByTelegram) {
                logger.warn('Registration attempt with existing Telegram ID');
                return res.status(400).json({
                    success: false,
                    message: 'Telegram ID is already registered',
                    error: 'DUPLICATE_TELEGRAM_ID'
                });
            }

            // Crear nuevo empleado en la base de datos
            const newEmployee = await Employee.create({
                first_name: firstName,
                last_name: lastName,
                nickname: nickname || null,
                email: email.toLowerCase(),
                phone_number: phoneNumber,
                telegram_id: telegramId,
                status: 'pending', // Estado inicial
                notes: `Employee registered via self-registration form on ${new Date().toISOString()}`
            });

            logger.info('Employee registered successfully:', {
                employeeId: newEmployee.id,
                employeeCode: newEmployee.employee_code,
                fullName: newEmployee.getFullName(),
                email: newEmployee.email,
                status: newEmployee.status
            });

            res.status(201).json({
                success: true,
                message: 'Employee registration submitted successfully. HR will review and contact you within 24 hours.',
                data: {
                    registrationId: newEmployee.employee_code,
                    employeeId: newEmployee.id,
                    fullName: newEmployee.getFullName(),
                    email: newEmployee.email,
                    status: newEmployee.status,
                    registrationDate: newEmployee.registration_date
                }
            });

        } catch (error) {
            logger.error('Error during employee registration:', {
                message: error.message,
                stack: error.stack,
                validationErrors: error.errors ? error.errors.map(err => ({
                    field: err.path,
                    message: err.message,
                    value: err.value
                })) : undefined
            });

            // Manejar errores de validación de Sequelize
            if (error.name === 'SequelizeValidationError') {
                const validationErrors = error.errors.map(err => ({
                    field: err.path,
                    message: err.message
                }));

                return res.status(400).json({
                    success: false,
                    message: 'Validation failed',
                    errors: validationErrors
                });
            }

            // Manejar errores de unique constraint
            if (error.name === 'SequelizeUniqueConstraintError') {
                const field = error.errors[0]?.path;
                let message = 'This information is already registered';
                
                if (field === 'email') {
                    message = 'Email address is already registered';
                } else if (field === 'telegram_id') {
                    message = 'Telegram ID is already registered';
                } else if (field === 'employee_code') {
                    message = 'Employee code already exists';
                }

                return res.status(400).json({
                    success: false,
                    message,
                    error: 'DUPLICATE_ENTRY'
                });
            }

            // Error genérico del servidor
            res.status(500).json({
                success: false,
                message: 'Failed to submit employee registration. Please try again later.',
                error: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Obtener estadísticas de registros
     * GET /api/employee-registration/stats
     */
    async getRegistrationStats(req, res) {
        try {
            // Obtener estadísticas reales de la base de datos
            const totalRegistrations = await Employee.count();
            const pendingReview = await Employee.count({ where: { status: 'pending' } });
            const approved = await Employee.count({ where: { status: 'active' } });
            const rejected = await Employee.count({ where: { status: 'rejected' } });
            const inactive = await Employee.count({ where: { status: 'inactive' } });

            // Última registración
            const lastEmployee = await Employee.findOne({
                order: [['registration_date', 'DESC']],
                attributes: ['registration_date', 'first_name', 'last_name']
            });

            // Registraciones de esta semana
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const registrationsThisWeek = await Employee.count({
                where: {
                    registration_date: {
                        [Op.gte]: oneWeekAgo
                    }
                }
            });

            // Registraciones de este mes
            const oneMonthAgo = new Date();
            oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
            const registrationsThisMonth = await Employee.count({
                where: {
                    registration_date: {
                        [Op.gte]: oneMonthAgo
                    }
                }
            });

            const stats = {
                totalRegistrations,
                pendingReview,
                approved,
                rejected,
                inactive,
                lastRegistration: lastEmployee ? {
                    date: lastEmployee.registration_date,
                    name: `${lastEmployee.first_name} ${lastEmployee.last_name}`
                } : null,
                registrationsThisWeek,
                registrationsThisMonth
            };

            logger.info('Employee registration stats requested', {
                requestedBy: req.user?.id || 'anonymous',
                stats: {
                    ...stats,
                    lastRegistration: stats.lastRegistration ? {
                        date: stats.lastRegistration.date,
                        name: '***' // No loguear nombres completos
                    } : null
                }
            });

            res.json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('Error fetching registration stats', {
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({
                success: false,
                message: 'Error fetching registration statistics',
                error: 'INTERNAL_SERVER_ERROR'
            });
        }
    }

    /**
     * Validar Telegram ID (temporal)
     * POST /api/employee-registration/validate-telegram
     */
    async validateTelegramId(req, res) {
        try {
            const { telegramId } = req.body;

            if (!telegramId) {
                return res.status(400).json({
                    success: false,
                    message: 'Telegram ID is required'
                });
            }

            // Por ahora solo validamos que sea un número
            const isValidFormat = /^\d+$/.test(telegramId.toString());

            logger.info('Telegram ID validation requested', {
                telegramId,
                isValidFormat
            });

            // TODO: Aquí se verificaría con la API de Telegram si el ID existe
            // TODO: Se podría enviar un mensaje de prueba al usuario

            res.json({
                success: true,
                data: {
                    telegramId,
                    isValid: isValidFormat,
                    message: isValidFormat 
                        ? 'Telegram ID format is valid' 
                        : 'Invalid Telegram ID format. Should be numeric.'
                }
            });

        } catch (error) {
            logger.error('Error validating Telegram ID', {
                error: error.message,
                telegramId: req.body.telegramId
            });

            res.status(500).json({
                success: false,
                message: 'Error validating Telegram ID',
                error: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
}

module.exports = new EmployeeRegistrationController();
