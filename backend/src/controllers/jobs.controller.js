const { Job, Estimate, Branch, SalesPerson, CrewMember, Shift, SpecialShift, JobSpecialShift } = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { calculateJobPerformance } = require('../services/performance.service');

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
            const { name, closing_date, estimate_id, crew_leader_id, branch_id, note, review, crew_leader_hours } = req.body;

            const job = await Job.findByPk(id);
            if (!job) {
                return res.status(404).json({ success: false, message: 'Job not found.' });
            }

            await job.update({
                name,
                closing_date,
                estimate_id,
                crew_leader_id,
                branch_id,
                note,
                review,
                crew_leader_hours
            });

            res.status(200).json({ success: true, data: job, message: 'Job updated successfully.' });
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

    async fixJobsWithoutCrewLeader(req, res) {
        try {
            console.log('🔧 Iniciando reparación de jobs sin crew leader...');
            
            // Buscar jobs que no tienen crew leader asignado
            const jobsWithoutCrewLeader = await Job.findAll({
                where: {
                    crew_leader_id: null
                },
                include: [{
                    model: Estimate,
                    as: 'estimate',
                    attributes: ['id', 'name']
                }]
            });

            console.log(`🔧 Encontrados ${jobsWithoutCrewLeader.length} jobs sin crew leader`);

            let fixedCount = 0;
            for (const job of jobsWithoutCrewLeader) {
                // Buscar el crew leader en los shifts del job
                const crewLeaderShift = await Shift.findOne({
                    where: {
                        job_id: job.id,
                        is_leader: true
                    },
                    include: [{
                        model: CrewMember,
                        as: 'crewMember',
                        attributes: ['id', 'name']
                    }]
                });

                if (crewLeaderShift && crewLeaderShift.crewMember) {
                    // Actualizar el job con el crew leader encontrado
                    await job.update({
                        crew_leader_id: crewLeaderShift.crewMember.id
                    });
                    
                    console.log(`✅ Job ${job.name} actualizado con crew leader: ${crewLeaderShift.crewMember.name}`);
                    fixedCount++;
                } else {
                    console.log(`⚠️ Job ${job.name} no tiene shifts con crew leader`);
                }
            }

            res.status(200).json({
                success: true,
                message: `Reparación completada. ${fixedCount} jobs actualizados.`,
                totalJobsWithoutCrewLeader: jobsWithoutCrewLeader.length,
                fixedJobs: fixedCount
            });

        } catch (error) {
            logger.error('Error fixing jobs without crew leader:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Server error fixing jobs without crew leader.' 
            });
        }
    }
}

module.exports = new JobsController(); 