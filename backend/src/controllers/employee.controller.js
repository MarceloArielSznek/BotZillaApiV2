const { 
    Employee, 
    TelegramGroup, 
    Branch, 
    CrewMember, 
    CrewMemberBranch,
    SalesPerson,
    SalesPersonBranch,
    EmployeeTelegramGroup 
} = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const makeWebhookService = require('../services/makeWebhook.service');

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

    /**
     * Activar un empleado: crear registro en crew_member o sales_person
     * y asignar branches y grupos de Telegram
     */
    async activateEmployee(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            const { id } = req.params;
            const { 
                final_role,      // 'crew_member', 'crew_leader', 'sales_person'
                branches,        // [1, 3, 5] - Array de branch IDs
                is_leader,       // true/false - Solo para crew
                animal,          // 'Lion', 'Tiger', etc. - Solo para crew
                telegram_groups  // [2, 4, 6] - Array de telegram group IDs
            } = req.body;

            // Validaciones básicas
            if (!final_role || !['crew_member', 'crew_leader', 'sales_person'].includes(final_role)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid final_role. Must be crew_member, crew_leader, or sales_person.' 
                });
            }

            if (!branches || !Array.isArray(branches) || branches.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'At least one branch must be selected.' 
                });
            }

            // 1. Buscar el employee
            const employee = await Employee.findByPk(id, { transaction });
            
            if (!employee) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Employee not found.' });
            }

            if (employee.status !== 'pending') {
                await transaction.rollback();
                return res.status(400).json({ 
                    success: false, 
                    message: `Employee is already ${employee.status}. Can only activate pending employees.` 
                });
            }

            // 2. Crear registro en crew_member o sales_person
            let newRecord;
            const fullName = `${employee.first_name} ${employee.last_name}`;
            
            if (final_role === 'crew_member' || final_role === 'crew_leader') {
                // Crear crew_member
                newRecord = await CrewMember.create({
                    name: fullName,
                    phone: employee.phone_number,
                    telegram_id: employee.telegram_id,
                    is_leader: final_role === 'crew_leader' || is_leader === true,
                    animal: animal || null,
                    employee_id: employee.id
                }, { transaction });

                // Insertar en crew_member_branch
                const branchRecords = branches.map(branchId => ({
                    crew_member_id: newRecord.id,
                    branch_id: branchId
                }));
                await CrewMemberBranch.bulkCreate(branchRecords, { transaction });

                logger.info('Crew member created successfully', { 
                    employeeId: employee.id, 
                    crewMemberId: newRecord.id,
                    branches: branches
                });

            } else if (final_role === 'sales_person') {
                // Crear sales_person
                newRecord = await SalesPerson.create({
                    name: fullName,
                    phone: employee.phone_number,
                    telegram_id: employee.telegram_id,
                    is_active: true,
                    warning_count: 0,
                    employee_id: employee.id
                }, { transaction });

                // Insertar en sales_person_branch
                const branchRecords = branches.map(branchId => ({
                    sales_person_id: newRecord.id,
                    branch_id: branchId
                }));
                await SalesPersonBranch.bulkCreate(branchRecords, { transaction });

                logger.info('Sales person created successfully', { 
                    employeeId: employee.id, 
                    salesPersonId: newRecord.id,
                    branches: branches
                });
            }

            // 3. Asignar grupos de Telegram
            let groupsToAdd = [];
            if (telegram_groups && Array.isArray(telegram_groups) && telegram_groups.length > 0) {
                // Buscar los objetos completos de TelegramGroup
                groupsToAdd = await TelegramGroup.findAll({
                    where: { id: telegram_groups },
                    attributes: ['id', 'telegram_id', 'name'],
                    transaction
                });

                const groupRecords = telegram_groups.map(groupId => ({
                    employee_id: employee.id,
                    telegram_group_id: groupId,
                    status_id: 1 // Assuming 1 = 'active' status
                }));
                await EmployeeTelegramGroup.bulkCreate(groupRecords, { transaction });

                logger.info('Telegram groups assigned', { 
                    employeeId: employee.id, 
                    groups: telegram_groups 
                });
            }

            // 4. Actualizar el employee
            await employee.update({
                status: 'active',
                approved_by: req.user?.id || null, // ID del usuario que aprobó (viene del token)
                approved_date: new Date()
            }, { transaction });

            // 5. Commit de la transacción
            await transaction.commit();

            // 6. Disparar webhook de Telegram (DESPUÉS del commit, asíncrono)
            if (groupsToAdd.length > 0) {
                makeWebhookService.sendGroupMembershipUpdate({
                    employeeTelegramId: employee.telegram_id,
                    employeeName: fullName,
                    groups: groupsToAdd,
                    action: 'add'
                }).catch(err => {
                    logger.error('Failed to send webhook for group membership', {
                        employeeId: employee.id,
                        error: err.message
                    });
                });
            }

            // 7. Retornar respuesta exitosa
            res.status(200).json({
                success: true,
                message: `Employee ${fullName} activated successfully as ${final_role}.`,
                data: {
                    employee_id: employee.id,
                    new_record_id: newRecord.id,
                    role: final_role,
                    branches: branches,
                    telegram_groups: telegram_groups || []
                }
            });

        } catch (error) {
            await transaction.rollback();
            logger.error('Error activating employee', { 
                employeeId: req.params.id, 
                error: error.message, 
                stack: error.stack 
            });
            res.status(500).json({ 
                success: false, 
                message: 'Failed to activate employee. Please try again.',
                error: error.message 
            });
        }
    }

    /**
     * Rechazar un empleado
     */
    async rejectEmployee(req, res) {
        try {
            const { id } = req.params;
            const { reason } = req.body; // Razón opcional del rechazo

            const employee = await Employee.findByPk(id);
            
            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee not found.' });
            }

            if (employee.status !== 'pending') {
                return res.status(400).json({ 
                    success: false, 
                    message: `Employee is already ${employee.status}. Can only reject pending employees.` 
                });
            }

            await employee.update({
                status: 'rejected',
                approved_by: req.user?.id || null,
                approved_date: new Date(),
                notes: reason || employee.notes // Agregar razón a las notas si existe
            });

            logger.info('Employee rejected', { 
                employeeId: employee.id, 
                rejectedBy: req.user?.id,
                reason: reason 
            });

            res.status(200).json({
                success: true,
                message: `Employee ${employee.first_name} ${employee.last_name} has been rejected.`,
                data: employee
            });

        } catch (error) {
            logger.error('Error rejecting employee', { 
                employeeId: req.params.id, 
                error: error.message 
            });
            res.status(500).json({ 
                success: false, 
                message: 'Failed to reject employee.' 
            });
        }
    }
}

module.exports = new EmployeeController();
