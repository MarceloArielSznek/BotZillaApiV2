const { Shift, Job, CrewMember, Branch, Estimate, JobSpecialShift, SpecialShift, JobStatus } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');

/**
 * Obtener todos los shifts pendientes de aprobación
 */
const getPendingShifts = async (req, res) => {
    try {
        const { branch_id, limit = 50, offset = 0 } = req.query;
        
        const whereCondition = {
            approved_shift: false
        };

        // Filtrar por branch si se especifica
        let includeCondition = [
            {
                model: CrewMember,
                as: 'crewMember',
                attributes: ['id', 'name', 'is_leader']
            },
            {
                model: Job,
                as: 'job',
                attributes: ['id', 'name', 'branch_id', 'closing_date'],
                include: [
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'customer_name']
                    }
                ]
            }
        ];

        // Si se especifica branch_id, agregar filtro
        if (branch_id) {
            includeCondition[1].where = { branch_id: parseInt(branch_id) };
        }

        // Obtener shifts regulares pendientes
        const pendingShifts = await Shift.findAndCountAll({
            where: whereCondition,
            include: includeCondition,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['crew_member_id', 'ASC'], ['job_id', 'ASC']]
        });

        // Obtener special shifts pendientes
        const specialShiftInclude = [
            {
                model: SpecialShift,
                as: 'specialShift',
                attributes: ['id', 'name']
            },
            {
                model: Job,
                as: 'job',
                attributes: ['id', 'name', 'branch_id', 'closing_date'],
                include: [
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'customer_name']
                    }
                ]
            }
        ];

        // Filtrar special shifts por branch si se especifica
        const specialShiftWhere = { approved_shift: false };
        if (branch_id) {
            specialShiftInclude[1].where = { branch_id: parseInt(branch_id) };
        }

        const pendingSpecialShifts = await JobSpecialShift.findAll({
            where: specialShiftWhere,
            include: specialShiftInclude,
            order: [['special_shift_id', 'ASC'], ['job_id', 'ASC']]
        });

        // Agrupar por job para mejor organización
        const groupedByJob = pendingShifts.rows.reduce((acc, shift) => {
            const jobId = shift.job.id;
            if (!acc[jobId]) {
                acc[jobId] = {
                    job: {
                        id: shift.job.id,
                        name: shift.job.name,
                        branch: shift.job.branch,
                        estimate: shift.job.estimate,
                        closing_date: shift.job.closing_date
                    },
                    shifts: [],
                    specialShifts: []
                };
            }
            acc[jobId].shifts.push({
                crew_member_id: shift.crew_member_id,
                job_id: shift.job_id,
                hours: shift.hours,
                crewMember: shift.crewMember,
                approved_shift: shift.approved_shift,
                type: 'regular'
            });
            return acc;
        }, {});

        // Agregar special shifts al agrupamiento
        pendingSpecialShifts.forEach(specialShift => {
            const jobId = specialShift.job.id;
            if (!groupedByJob[jobId]) {
                groupedByJob[jobId] = {
                    job: {
                        id: specialShift.job.id,
                        name: specialShift.job.name,
                        branch: specialShift.job.branch,
                        estimate: specialShift.job.estimate,
                        closing_date: specialShift.job.closing_date
                    },
                    shifts: [],
                    specialShifts: []
                };
            }
            groupedByJob[jobId].specialShifts.push({
                special_shift_id: specialShift.special_shift_id,
                job_id: specialShift.job_id,
                hours: specialShift.hours,
                specialShift: specialShift.specialShift,
                approved_shift: specialShift.approved_shift,
                type: 'special'
            });
        });

        res.json({
            success: true,
            data: Object.values(groupedByJob),
            total: pendingShifts.count,
            pagination: {
                limit: parseInt(limit),
                offset: parseInt(offset),
                hasMore: pendingShifts.count > (parseInt(offset) + parseInt(limit))
            }
        });

    } catch (error) {
        logger.error('Error fetching pending shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching pending shifts',
            error: error.message
        });
    }
};

/**
 * Aprobar shifts específicos
 */
