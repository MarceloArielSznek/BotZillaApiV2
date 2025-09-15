const { Job, Estimate, Branch, SalesPerson, CrewMember, Shift, SpecialShift, JobSpecialShift, JobStatus } = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { calculateJobPerformance } = require('../services/performance.service');
const jobCreationService = require('../services/jobCreationService');

class JobsController {
    async getAllJobs(req, res) {
        try {
            const { page = 1, limit = 10, branchId, salespersonId, crewLeaderId, startDate, endDate, search } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (branchId) whereClause.branch_id = branchId;
            if (crewLeaderId) whereClause.crew_leader_id = crewLeaderId;
            if (startDate && endDate) {
                whereClause.closing_date = { [Op.between]: [new Date(startDate), new Date(endDate)] };
            }
            if (search) {
                whereClause.name = { [Op.iLike]: `%${search}%` };
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
                        attributes: ['id', 'name'],
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
                        model: CrewMember,
                        as: 'crewLeader',
                        attributes: ['id', 'name']
                    },
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    }
                ],
                order: [['closing_date', 'DESC']],
                limit: parseInt(limit),
                offset: offset,
                distinct: true // Necesario para un conteo correcto con joins
            });

            // Log para verificar los crew leaders asignados
            console.log('👷 Jobs con crew leaders:', jobs.map(job => ({
                jobId: job.id,
                jobName: job.name,
                crewLeaderId: job.crew_leader_id,
                crewLeaderName: job.crewLeader?.name || 'N/A',
                hasCrewLeader: !!job.crewLeader
            })));

            res.status(200).json({
                success: true,
                data: jobs,
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
                        attributes: ['id', 'name'],
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
                        model: CrewMember,
                        as: 'crewLeader',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        include: [{
                            model: CrewMember,
                            as: 'crewMember',
                            attributes: ['id', 'name']
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
                    }
                ]
            });

            if (!job) {
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            res.status(200).json({ success: true, data: job });
        } catch (error) {
            logger.error(`Error fetching job with id ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error fetching job details.' });
        }
    }

    async deleteJob(req, res) {
        const transaction = await sequelize.transaction();
        try {
            const { id } = req.params;
            const job = await Job.findByPk(id);

            if (!job) {
                await transaction.rollback();
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            // Manually delete related shifts due to composite keys
            await Shift.destroy({ where: { job_id: id }, transaction });
            await JobSpecialShift.destroy({ where: { job_id: id }, transaction });
            
            await job.destroy({ transaction });
            
            await transaction.commit();
            res.status(200).json({ success: true, message: 'Job and associated shifts deleted successfully.' });
        } catch (error) {
            await transaction.rollback();
            logger.error(`Error deleting job with id ${req.params.id}:`, error);
            res.status(500).json({ success: false, message: 'Server error deleting job.' });
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
            const { name, closing_date, estimate_id, crew_leader_id, branch_id, note, review, crew_leader_hours, status_id } = req.body;

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
            if (status_id !== undefined) updateData.status_id = status_id;
            
            // Validar closing_date solo si se proporciona y es válida
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
                        model: CrewMember,
                        as: 'crewLeader',
                        attributes: ['id', 'name']
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
     * Marcar un job como "Done"
     */
    async markJobAsDone(req, res) {
        try {
            const { id } = req.params;
            
            const job = await jobCreationService.markJobAsDone(id);
            
            res.status(200).json({
                success: true,
                message: `Job ${job.name} marked as Done`,
                job: job
            });

        } catch (error) {
            logger.error(`❌ Error marcando job ${req.params.id} como Done:`, error);
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

}

module.exports = new JobsController(); 