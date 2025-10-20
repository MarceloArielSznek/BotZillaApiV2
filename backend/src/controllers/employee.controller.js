const { 
    Employee, 
    TelegramGroup, 
    Branch, 
    CrewMember, 
    CrewMemberBranch,
    SalesPerson,
    SalesPersonBranch,
    EmployeeTelegramGroup,
    User,
    UserBranch
} = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const makeWebhookService = require('../services/makeWebhook.service');
const crypto = require('crypto');

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
     * SOLO los que tienen telegram_id (completaron su registro)
     */
    async getPendingEmployees(req, res) {
        try {
            const pendingEmployees = await Employee.findAll({
                where: {
                    status: 'pending',
                    telegram_id: {
                        [Op.ne]: null  // Solo employees que completaron su registro
                    }
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
                final_role,      // 'crew_member', 'crew_leader', 'sales_person', 'corporate'
                branches,        // [1, 3, 5] - Array de branch IDs
                is_leader,       // true/false - Solo para crew
                animal,          // 'Lion', 'Tiger', etc. - Solo para crew
                telegram_groups, // [2, 4, 6] - Array de telegram group IDs
                user_role_id     // ID del rol de usuario (solo para corporate)
            } = req.body;

            // Validaciones básicas
            if (!final_role || !['crew_member', 'crew_leader', 'sales_person', 'corporate'].includes(final_role)) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Invalid final_role. Must be crew_member, crew_leader, sales_person, or corporate.' 
                });
            }

            if (!branches || !Array.isArray(branches) || branches.length === 0) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'At least one branch must be selected.' 
                });
            }

            // Validar user_role_id para corporate
            if (final_role === 'corporate' && !user_role_id) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'User role is required for corporate employees.' 
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

            // 2. Crear registro en crew_member, sales_person o user (corporate)
            let newRecord;
            let temporaryPassword = null;
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

            } else if (final_role === 'corporate') {
                // Crear usuario para empleado corporate
                // Generar contraseña temporal
                temporaryPassword = crypto.randomBytes(8).toString('hex'); // 16 caracteres
                
                // Crear usuario con el rol seleccionado por el admin
                newRecord = await User.create({
                    email: employee.email,
                    password: temporaryPassword, // Se hasheará automáticamente por el hook del modelo
                    phone: employee.phone_number,
                    telegram_id: employee.telegram_id,
                    rol_id: user_role_id
                }, { transaction });

                // Insertar en user_branch
                const branchRecords = branches.map(branchId => ({
                    user_id: newRecord.id,
                    branch_id: branchId
                }));
                await UserBranch.bulkCreate(branchRecords, { transaction });

                logger.info('Corporate user created successfully', { 
                    employeeId: employee.id, 
                    userId: newRecord.id,
                    branches: branches,
                    email: employee.email
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

            // 7. Enviar credenciales por Telegram si es corporate
            if (final_role === 'corporate' && temporaryPassword) {
                try {
                    // Enviar mensaje con credenciales por Telegram
                    await makeWebhookService.sendCredentialsNotification({
                        telegramId: employee.telegram_id,
                        fullName: fullName,
                        email: employee.email,
                        temporaryPassword: temporaryPassword
                    });
                    
                    logger.info('Credentials sent via Telegram', { 
                        employeeId: employee.id,
                        email: employee.email 
                    });
                } catch (err) {
                    logger.error('Failed to send credentials via Telegram', {
                        employeeId: employee.id,
                        error: err.message
                    });
                    // No bloqueamos la respuesta si falla el envío
                }
            }

            // 8. Retornar respuesta exitosa
            const response = {
                success: true,
                message: `Employee ${fullName} activated successfully as ${final_role}.`,
                data: {
                    employee_id: employee.id,
                    new_record_id: newRecord.id,
                    role: final_role,
                    branches: branches,
                    telegram_groups: telegram_groups || []
                }
            };

            // Incluir contraseña temporal SOLO si es corporate (para mostrarla al admin)
            if (final_role === 'corporate' && temporaryPassword) {
                response.data.temporary_password = temporaryPassword;
                response.data.email = employee.email;
                response.message += ` Login credentials have been sent via Telegram.`;
            }

            res.status(200).json(response);

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
     * Obtener employees que esperan completar su registro
     * (pending sin telegram_id Y que NO estén ya en crew_member o sales_person)
     */
    async getAwaitingRegistration(req, res) {
        try {
            // Obtener IDs de employees que YA están en crew_member o sales_person
            const crewMemberEmployeeIds = await CrewMember.findAll({
                attributes: ['employee_id'],
                where: {
                    employee_id: { [Op.ne]: null }
                },
                raw: true
            }).then(results => results.map(r => r.employee_id));

            const salesPersonEmployeeIds = await SalesPerson.findAll({
                attributes: ['employee_id'],
                where: {
                    employee_id: { [Op.ne]: null }
                },
                raw: true
            }).then(results => results.map(r => r.employee_id));

            // Combinar ambos arrays
            const alreadyOnboardedIds = [...new Set([...crewMemberEmployeeIds, ...salesPersonEmployeeIds])];

            logger.info('Already onboarded employee IDs:', { count: alreadyOnboardedIds.length, ids: alreadyOnboardedIds });

            // Buscar employees pending sin telegram_id y que NO estén ya onboarded
            const awaitingEmployees = await Employee.findAll({
                where: {
                    status: 'pending',
                    telegram_id: {
                        [Op.is]: null  // Sin telegram_id = no completaron registro
                    },
                    ...(alreadyOnboardedIds.length > 0 && {
                        id: {
                            [Op.notIn]: alreadyOnboardedIds  // Excluir los que ya están en crew_member o sales_person
                        }
                    })
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
                data: awaitingEmployees
            });
        } catch (error) {
            logger.error('Error fetching awaiting registration employees', { error: error.message, stack: error.stack });
            res.status(500).json({ success: false, message: 'Failed to fetch awaiting registration employees.' });
        }
    }

    /**
     * Enviar recordatorio de registro a un employee
     */
    async sendRegistrationReminder(req, res) {
        try {
            const { id } = req.params;
            
            const employee = await Employee.findByPk(id, {
                include: [{
                    model: Branch,
                    as: 'branch'
                }]
            });

            if (!employee) {
                return res.status(404).json({ success: false, message: 'Employee not found.' });
            }

            if (employee.status !== 'pending') {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Employee is not pending registration.' 
                });
            }

            if (employee.telegram_id) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Employee already completed registration.' 
                });
            }

            // Disparar webhook a Make.com (asíncrono)
            makeWebhookService.sendRegistrationReminder({
                employeeId: employee.id,
                firstName: employee.first_name,
                lastName: employee.last_name,
                email: employee.email,
                role: employee.role,
                branchName: employee.branch?.name || 'N/A',
                registrationDate: employee.registration_date,
                registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`
            }).catch(err => {
                logger.error('Failed to send registration reminder webhook', {
                    employeeId: employee.id,
                    error: err.message
                });
            });

            logger.info('Registration reminder sent', { 
                employeeId: employee.id,
                email: employee.email
            });

            res.status(200).json({
                success: true,
                message: `Registration reminder sent to ${employee.email}`,
                data: {
                    employee_id: employee.id,
                    email: employee.email
                }
            });

        } catch (error) {
            logger.error('Error sending registration reminder', { 
                employeeId: req.params.id, 
                error: error.message 
            });
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send registration reminder.' 
            });
        }
    }

    /**
     * Enviar recordatorios de registro en masa (bulk)
     * POST /api/employees/send-bulk-reminders
     * Body: { employeeIds: [1, 2, 3] }
     */
    async sendBulkRegistrationReminders(req, res) {
        try {
            const { employeeIds } = req.body;

            if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'employeeIds array is required and must not be empty.'
                });
            }

            logger.info('Starting bulk registration reminders', { count: employeeIds.length });

            const results = {
                total: employeeIds.length,
                sent: 0,
                blocked: 0,
                alreadyRegistered: 0,
                errors: []
            };

            // Obtener todos los employees de una vez
            const employees = await Employee.findAll({
                where: {
                    id: {
                        [Op.in]: employeeIds
                    },
                    status: 'pending',
                    telegram_id: {
                        [Op.is]: null
                    }
                },
                include: [{
                    model: Branch,
                    as: 'branch'
                }]
            });

            // Verificar estado en Attic Tech para employees que tienen attic_tech_user_id
            const axios = require('axios');
            const { loginToAtticTech } = require('../utils/atticTechAuth');
            
            let apiKey = null;
            try {
                apiKey = await loginToAtticTech();
            } catch (error) {
                logger.warn('Could not login to Attic Tech for blocked check', { error: error.message });
            }

            // Array para acumular los employees que SÍ se enviarán
            const employeesToSend = [];

            // Validar cada employee y acumular los que NO están bloqueados
            for (const employee of employees) {
                try {
                    // Si tiene attic_tech_user_id, verificar que no esté bloqueado
                    if (employee.attic_tech_user_id && apiKey) {
                        try {
                            const userResponse = await axios.get(`https://www.attic-tech.com/api/users/${employee.attic_tech_user_id}`, {
                                headers: {
                                    'Authorization': `JWT ${apiKey}`,
                                    'Content-Type': 'application/json'
                                },
                                params: {
                                    depth: 1
                                },
                                timeout: 5000
                            });

                            const atUser = userResponse.data;
                            
                            if (atUser.isBlocked) {
                                logger.warn('Employee is blocked in Attic Tech, skipping', {
                                    employeeId: employee.id,
                                    email: employee.email
                                });
                                results.blocked++;
                                results.errors.push({
                                    employeeId: employee.id,
                                    email: employee.email,
                                    reason: 'User is blocked in Attic Tech'
                                });
                                continue;
                            }
                        } catch (atError) {
                            logger.warn('Could not verify AT status, will send anyway', {
                                employeeId: employee.id,
                                error: atError.message
                            });
                        }
                    }

                    // Agregar al array de employees a enviar
                    employeesToSend.push({
                        employeeId: employee.id,
                        firstName: employee.first_name,
                        lastName: employee.last_name,
                        email: employee.email,
                        role: employee.role,
                        branchName: employee.branch?.name || 'N/A',
                        registrationDate: employee.registration_date,
                        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`
                    });

                } catch (error) {
                    logger.error('Error validating employee', {
                        employeeId: employee.id,
                        email: employee.email,
                        error: error.message
                    });
                    results.errors.push({
                        employeeId: employee.id,
                        email: employee.email,
                        reason: error.message
                    });
                }
            }

            // Enviar UN SOLO webhook con todos los employees válidos
            if (employeesToSend.length > 0) {
                try {
                    await makeWebhookService.sendBulkRegistrationReminders(employeesToSend);
                    results.sent = employeesToSend.length;
                    logger.info('Bulk reminders sent successfully', { 
                        count: employeesToSend.length,
                        emails: employeesToSend.map(e => e.email).join(', ')
                    });
                } catch (webhookError) {
                    logger.error('Error sending bulk webhook', {
                        count: employeesToSend.length,
                        error: webhookError.message
                    });
                    // Marcar todos como error si falla el webhook
                    employeesToSend.forEach(emp => {
                        results.errors.push({
                            employeeId: emp.employeeId,
                            email: emp.email,
                            reason: 'Webhook failed: ' + webhookError.message
                        });
                    });
                }
            }

            logger.info('Bulk registration reminders completed', results);

            res.status(200).json({
                success: true,
                message: `Sent ${results.sent} of ${results.total} reminders successfully.`,
                data: results
            });

        } catch (error) {
            logger.error('Error sending bulk registration reminders', { 
                error: error.message,
                stack: error.stack
            });
            res.status(500).json({ 
                success: false, 
                message: 'Failed to send bulk registration reminders.',
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

    /**
     * Sincronizar registros antiguos de sales_person y crew_member con employee
     * (Para salespersons/crew que fueron creados ANTES de que existiera la tabla employee)
     */
    async syncLegacyRecords(req, res) {
        const transaction = await sequelize.transaction();
        
        try {
            logger.info('🔄 Starting legacy records synchronization...');

            const results = {
                salesPersons: {
                    synced: 0,
                    created: 0,
                    telegram_id_copied: 0,
                    errors: []
                },
                crewMembers: {
                    synced: 0,
                    created: 0,
                    telegram_id_copied: 0,
                    errors: []
                }
            };

            // ==========================================
            // PASO 1: Sincronizar SalesPersons
            // ==========================================
            const legacySalesPersons = await SalesPerson.findAll({
                where: {
                    employee_id: { [Op.is]: null },
                    telegram_id: { [Op.ne]: null } // Solo los que tienen telegram_id (ya activados)
                },
                include: [{
                    model: Branch,
                    as: 'branches',
                    through: { attributes: [] }
                }]
            });

            logger.info(`📋 Found ${legacySalesPersons.length} legacy salespersons to sync`);

            for (const sp of legacySalesPersons) {
                try {
                    const nameParts = sp.name.trim().split(' ');
                    const firstName = nameParts[0] || sp.name;
                    const lastName = nameParts.slice(1).join(' ') || '';

                    // Buscar employee existente por nombre similar
                    let employee = await Employee.findOne({
                        where: {
                            first_name: { [Op.iLike]: firstName },
                            last_name: { [Op.iLike]: lastName }
                        },
                        transaction
                    });

                    // Si no existe, crear uno nuevo
                    if (!employee) {
                        const primaryBranch = sp.branches?.[0] || null;
                        
                        employee = await Employee.create({
                            first_name: firstName,
                            last_name: lastName,
                            email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@legacy.botzilla.local`,
                            role: 'salesperson',
                            telegram_id: sp.telegram_id,
                            phone: sp.phone,
                            branch_id: primaryBranch?.id || null,
                            status: 'active',
                            registration_date: new Date(),
                            approved_date: new Date(),
                            approved_by: req.user?.id || null
                        }, { transaction });

                        results.salesPersons.created++;
                        logger.info(`✅ Created new employee for salesperson: ${sp.name} (ID: ${employee.id})`);
                    }

                    // Actualizar sales_person con employee_id
                    await SalesPerson.update(
                        { employee_id: employee.id },
                        { where: { id: sp.id }, transaction }
                    );

                    // Si el employee NO tiene telegram_id, copiar el del salesperson
                    if (!employee.telegram_id && sp.telegram_id) {
                        await Employee.update(
                            { 
                                telegram_id: sp.telegram_id,
                                status: 'active' // Si ya tiene telegram_id, está listo para usar
                            },
                            { where: { id: employee.id }, transaction }
                        );
                        results.salesPersons.telegram_id_copied++;
                        logger.info(`📋 Copied telegram_id from salesperson to employee ${employee.id}`);
                    }

                    results.salesPersons.synced++;
                    logger.info(`🔗 Linked salesperson ${sp.name} to employee ${employee.id}`);

                } catch (error) {
                    logger.error(`❌ Error syncing salesperson ${sp.name}:`, error.message);
                    results.salesPersons.errors.push({
                        name: sp.name,
                        id: sp.id,
                        error: error.message
                    });
                }
            }

            // ==========================================
            // PASO 2: Sincronizar CrewMembers
            // ==========================================
            const legacyCrewMembers = await CrewMember.findAll({
                where: {
                    employee_id: { [Op.is]: null },
                    telegram_id: { [Op.ne]: null } // Solo los que tienen telegram_id (ya activados)
                },
                include: [{
                    model: Branch,
                    as: 'branches',
                    through: { attributes: [] }
                }]
            });

            logger.info(`📋 Found ${legacyCrewMembers.length} legacy crew members to sync`);

            for (const cm of legacyCrewMembers) {
                try {
                    const nameParts = cm.name.trim().split(' ');
                    const firstName = nameParts[0] || cm.name;
                    const lastName = nameParts.slice(1).join(' ') || '';

                    // Buscar employee existente por nombre similar
                    let employee = await Employee.findOne({
                        where: {
                            first_name: { [Op.iLike]: firstName },
                            last_name: { [Op.iLike]: lastName }
                        },
                        transaction
                    });

                    // Si no existe, crear uno nuevo
                    if (!employee) {
                        const primaryBranch = cm.branches?.[0] || null;
                        const role = cm.is_leader ? 'crew_leader' : 'crew_member';
                        
                        employee = await Employee.create({
                            first_name: firstName,
                            last_name: lastName,
                            email: `${firstName.toLowerCase()}.${lastName.toLowerCase().replace(/\s+/g, '')}@legacy.botzilla.local`,
                            role: role,
                            telegram_id: cm.telegram_id,
                            phone: cm.phone,
                            branch_id: primaryBranch?.id || null,
                            status: 'active',
                            registration_date: new Date(),
                            approved_date: new Date(),
                            approved_by: req.user?.id || null
                        }, { transaction });

                        results.crewMembers.created++;
                        logger.info(`✅ Created new employee for crew member: ${cm.name} (ID: ${employee.id})`);
                    }

                    // Actualizar crew_member con employee_id
                    await CrewMember.update(
                        { employee_id: employee.id },
                        { where: { id: cm.id }, transaction }
                    );

                    // Si el employee NO tiene telegram_id, copiar el del crew member
                    if (!employee.telegram_id && cm.telegram_id) {
                        await Employee.update(
                            { 
                                telegram_id: cm.telegram_id,
                                status: 'active' // Si ya tiene telegram_id, está listo para usar
                            },
                            { where: { id: employee.id }, transaction }
                        );
                        results.crewMembers.telegram_id_copied++;
                        logger.info(`📋 Copied telegram_id from crew member to employee ${employee.id}`);
                    }

                    results.crewMembers.synced++;
                    logger.info(`🔗 Linked crew member ${cm.name} to employee ${employee.id}`);

                } catch (error) {
                    logger.error(`❌ Error syncing crew member ${cm.name}:`, error.message);
                    results.crewMembers.errors.push({
                        name: cm.name,
                        id: cm.id,
                        error: error.message
                    });
                }
            }

            await transaction.commit();

            logger.info('✅ Legacy records synchronization completed', results);

            res.status(200).json({
                success: true,
                message: 'Legacy records synchronized successfully',
                data: results
            });

        } catch (error) {
            await transaction.rollback();
            logger.error('❌ Error during legacy records synchronization:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to synchronize legacy records',
                error: error.message
            });
        }
    }
}

module.exports = new EmployeeController();
