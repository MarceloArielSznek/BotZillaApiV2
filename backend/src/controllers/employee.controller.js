const { Employee, TelegramGroup, Branch } = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');

class EmployeeController {

    /**
     * Obtener una lista de todos los empleados con paginación
     */
    async getAllEmployees(req, res) {
        try {
            const { 
                page = 1, 
                limit = 20, 
                sortBy = 'first_name', 
                order = 'ASC',
                name,
                role,
                branchId
            } = req.query;
            const offset = (page - 1) * limit;

            const orderDirection = order.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';

            const whereClause = {};
            if (name) {
                whereClause[Op.or] = [
                    { first_name: { [Op.iLike]: `%${name}%` } },
                    { last_name: { [Op.iLike]: `%${name}%` } }
                ];
            }
            if (role) {
                whereClause.role = role;
            }
            if (branchId) {
                whereClause.branch_id = branchId;
            }

            const orderMap = {
                name: [['first_name', orderDirection], ['last_name', orderDirection]],
                role: [['role', orderDirection]],
                branch: [[{ model: Branch, as: 'branch' }, 'name', orderDirection]]
            };
            const sortOrder = orderMap[sortBy] || orderMap.name;


            const { count, rows } = await Employee.findAndCountAll({
                where: whereClause,
                limit: parseInt(limit),
                offset: parseInt(offset),
                include: [
                    {
                        model: TelegramGroup,
                        as: 'telegramGroups',
                        through: { attributes: [] }
                    },
                    {
                        model: Branch,
                        as: 'branch'
                    }
                ],
                order: sortOrder,
                distinct: true // Asegura que el conteo sea de empleados únicos
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
                include: [
                    {
                        model: Branch,
                        as: 'branch'
                    }
                ],
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
                    through: { attributes: [] }
                },
                {
                    model: Branch,
                    as: 'branch'
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