const approveShifts = async (req, res) => {
    try {
        const { shifts, specialShifts } = req.body;

        if ((!shifts || shifts.length === 0) && (!specialShifts || specialShifts.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'shifts or specialShifts array is required'
            });
        }

        let regularUpdatedCount = 0;
        let specialUpdatedCount = 0;

        // Aprobar shifts regulares
        if (shifts && shifts.length > 0) {
            const orConditions = shifts.map(shift => ({
                [Op.and]: [
                    { crew_member_id: shift.crew_member_id },
                    { job_id: shift.job_id },
                    { approved_shift: false }
                ]
            }));

            const [updatedCount] = await Shift.update(
                { approved_shift: true },
                {
                    where: {
                        [Op.or]: orConditions
                    }
                }
            );
            regularUpdatedCount = updatedCount;
        }

        // Aprobar special shifts
        if (specialShifts && specialShifts.length > 0) {
            const specialOrConditions = specialShifts.map(shift => ({
                [Op.and]: [
                    { special_shift_id: shift.special_shift_id },
                    { job_id: shift.job_id },
                    { approved_shift: false }
                ]
            }));

            const [updatedCount] = await JobSpecialShift.update(
                { approved_shift: true },
                {
                    where: {
                        [Op.or]: specialOrConditions
                    }
                }
            );
            specialUpdatedCount = updatedCount;
        }

        const totalUpdated = regularUpdatedCount + specialUpdatedCount;

        // Obtener todos los job_ids únicos afectados
        const affectedJobIds = new Set();
        if (shifts && shifts.length > 0) {
            shifts.forEach(shift => affectedJobIds.add(shift.job_id));
        }
        if (specialShifts && specialShifts.length > 0) {
            specialShifts.forEach(shift => affectedJobIds.add(shift.job_id));
        }

        // Para cada job, verificar si TODOS los shifts están aprobados y actualizar el estado
        let jobsUpdatedToClosedCount = 0;
        for (const jobId of affectedJobIds) {
            try {
                // Contar shifts regulares pendientes
                const pendingRegularShifts = await Shift.count({
                    where: {
                        job_id: jobId,
                        approved_shift: false
                    }
                });

                // Contar special shifts pendientes
                const pendingSpecialShifts = await JobSpecialShift.count({
                    where: {
                        job_id: jobId,
                        approved_shift: false
                    }
                });

                // Si NO hay shifts pendientes, actualizar el job a "Closed Job"
                if (pendingRegularShifts === 0 && pendingSpecialShifts === 0) {
                    // Obtener el ID del estado "Closed Job"
                    const closedJobStatus = await JobStatus.findOne({
                        where: { name: 'Closed Job' }
                    });

                    if (closedJobStatus) {
                        const job = await Job.findByPk(jobId);
                        
                        // Solo actualizar si el job no está ya en "Closed Job"
                        if (job && job.status_id !== closedJobStatus.id) {
                            await job.update({ 
                                status_id: closedJobStatus.id,
                                closing_date: job.closing_date || new Date() // Mantener closing_date existente o asignar ahora
                            });
                            
                            jobsUpdatedToClosedCount++;
                            
                            logger.info(`Job status updated to "Closed Job" after all shifts approved`, {
                                job_id: jobId,
                                job_name: job.name,
                                previous_status_id: job.status_id,
                                new_status_id: closedJobStatus.id
                            });
                        }
                    }
                }
            } catch (error) {
                logger.error(`Error updating job status for job_id ${jobId}:`, {
                    error: error.message,
                    job_id: jobId
                });
                // No lanzar error, continuar con otros jobs
            }
        }

        logger.info(`Approved ${totalUpdated} shifts (${regularUpdatedCount} regular, ${specialUpdatedCount} special)`, {
            shifts: shifts || [],
            specialShifts: specialShifts || [],
            regularUpdatedCount,
            specialUpdatedCount,
            jobsUpdatedToClosedCount
        });

        res.json({
            success: true,
            message: `${totalUpdated} shifts approved successfully (${regularUpdatedCount} regular, ${specialUpdatedCount} special). ${jobsUpdatedToClosedCount} job(s) updated to "Closed Job" status.`,
            approvedCount: totalUpdated,
            regularApprovedCount: regularUpdatedCount,
            specialApprovedCount: specialUpdatedCount,
            jobsUpdatedToClosedCount
        });

    } catch (error) {
        logger.error('Error approving shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Error approving shifts',
            error: error.message
        });
    }
};

