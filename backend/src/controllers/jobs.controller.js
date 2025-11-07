const { Job, Estimate, Branch, SalesPerson, Employee, Shift, SpecialShift, JobSpecialShift, JobStatus, OverrunReport } = require('../models');
const OperationCommandPost = require('../models/OperationCommandPost');
const { logger } = require('../utils/logger');
const { Op, Transaction } = require('sequelize');
const sequelize = require('../config/database');
const { calculateJobPerformance, calculateJobPerformanceFromObject } = require('../services/performance.service');
const jobCreationService = require('../services/jobCreationService');
const axios = require('axios');

/**
 * Helper function to check if a job is overrun and send automatic alert
 * @param {number} jobId - ID del job
 * @param {boolean} forceSend - Si es true, envía aunque ya se haya enviado antes
 * @returns {Promise<{sent: boolean, isOverrun: boolean, error?: string}>}
 */
async function sendAutomaticOverrunAlert(jobId, forceSend = false) {
    try {
        const job = await Job.findByPk(jobId, {
            include: [
                {
                    model: Estimate,
                    as: 'estimate',
                    attributes: ['id', 'name', 'attic_tech_hours'],
                    include: [{
                        model: SalesPerson,
                        as: 'salesperson',
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                },
                {
                    model: Employee,
                    as: 'crewLeader',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                },
                {
                    model: Shift,
                    as: 'shifts',
                    attributes: ['crew_member_id', 'job_id', 'hours', 'approved_shift'],
                    required: false
                },
                {
                    model: JobSpecialShift,
                    as: 'jobSpecialShifts',
                    attributes: ['special_shift_id', 'hours', 'approved_shift'],
                    required: false
                }
            ]
        });

        if (!job) {
            logger.warn('Job not found for automatic overrun alert', { job_id: jobId });
            return { sent: false, isOverrun: false, error: 'Job not found' };
        }

        // Calcular horas trabajadas
        const shifts = job.shifts || [];
        const specialShifts = job.jobSpecialShifts || [];
        const regularHours = shifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
        const specialHours = specialShifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
        const totalWorkedHours = regularHours + specialHours;

        // AT estimated hours
        const atEstimatedHours = parseFloat(job.attic_tech_hours || job.estimate?.attic_tech_hours || 0);

        // Verificar si es overrun
        const isOverrun = totalWorkedHours > atEstimatedHours && atEstimatedHours > 0;

        if (!isOverrun) {
            logger.info('Job is not overrun, skipping automatic alert', {
                job_id: jobId,
                job_name: job.name,
                total_worked_hours: totalWorkedHours,
                at_estimated_hours: atEstimatedHours
            });
            return { sent: false, isOverrun: false };
        }

        // Verificar si ya se envió la notificación automática (a menos que sea forceSend)
        if (!forceSend && job.overrun_alert_sent) {
            logger.info('Automatic overrun alert already sent for this job', {
                job_id: jobId,
                job_name: job.name
            });
            return { sent: false, isOverrun: true, alreadySent: true };
        }

        // Preparar payload para Make.com (formato que espera Make.com)
        const clEstimatedHours = parseFloat(job.cl_estimated_plan_hours || 0);
        const hoursSaved = atEstimatedHours - totalWorkedHours;

        const payload = {
            job_id: job.id,
            branch: job.branch?.name || 'N/A',
            job_name: job.name,
            sales_person: job.estimate?.salesperson?.name || 'N/A', // Usar sales_person para coincidir con Make.com
            crew_leader: job.crewLeader ? `${job.crewLeader.first_name} ${job.crewLeader.last_name}` : 'N/A',
            closing_date: job.closing_date ? new Date(job.closing_date).toLocaleDateString('en-US') : 'N/A', // Usar closing_date para coincidir con Make.com
            at_estimated_hours: parseFloat(atEstimatedHours.toFixed(2)),
            total_hours_worked: parseFloat(totalWorkedHours.toFixed(2)),
            hours_saved: parseFloat(hoursSaved.toFixed(2))
        };

        // Enviar a Make.com webhook
        const webhookUrl = process.env.MAKE_OVERRUN_ALERT_WEBHOOK_URL;

        if (!webhookUrl) {
            logger.error('MAKE_OVERRUN_ALERT_WEBHOOK_URL is not configured');
            return { sent: false, isOverrun: true, error: 'Webhook URL not configured' };
        }

        await axios.post(webhookUrl, payload);

        // Marcar como enviado solo si no es forceSend (forceSend es para envíos manuales)
        if (!forceSend) {
            await job.update({ overrun_alert_sent: true });
        }

        logger.info('Automatic overrun alert sent successfully', {
            job_id: jobId,
            job_name: job.name,
            hours_saved: hoursSaved,
            force_send: forceSend
        });

        return { sent: true, isOverrun: true, payload };

    } catch (error) {
        logger.error('Error sending automatic overrun alert', {
            error: error.message,
            stack: error.stack,
            job_id: jobId
        });
        return { sent: false, isOverrun: false, error: error.message };
    }
}

/**
 * Helper function to send automatic overrun alerts for multiple jobs in batch
 * Envía todos los jobs overrun en un solo array al webhook de Make.com
 * @param {number[]} jobIds - Array de IDs de jobs a verificar
 * @param {boolean} forceSend - Si es true, envía aunque ya se haya enviado antes
 * @returns {Promise<{sent: number, total: number, jobs: Array}>}
 */
async function sendBulkAutomaticOverrunAlerts(jobIds, forceSend = false) {
    const results = {
        sent: 0,
        total: jobIds.length,
        jobs: [],
        errors: []
    };

    if (!jobIds || jobIds.length === 0) {
        return results;
    }

    try {
        // Obtener todos los jobs con sus relaciones
        const jobs = await Job.findAll({
            where: { id: jobIds },
            include: [
                {
                    model: Estimate,
                    as: 'estimate',
                    attributes: ['id', 'name', 'attic_tech_hours'],
                    include: [{
                        model: SalesPerson,
                        as: 'salesperson',
                        attributes: ['id', 'name']
                    }]
                },
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                },
                {
                    model: Employee,
                    as: 'crewLeader',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                },
                {
                    model: Shift,
                    as: 'shifts',
                    attributes: ['crew_member_id', 'job_id', 'hours', 'approved_shift'],
                    required: false
                },
                {
                    model: JobSpecialShift,
                    as: 'jobSpecialShifts',
                    attributes: ['special_shift_id', 'hours', 'approved_shift'],
                    required: false
                }
            ]
        });

        const overrunJobs = [];

        logger.info(`Starting bulk overrun alert check for ${jobs.length} jobs`, {
            job_ids: jobs.map(j => j.id),
            job_names: jobs.map(j => j.name)
        });

        // Procesar cada job y determinar si es overrun
        for (const job of jobs) {
            try {
                // Calcular horas trabajadas
                const shifts = job.shifts || [];
                const specialShifts = job.jobSpecialShifts || [];
                const regularHours = shifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
                const specialHours = specialShifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
                const totalWorkedHours = regularHours + specialHours;

                // AT estimated hours
                const atEstimatedHours = parseFloat(job.attic_tech_hours || job.estimate?.attic_tech_hours || 0);

                // Verificar si es overrun
                const isOverrun = totalWorkedHours > atEstimatedHours && atEstimatedHours > 0;

                logger.info(`Checking job for overrun status`, {
                    job_id: job.id,
                    job_name: job.name,
                    total_worked_hours: totalWorkedHours,
                    at_estimated_hours: atEstimatedHours,
                    is_overrun: isOverrun,
                    overrun_alert_sent: job.overrun_alert_sent,
                    force_send: forceSend
                });

                if (!isOverrun) {
                    logger.info(`Job is not overrun, skipping`, {
                        job_id: job.id,
                        job_name: job.name
                    });
                    continue; // Saltar jobs que no son overrun
                }

                // Verificar si ya se envió la notificación automática (a menos que sea forceSend)
                if (!forceSend && job.overrun_alert_sent) {
                    logger.info('Automatic overrun alert already sent for this job, skipping', {
                        job_id: job.id,
                        job_name: job.name
                    });
                    continue; // Saltar jobs que ya tienen alert enviado
                }

                // Preparar payload para Make.com (formato que espera Make.com)
                const clEstimatedHours = parseFloat(job.cl_estimated_plan_hours || 0);
                const hoursSaved = atEstimatedHours - totalWorkedHours;

                const payload = {
                    job_id: job.id,
                    branch: job.branch?.name || 'N/A',
                    job_name: job.name,
                    sales_person: job.estimate?.salesperson?.name || 'N/A', // Usar sales_person para coincidir con Make.com
                    crew_leader: job.crewLeader ? `${job.crewLeader.first_name} ${job.crewLeader.last_name}` : 'N/A',
                    closing_date: job.closing_date ? new Date(job.closing_date).toLocaleDateString('en-US') : 'N/A', // Usar closing_date para coincidir con Make.com
                    at_estimated_hours: parseFloat(atEstimatedHours.toFixed(2)),
                    total_hours_worked: parseFloat(totalWorkedHours.toFixed(2)),
                    hours_saved: parseFloat(hoursSaved.toFixed(2))
                };

                overrunJobs.push(payload);
                results.jobs.push({ job_id: job.id, job_name: job.name });

            } catch (error) {
                logger.error('Error processing job for overrun alert', {
                    job_id: job.id,
                    error: error.message
                });
                results.errors.push({ job_id: job.id, error: error.message });
            }
        }

        // Si hay jobs overrun, enviarlos todos juntos en un array
        if (overrunJobs.length > 0) {
            const webhookUrl = process.env.MAKE_OVERRUN_ALERT_WEBHOOK_URL;

            if (!webhookUrl) {
                logger.error('MAKE_OVERRUN_ALERT_WEBHOOK_URL is not configured');
                results.errors.push({ error: 'Webhook URL not configured' });
                return results;
            }

            // Enviar array de jobs al webhook (formato que espera Make.com)
            await axios.post(webhookUrl, { jobs: overrunJobs });

            // Marcar como enviado solo si no es forceSend
            if (!forceSend) {
                const jobIdsToUpdate = overrunJobs.map(j => j.job_id);
                await Job.update(
                    { overrun_alert_sent: true },
                    { where: { id: jobIdsToUpdate } }
                );
            }

            results.sent = overrunJobs.length;

            logger.info('Bulk automatic overrun alerts sent successfully', {
                jobs_sent: overrunJobs.length,
                total_jobs_checked: jobIds.length,
                job_ids: overrunJobs.map(j => j.job_id)
            });
        } else {
            logger.info('No overrun jobs found to send automatic alerts', {
                total_jobs_checked: jobIds.length
            });
        }

        return results;

    } catch (error) {
        logger.error('Error sending bulk automatic overrun alerts', {
            error: error.message,
            stack: error.stack,
            job_ids: jobIds
        });
        results.errors.push({ error: error.message });
        return results;
    }
}

class JobsController {
    async getAllJobs(req, res) {
        try {
            const { page = 1, limit = 10, branchId, salespersonId, crewLeaderId, statusId, startDate, endDate, search, inPayload } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (branchId) whereClause.branch_id = branchId;
            if (crewLeaderId) whereClause.crew_leader_id = crewLeaderId;
            if (statusId) whereClause.status_id = statusId;
            if (startDate && endDate) {
                whereClause.closing_date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }
            if (search) {
                whereClause.name = { [Op.iLike]: `%${search}%` };
            }
            // Filtro de inPayload: convertir string a boolean
            if (inPayload !== undefined && inPayload !== '') {
                const boolValue = inPayload === 'true';
                whereClause.in_payload = boolValue;
                logger.info('Filtering by inPayload', { 
                    inPayload_received: inPayload, 
                    inPayload_type: typeof inPayload,
                    inPayload_boolean: boolValue 
                });
            }

            const includeWhereClause = {
                estimate: {},
            };
            if (salespersonId) {
                includeWhereClause.estimate.sales_person_id = salespersonId;
            }

            const { count, rows: jobs } = await Job.findAndCountAll({
                where: whereClause,
                include: [
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'attic_tech_hours'],
                        where: includeWhereClause.estimate,
                        required: !!salespersonId,
                        include: [{
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        attributes: ['crew_member_id', 'job_id', 'hours', 'approved_shift', 'performance_status'],
                        required: false
                    },
                    {
                        model: JobSpecialShift,
                        as: 'jobSpecialShifts',
                        attributes: ['special_shift_id', 'hours', 'approved_shift'],
                        required: false
                    }
                ],
                order: [['closing_date', 'DESC']],
                limit: parseInt(limit),
                offset: offset,
                distinct: true // Necesario para un conteo correcto con joins
            });

            // Formatear jobs con información de shifts aprobados y overrun
            const formattedJobs = jobs.map(job => {
                const jobData = job.toJSON();
                const shifts = jobData.shifts || [];
                const specialShifts = jobData.jobSpecialShifts || [];
                
                const approvedShifts = shifts.filter(s => s.approved_shift === true).length;
                const totalShifts = shifts.length;
                
                // Calcular si es overrun
                // Obtener horas estimadas del job o del estimate relacionado
                const atHours = parseFloat(jobData.attic_tech_hours || jobData.estimate?.attic_tech_hours || 0);
                const regularHours = shifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
                const specialHours = specialShifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
                const totalWorkedHours = regularHours + specialHours;
                // Es overrun si trabajaron más horas de las estimadas
                const isOverrun = totalWorkedHours > atHours && atHours > 0;
                
                // Debug log para jobs específicos
                if (jobData.name && jobData.name.includes('Lorie')) {
                    logger.info('🔍 DEBUG Overrun Calculation', {
                        jobName: jobData.name,
                        attic_tech_hours_job: jobData.attic_tech_hours,
                        attic_tech_hours_estimate: jobData.estimate?.attic_tech_hours,
                        atHours: atHours,
                        regularHours: regularHours,
                        specialHours: specialHours,
                        totalWorkedHours: totalWorkedHours,
                        isOverrun: isOverrun,
                        shiftsCount: shifts.length,
                        specialShiftsCount: specialShifts.length
                    });
                }
                
                // Formatear crew leader para incluir 'name' concatenado
                let formattedCrewLeader = null;
                if (jobData.crewLeader) {
                    formattedCrewLeader = {
                        ...jobData.crewLeader,
                        name: `${jobData.crewLeader.first_name} ${jobData.crewLeader.last_name}`.trim()
                    };
                }
                
                return {
                    ...jobData,
                    crewLeader: formattedCrewLeader,
                    shifts_approved: approvedShifts,
                    shifts_total: totalShifts,
                    shifts_status: totalShifts === 0 ? 'No shifts' : 
                                   approvedShifts === totalShifts ? 'All approved' :
                                   approvedShifts === 0 ? 'None approved' :
                                   `${approvedShifts}/${totalShifts} approved`,
                    is_overrun: isOverrun,
                    total_worked_hours: totalWorkedHours,
                    // Remover shifts del response para no enviar data innecesaria
                    shifts: undefined,
                    jobSpecialShifts: undefined
                };
            });

            res.status(200).json({
                success: true,
                data: formattedJobs,
                pagination: {
                    total: count,
                    pages: Math.ceil(count / limit),
                    currentPage: parseInt(page)
                }
            });
        } catch (error) {
            logger.error('Error fetching all jobs:', error);
            res.status(500).json({ success: false, message: 'Server error fetching jobs.' });
        }
    }

    async getJobById(req, res) {
        try {
            const { id } = req.params;
            const job = await Job.findByPk(id, {
                include: [
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'attic_tech_hours'],
                        include: [{
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        include: [{
                            model: Employee,
                            as: 'crewMember',
                            attributes: ['id', 'first_name', 'last_name']
                        }]
                    },
                    {
                        model: JobSpecialShift,
                        as: 'jobSpecialShifts',
                        include: [{
                            model: SpecialShift,
                            as: 'specialShift',
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: OperationCommandPost,
                        as: 'operationPost',
                        required: false
                    }
                ]
            });

            if (!job) {
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            // Formatear shifts para incluir nombre completo
            const formattedJob = job.toJSON();
            if (formattedJob.shifts) {
                formattedJob.shifts = formattedJob.shifts.map(shift => ({
                    ...shift,
                    crewMember: shift.crewMember ? {
                        ...shift.crewMember,
                        name: `${shift.crewMember.first_name} ${shift.crewMember.last_name}`
                    } : null
                }));
            }

            logger.info('Job details fetched', {
                job_id: job.id,
                job_name: job.name,
                shifts_count: formattedJob.shifts?.length || 0
            });

            res.status(200).json({ success: true, data: formattedJob });
        } catch (error) {
            logger.error(`Error fetching job with id ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error fetching job details.' });
        }
    }

    async deleteJob(req, res) {
        const transaction = await sequelize.transaction({
            isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
            lock: Transaction.LOCK.UPDATE
        });
        
        try {
            const { id } = req.params;
            logger.info(`🗑️ Iniciando eliminación del job ${id}`);
            
            const job = await Job.findByPk(id);

            if (!job) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            logger.info(`🗑️ Job encontrado: ${job.name}. Eliminando shifts relacionados...`);
            
            // Manually delete related shifts due to composite keys
            const shiftsDeleted = await Shift.destroy({ where: { job_id: id }, transaction });
            logger.info(`✅ ${shiftsDeleted} regular shifts eliminados`);
            
            const specialShiftsDeleted = await JobSpecialShift.destroy({ where: { job_id: id }, transaction });
            logger.info(`✅ ${specialShiftsDeleted} special shifts eliminados`);
            
            logger.info(`🗑️ Eliminando job ${id}...`);
            await job.destroy({ transaction });
            
            await transaction.commit();
            logger.info(`✅ Job ${id} eliminado exitosamente`);
            
            res.status(200).json({ success: true, message: 'Job and associated shifts deleted successfully.' });
        } catch (error) {
            try {
                await transaction.rollback();
                logger.error(`❌ Rollback exitoso para job ${req.params.id}`);
            } catch (rollbackError) {
                logger.error(`❌ Error en rollback para job ${req.params.id}:`, rollbackError);
            }
            logger.error(`❌ Error eliminando job ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error deleting job.', error: error.message });
        }
    }

    async createJob(req, res) {
        try {
            const { name, closing_date, estimate_id, crew_leader_id, branch_id, note, review, crew_leader_hours } = req.body;
            
            if (!name || !branch_id) {
                return res.status(400).json({ success: false, message: 'Name and Branch are required.' });
            }

            const newJob = await Job.create({
                name,
                closing_date,
                estimate_id,
                crew_leader_id,
                branch_id,
                note,
                review,
                crew_leader_hours
            });

            res.status(201).json({ success: true, data: newJob, message: 'Job created successfully.' });
        } catch (error) {
            logger.error('Error creating job:', error);
            res.status(500).json({ success: false, message: 'Server error creating job.' });
        }
    }

    async updateJob(req, res) {
        try {
            const { id } = req.params;
            const { name, closing_date, estimate_id, crew_leader_id, branch_id, note, review, crew_leader_hours, status_id, in_payload } = req.body;

            const job = await Job.findByPk(id);
            if (!job) {
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            // Construir objeto de actualización solo con campos válidos
            const updateData = {};
            
            if (name !== undefined) updateData.name = name;
            if (estimate_id !== undefined) updateData.estimate_id = estimate_id;
            if (crew_leader_id !== undefined) updateData.crew_leader_id = crew_leader_id;
            if (branch_id !== undefined) updateData.branch_id = branch_id;
            if (note !== undefined) updateData.note = note;
            if (review !== undefined) updateData.review = review;
            if (crew_leader_hours !== undefined) updateData.crew_leader_hours = crew_leader_hours;
            if (in_payload !== undefined) updateData.in_payload = in_payload;
            
            // Lógica especial para status_id y closing_date
            if (status_id !== undefined) {
                updateData.status_id = status_id;
                
                // Si el status cambia a "Closed Job", setear closing_date automáticamente
                if (status_id) {
                    const newStatus = await JobStatus.findByPk(status_id);
                    if (newStatus && newStatus.name === 'Closed Job' && !job.closing_date) {
                        updateData.closing_date = new Date();
                        logger.info(`Job ${id} status changed to "Closed Job". Setting closing_date automatically.`);
                    }
                }
            }
            
            // Permitir override manual de closing_date solo si se proporciona explícitamente
            if (closing_date !== undefined && closing_date !== null && closing_date !== '') {
                const parsedDate = new Date(closing_date);
                if (!isNaN(parsedDate.getTime())) {
                    updateData.closing_date = parsedDate;
                } else {
                    logger.warn(`Invalid closing_date provided: ${closing_date}`);
                }
            }

            await job.update(updateData);

            // Recargar el job con las asociaciones para devolver datos completos
            const updatedJob = await Job.findByPk(id, {
                include: [
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    }
                ]
            });

            res.status(200).json({ success: true, data: updatedJob, message: 'Job updated successfully.' });
        } catch (error) {
            logger.error(`Error updating job with id ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error updating job.' });
        }
    }

    async addOrUpdateShifts(req, res) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const { regularShifts, specialShifts } = req.body;

            const job = await Job.findByPk(id, { transaction });
            if (!job) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            // Limpiar shifts existentes
            await Shift.destroy({ where: { job_id: id }, transaction });
            await JobSpecialShift.destroy({ where: { job_id: id }, transaction });
            
            // Procesar shifts regulares
            if (regularShifts && regularShifts.length > 0) {
                const shiftsToCreate = regularShifts.map(s => ({
                    job_id: id,
                    crew_member_id: s.crew_member_id,
                    hours: parseFloat(s.hours) || 0,
                    is_leader: s.is_leader,
                    date: new Date()
                }));
                await Shift.bulkCreate(shiftsToCreate, { transaction });
            }

            // Procesar shifts especiales
            if (specialShifts && specialShifts.length > 0) {
                const specialShiftsToCreate = specialShifts.map(s => ({
                    job_id: id,
                    special_shift_id: s.special_shift_id,
                    hours: parseFloat(s.hours) || 0,
                    date: new Date()
                }));
                await JobSpecialShift.bulkCreate(specialShiftsToCreate, { transaction });
            }

            await transaction.commit();
            res.status(200).json({ success: true, message: 'Shifts updated successfully.' });
        } catch (error) {
            await transaction.rollback();
            logger.error(`Error updating shifts for job with id ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error updating shifts.' });
        }
    }

    async getJobPerformance(req, res) {
        try {
            const { id } = req.params;
            const performanceData = await calculateJobPerformance(id);
            res.status(200).json({ success: true, data: performanceData });
        } catch (error) {
            logger.error(`Error fetching job performance for id ${req.params.id}:`, error);
            const statusCode = error.message === 'Job not found.' ? 404 : 500;
            res.status(statusCode).json({ success: false, message: error.message });
        }
    }

    /**
     * Crear jobs automáticamente desde estimates "Sold"
     */
    async createJobsFromSoldEstimates(req, res) {
        try {
            logger.info('🚀 Iniciando creación automática de jobs desde estimates Sold...');
            
            const result = await jobCreationService.createJobsFromSoldEstimates();
            
            res.status(200).json({
                success: true,
                message: result.message,
                created: result.created,
                jobs: result.jobs || []
            });

        } catch (error) {
            logger.error('❌ Error en createJobsFromSoldEstimates:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating jobs from sold estimates',
                error: error.message
            });
        }
    }

    /**
     * Marcar un job como "Closed Job"
     */
    async markJobAsDone(req, res) {
        try {
            const { id } = req.params;
            
            const job = await jobCreationService.markJobAsClosedJob(id);
            
            res.status(200).json({
                success: true,
                message: `Job ${job.name} marked as Closed Job`,
                job: job
            });

        } catch (error) {
            logger.error(`❌ Error marcando job ${req.params.id} como Closed Job:`, error);
            const statusCode = error.message.includes('not found') ? 404 : 500;
            res.status(statusCode).json({
                success: false,
                message: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de jobs por status
     */
    async getJobStatusStats(req, res) {
        try {
            const stats = await jobCreationService.getJobStatusStats();
            
            res.status(200).json({
                success: true,
                data: stats
            });

        } catch (error) {
            logger.error('❌ Error obteniendo estadísticas de job status:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching job status statistics',
                error: error.message
            });
        }
    }

    /**
     * Enviar overrun job alert a Make.com webhook
     */
    async sendOverrunAlert(req, res) {
        try {
            const { id } = req.params;
            
            const job = await Job.findByPk(id, {
                include: [
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'attic_tech_hours'],
                        include: [{
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        attributes: ['crew_member_id', 'job_id', 'hours', 'approved_shift'],
                        required: false
                    },
                    {
                        model: JobSpecialShift,
                        as: 'jobSpecialShifts',
                        attributes: ['special_shift_id', 'hours', 'approved_shift'],
                        required: false
                    }
                ]
            });
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }
            
            // Calcular horas trabajadas
            const shifts = job.shifts || [];
            const specialShifts = job.jobSpecialShifts || [];
            const regularHours = shifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
            const specialHours = specialShifts.reduce((acc, s) => acc + parseFloat(s.hours || 0), 0);
            const totalWorkedHours = regularHours + specialHours;
            
            // AT estimated hours
            const atEstimatedHours = parseFloat(job.attic_tech_hours || job.estimate?.attic_tech_hours || 0);
            
            // CL estimated hours
            const clEstimatedHours = parseFloat(job.cl_estimated_plan_hours || 0);
            
            // Hours saved (negativo si es overrun)
            const hoursSaved = atEstimatedHours - totalWorkedHours;
            
            // Preparar payload para Make.com (con formato de 2 decimales)
            const payload = {
                job_id: job.id,
                branch: job.branch?.name || 'N/A',
                job_name: job.name,
                estimator: job.estimate?.salesperson?.name || 'N/A',
                crew_leader: job.crewLeader ? `${job.crewLeader.first_name} ${job.crewLeader.last_name}` : 'N/A',
                finish_date: job.closing_date ? new Date(job.closing_date).toLocaleDateString('en-US') : 'N/A',
                at_estimated_hours: parseFloat(atEstimatedHours.toFixed(2)),
                cl_estimated_hours: parseFloat(clEstimatedHours.toFixed(2)),
                total_hours_worked: parseFloat(totalWorkedHours.toFixed(2)),
                hours_saved: parseFloat(hoursSaved.toFixed(2))
            };
            
            logger.info('Sending overrun alert to Make.com', {
                job_id: id,
                job_name: job.name,
                hours_saved: hoursSaved
            });
            
            // Enviar a Make.com webhook
            const axios = require('axios');
            const webhookUrl = process.env.MAKE_OVERRUN_ALERT_WEBHOOK_URL;
            
            if (!webhookUrl) {
                throw new Error('MAKE_OVERRUN_ALERT_WEBHOOK_URL is not configured');
            }
            
            await axios.post(webhookUrl, payload);
            
            logger.info('Overrun alert sent successfully', {
                job_id: id,
                job_name: job.name
            });
            
            return res.status(200).json({
                success: true,
                message: 'Overrun alert sent successfully',
                data: payload
            });
            
        } catch (error) {
            logger.error('Error sending overrun alert', {
                error: error.message,
                stack: error.stack,
                job_id: req.params.id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send overrun alert',
                error: error.message
            });
        }
    }

    /**
     * Recibir y guardar reporte de overrun desde Make.com (AI Agent)
     */
    async saveOverrunReport(req, res) {
        try {
            const { job_id, report } = req.body;
            
            // Validar campos requeridos
            if (!job_id) {
                return res.status(400).json({
                    success: false,
                    message: 'job_id is required'
                });
            }
            
            if (!report) {
                return res.status(400).json({
                    success: false,
                    message: 'report is required'
                });
            }
            
            // Verificar que el job existe
            const job = await Job.findByPk(job_id);
            
            if (!job) {
                return res.status(404).json({
                    success: false,
                    message: 'Job not found'
                });
            }
            
            logger.info('Receiving overrun report from Make.com', {
                job_id,
                job_name: job.name,
                report_length: report.length
            });
            
            // Crear el overrun report
            const overrunReport = await OverrunReport.create({
                report: report
            });
            
            // Actualizar el job con el overrun_report_id
            await job.update({
                overrun_report_id: overrunReport.id
            });
            
            logger.info('Overrun report saved successfully', {
                job_id,
                job_name: job.name,
                overrun_report_id: overrunReport.id
            });
            
            return res.status(200).json({
                success: true,
                message: 'Overrun report saved successfully',
                data: {
                    overrun_report_id: overrunReport.id,
                    job_id: job_id,
                    job_name: job.name
                }
            });
            
        } catch (error) {
            logger.error('Error saving overrun report', {
                error: error.message,
                stack: error.stack,
                job_id: req.body.job_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to save overrun report',
                error: error.message
            });
        }
    }

    /**
     * Obtener jobs con overrun (% Actual Saved negativo)
     */
    async getOverrunJobs(req, res) {
        try {
            const { page = 1, limit = 1000, branchId, startDate, endDate, search } = req.query;
            const offset = (page - 1) * limit;

            // Buscar el status "Closed Job"
            const closedJobStatus = await JobStatus.findOne({ where: { name: 'Closed Job' } });
            
            const whereClause = {};
            if (closedJobStatus) {
                whereClause.status_id = closedJobStatus.id;
            }
            
            if (branchId) whereClause.branch_id = branchId;
            if (startDate && endDate) {
                whereClause.closing_date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }
            if (search) {
                whereClause.name = { [Op.iLike]: `%${search}%` };
            }

            const { count, rows: jobs } = await Job.findAndCountAll({
                where: whereClause,
                attributes: [
                    'id', 'name', 'closing_date', 'sold_price', 
                    'attic_tech_hours', 'cl_estimated_plan_hours',
                    'branch_id', 'crew_leader_id', 'status_id', 'estimate_id',
                    'overrun_report_id', // Agregado para saber si ya tiene reporte
                    'operation_post_id', // Agregado para saber si ya tiene operation post
                    'overrun_alert_sent' // Agregado para saber si ya se envió alert automático
                ],
                include: [
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name', 'attic_tech_hours'],
                        include: [{
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }]
                    },
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        attributes: ['crew_member_id', 'job_id', 'hours', 'approved_shift'],
                        required: false
                    },
                    {
                        model: JobSpecialShift,
                        as: 'jobSpecialShifts',
                        attributes: ['special_shift_id', 'hours', 'approved_shift'],
                        required: false
                    },
                    {
                        model: OverrunReport,
                        as: 'overrunReport',
                        attributes: ['id', 'report', 'created_at'],
                        required: false
                    },
                    {
                        model: OperationCommandPost,
                        as: 'operationPost',
                        attributes: ['id', 'post', 'created_at'],
                        required: false
                    }
                ],
                order: [['closing_date', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Calcular performance para todos los closed jobs
            const jobsWithPerformance = jobs.map(job => {
                const performance = calculateJobPerformanceFromObject(job);
                return {
                    id: job.id,
                    name: job.name,
                    closing_date: job.closing_date,
                    sold_price: job.sold_price,
                    branch: job.branch ? {
                        id: job.branch.id,
                        name: job.branch.name
                    } : null,
                    crew_leader: job.crewLeader ? {
                        id: job.crewLeader.id,
                        name: `${job.crewLeader.first_name} ${job.crewLeader.last_name}`
                    } : null,
                    estimator: job.estimate?.salesperson?.name || null,
                    status: job.status ? {
                        id: job.status.id,
                        name: job.status.name
                    } : null,
                    at_estimated_hours: performance.atEstimatedHours,
                    cl_plan_hours: performance.clPlanHours,
                    total_worked_hours: performance.totalWorkedHours,
                    total_saved_hours: performance.totalSavedHours,
                    percent_planned_to_save: performance.percentPlannedToSave,
                    actual_percent_saved: performance.actualPercentSaved,
                    potential_bonus_pool: performance.potentialBonusPool,
                    job_bonus_pool: performance.jobBonusPool,
                    shifts_approved: performance.shiftsApproved,
                    shifts_total: performance.shiftsTotal,
                    shifts_status: performance.shiftsTotal === 0 ? 'No shifts' : 
                                   performance.shiftsApproved === performance.shiftsTotal ? 'All approved' :
                                   performance.shiftsApproved === 0 ? 'None approved' :
                                   `${performance.shiftsApproved}/${performance.shiftsTotal} approved`,
                    overrun_report_id: job.overrun_report_id,
                    overrun_report: job.overrunReport ? {
                        id: job.overrunReport.id,
                        report: job.overrunReport.report,
                        created_at: job.overrunReport.created_at
                    } : null,
                    overrun_alert_sent: job.overrun_alert_sent || false, // Indicar si ya se envió alert automático
                    operation_post_id: job.operation_post_id,
                    operation_post: job.operationPost ? {
                        id: job.operationPost.id,
                        post: job.operationPost.post,
                        created_at: job.operationPost.created_at
                    } : null,
                    crew_leader_name: job.crewLeader 
                        ? (job.crewLeader.last_name && job.crewLeader.last_name.trim() !== '' 
                            ? `${job.crewLeader.first_name} ${job.crewLeader.last_name}`.trim()
                            : job.crewLeader.first_name)
                        : null
                };
            }); // Retornar TODOS los closed jobs para que el frontend filtre por overrun o operation command

            logger.info('Job analysis data retrieved', {
                total: count,
                jobs_count: jobsWithPerformance.length,
                page,
                limit
            });

            res.status(200).json({
                success: true,
                data: jobsWithPerformance,
                pagination: {
                    total: jobsWithPerformance.length,
                    pages: Math.ceil(jobsWithPerformance.length / limit),
                    currentPage: parseInt(page)
                }
            });

        } catch (error) {
            logger.error('Error retrieving overrun jobs', {
                error: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: 'Error retrieving overrun jobs',
                error: error.message
            });
        }
    }

}

module.exports = {
    JobsController, // Exportar la clase, no una instancia
    sendAutomaticOverrunAlert, // Función individual (mantener para compatibilidad)
    sendBulkAutomaticOverrunAlerts // Función para enviar múltiples jobs en batch
}; 