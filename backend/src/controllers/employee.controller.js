const { Employee, TelegramGroup } = require('../models');
const { logger } = require('../utils/logger');

class EmployeeController {

    /**
     * Obtener una lista de todos los empleados con paginación
     */
    async getAllEmployees(req, res) {
        try {
            const { page = 1, limit = 20 } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await Employee.findAndCountAll({
                limit: parseInt(limit),
                offset: parseInt(offset),
                include: [{
                    model: TelegramGroup,
                    as: 'telegramGroups',
                    through: { attributes: [] } // No incluir datos de la tabla intermedia
                }],
                order: [['first_name', 'ASC']]
            });

            res.status(200).json({
                success: true,
                data: rows,
                pagination: {
                    totalItems: count,
                    totalPages: Math.ceil(count / limit),
                    currentPage: parseInt(page)
                }
            });
        } catch (error) {
            logger.error('Error fetching all employees', { error: error.message, stack: error.stack });
            res.status(500).json({ success: false, message: 'Failed to fetch employees.' });
        }
    }
    
    /**
     * Obtener una lista de todos los empleados con estado 'pending'
     */
    async getPendingEmployees(req, res) {
        try {
            const pendingEmployees = await Employee.findAll({
                where: {
                    status: 'pending'
                },
                order: [
                    ['registration_date', 'ASC']
                ]
            });

            res.status(200).json({
                success: true,
                data: pendingEmployees
            });
        } catch (error) {
            logger.error('Error fetching pending employees', { error: error.message, stack: error.stack });
            res.status(500).json({ success: false, message: 'Failed to fetch pending employees.' });
        }
    }

    /**
     * Obtener los grupos de Telegram asignados a un empleado específico
     */
    async getEmployeeGroups(req, res) {
        try {
            const { id } = req.params;
            const employee = await Employee.findByPk(id, {
                include: [{
                    model: TelegramGroup,
                    as: 'telegramGroups',
                    through: { attributes: [] } // No incluir datos de la tabla intermedia
                }]
            });

            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee not found.' });
            }

            res.status(200).json({
                success: true,
                data: employee.telegramGroups || []
            });

        } catch (error) {
            logger.error('Error fetching employee groups', { employeeId: req.params.id, error: error.message });
            res.status(500).json({ success: false, message: 'Failed to fetch employee groups.' });
        }
    }
}

module.exports = new EmployeeController();