/**
 * Rechazar (eliminar) shifts específicos
 */
const rejectShifts = async (req, res) => {
    try {
        const { shifts, specialShifts } = req.body;

        if ((!shifts || shifts.length === 0) && (!specialShifts || specialShifts.length === 0)) {
            return res.status(400).json({
                success: false,
                message: 'shifts or specialShifts array is required'
            });
        }

        let regularDeletedCount = 0;
        let specialDeletedCount = 0;

        // Rechazar shifts regulares
        if (shifts && shifts.length > 0) {
            const deletedCount = await Shift.destroy({
                where: {
                    [Op.or]: shifts.map(shift => ({
                        [Op.and]: [
                            { crew_member_id: shift.crew_member_id },
                            { job_id: shift.job_id },
                            { approved_shift: false }
                        ]
                    }))
                }
            });
            regularDeletedCount = deletedCount;
        }

        // Rechazar special shifts
        if (specialShifts && specialShifts.length > 0) {
            const deletedCount = await JobSpecialShift.destroy({
                where: {
                    [Op.or]: specialShifts.map(shift => ({
                        [Op.and]: [
                            { special_shift_id: shift.special_shift_id },
                            { job_id: shift.job_id },
                            { approved_shift: false }
                        ]
                    }))
                }
            });
            specialDeletedCount = deletedCount;
        }

        const totalDeleted = regularDeletedCount + specialDeletedCount;

        logger.info(`Rejected (deleted) ${totalDeleted} shifts (${regularDeletedCount} regular, ${specialDeletedCount} special)`, {
            shifts: shifts || [],
            specialShifts: specialShifts || [],
            regularDeletedCount,
            specialDeletedCount
        });

        res.json({
            success: true,
            message: `${totalDeleted} shifts rejected successfully (${regularDeletedCount} regular, ${specialDeletedCount} special)`,
            rejectedCount: totalDeleted,
            regularRejectedCount: regularDeletedCount,
            specialRejectedCount: specialDeletedCount
        });

    } catch (error) {
        logger.error('Error rejecting shifts:', error);
        res.status(500).json({
            success: false,
            message: 'Error rejecting shifts',
            error: error.message
        });
    }
};

/**
 * Obtener estadísticas de shifts pendientes
 */
const getPendingShiftsStats = async (req, res) => {
    try {
        const stats = await Shift.findAll({
            where: { approved_shift: false },
            include: [
                {
                    model: Job,
                    as: 'job',
                    attributes: ['branch_id'],
                    include: [
                        {
                            model: Branch,
                            as: 'branch',
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ],
            attributes: ['crew_member_id', 'job_id', 'hours']
        });

        // Agrupar por branch
        const statsByBranch = stats.reduce((acc, shift) => {
            const branchId = shift.job?.branch_id;
            const branchName = shift.job?.branch?.name || 'Unknown';
            
            if (!acc[branchId]) {
                acc[branchId] = {
                    branchId,
                    branchName,
                    pendingShifts: 0,
                    totalHours: 0
                };
            }
            
            acc[branchId].pendingShifts++;
            acc[branchId].totalHours += parseFloat(shift.hours || 0);
            
            return acc;
        }, {});

        res.json({
            success: true,
            totalPendingShifts: stats.length,
            totalPendingHours: stats.reduce((sum, shift) => sum + parseFloat(shift.hours || 0), 0),
            byBranch: Object.values(statsByBranch)
        });

    } catch (error) {
        logger.error('Error fetching pending shifts stats:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching stats',
            error: error.message
        });
    }
};

module.exports = {
    getPendingShifts,
    approveShifts,
    rejectShifts,
    getPendingShiftsStats
};
