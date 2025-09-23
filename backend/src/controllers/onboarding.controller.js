const { Employee, TelegramGroup, EmployeeTelegramGroup, GroupMembershipStatus } = require('../models');
const sequelize = require('../config/database'); // Importar sequelize desde la configuración
const { logger } = require('../utils/logger');
const makeWebhookService = require('../services/makeWebhook.service'); // Importar el servicio

// Helper para obtener IDs de estado y cachearlos
const statusCache = new Map();
const getStatusId = async (statusName) => {
    if (statusCache.has(statusName)) {
        return statusCache.get(statusName);
    }
    const status = await GroupMembershipStatus.findOne({ where: { name: statusName } });
    if (!status) throw new Error(`Status '${statusName}' not found in database.`);
    statusCache.set(statusName, status.id);
    return status.id;
};


class OnboardingController {

    /**
     * Asignar un empleado a uno o más grupos de Telegram.
     * Esta operación es idempotente: si se reasigna, el estado final será el deseado.
     * POST /api/onboarding/assign-groups
     */
    async assignGroups(req, res) {
        const { employee_id, groups: newGroupIds } = req.body; // Renombrar para claridad
        const adminUserId = req.user.id; // Obtener el ID del admin desde el token

        try {
            const memberStatusId = await getStatusId('member');

            const result = await sequelize.transaction(async (t) => {
                const employee = await Employee.findByPk(employee_id, {
                    include: [{ model: TelegramGroup, as: 'telegramGroups' }],
                    transaction: t
                });

                if (!employee) {
                    logger.warn('Attempted to assign groups to non-existent employee', { employee_id });
                    // Lanzar un error para que la transacción haga rollback
                    const error = new Error('Employee not found.');
                    error.statusCode = 404;
                    throw error;
                }

                // --- INICIO DE LA LÓGICA DEL WEBHOOK ---
                const currentGroupIds = new Set(employee.telegramGroups.map(g => g.id));
                const newGroupIdSet = new Set(newGroupIds);

                // Calcular diferencias para el webhook
                const groupsToAddIds = newGroupIds.filter(id => !currentGroupIds.has(id));
                const groupsToRemoveIds = employee.telegramGroups.filter(g => !newGroupIdSet.has(g.id)).map(g => g.id);

                // Obtener los telegram_id de los grupos a añadir/quitar
                const groupsToAdd = await TelegramGroup.findAll({ where: { id: groupsToAddIds }, transaction: t });
                const groupsToRemove = await TelegramGroup.findAll({ where: { id: groupsToRemoveIds }, transaction: t });

                // Disparar webhooks (no esperan a que terminen)
                if (groupsToAdd.length > 0) {
                    makeWebhookService.sendGroupMembershipUpdate({
                        employeeTelegramId: employee.telegram_id,
                        employeeName: `${employee.first_name} ${employee.last_name}`,
                        groups: groupsToAdd, // Enviar los objetos de grupo completos
                        action: 'add'
                    });
                }
                if (groupsToRemove.length > 0) {
                    makeWebhookService.sendGroupMembershipUpdate({
                        employeeTelegramId: employee.telegram_id,
                        employeeName: `${employee.first_name} ${employee.last_name}`,
                        groups: groupsToRemove, // Enviar los objetos de grupo completos
                        action: 'remove'
                    });
                }
                // --- FIN DE LA LÓGICA DEL WEBHOOK ---

                // Eliminar todas las asociaciones existentes para este empleado
                await EmployeeTelegramGroup.destroy({
                    where: { employee_id: employee_id },
                    transaction: t
                });

                // Crear las nuevas asociaciones
                const groupAssignments = groupsToAdd.map(group => ({
                    employee_id: employee_id,
                    telegram_group_id: group.id,
                    status_id: memberStatusId, // Usar ID dinámico
                    joined_at: new Date(),
                }));

                if (groupAssignments.length > 0) {
                    await EmployeeTelegramGroup.bulkCreate(groupAssignments, { transaction: t });
                }

                // Actualizar el estado del empleado basado en si tiene grupos asignados.
                const isBecomingActive = employee.status === 'pending' && newGroupIds.length > 0;
                const isBecomingPending = newGroupIds.length === 0;

                if (isBecomingActive) {
                    employee.status = 'active';
                    employee.approved_by = adminUserId;
                    employee.approved_date = new Date();
                    await employee.save({ transaction: t });
                    logger.info(`Employee approved and status updated to 'active'`, { employeeId: employee.id, approvedBy: adminUserId });
                } else if (isBecomingPending && employee.status !== 'pending') {
                    employee.status = 'pending';
                    employee.approved_by = null;
                    employee.approved_date = null;
                    await employee.save({ transaction: t });
                    logger.info(`Employee status reverted to 'pending'`, { employeeId: employee.id });
                }

                return { success: true, message: 'Employee groups updated successfully.' };
            });

            res.status(200).json(result);

        } catch (error) {
            logger.error('Error assigning employee to groups', {
                employee_id,
                groups: newGroupIds,
                error: error.message,
                stack: error.stack
            });

            const statusCode = error.statusCode || 500;
            const message = error.message || 'An internal server error occurred while assigning groups.';
            res.status(statusCode).json({ success: false, message });
        }
    }

    /**
     * Bloquear a un empleado de un grupo específico.
     * POST /api/onboarding/block-group
     */
    async blockFromGroup(req, res) {
        const { employee_id, group_id } = req.body;

        try {
            const blockedStatusId = await getStatusId('blocked');

            const assignment = await EmployeeTelegramGroup.findOne({
                where: {
                    employee_id: employee_id,
                    telegram_group_id: group_id
                }
            });

            if (!assignment) {
                logger.warn('Attempted to block a non-existent group assignment', { employee_id, group_id });
                return res.status(404).json({ 
                    success: false, 
                    message: 'Group assignment not found for this employee.' 
                });
            }

            // Actualizar el estado a 'blocked'
            assignment.status_id = blockedStatusId; // Usar ID dinámico
            assignment.blocked_at = new Date();
            await assignment.save();

            logger.info('Employee successfully blocked from group', { employee_id, group_id });

            res.status(200).json({
                success: true,
                message: 'Employee successfully blocked from the group.'
            });

        } catch (error) {
            logger.error('Error blocking employee from group', {
                employee_id,
                group_id,
                error: error.message,
                stack: error.stack
            });

            res.status(500).json({ 
                success: false, 
                message: 'An internal server error occurred while blocking the employee from the group.' 
            });
        }
    }
}

module.exports = new OnboardingController();
