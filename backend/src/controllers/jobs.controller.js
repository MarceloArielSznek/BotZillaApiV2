const { Job, Estimate, Branch, SalesPerson, CrewMember, Shift, SpecialShift, JobSpecialShift } = require('../models');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

class JobsController {
    async getAllJobs(req, res) {
        try {
            const { branchId, salespersonId, crewLeaderId, startDate, endDate } = req.query;
            const whereClause = {};
            const includeWhereClause = {
                estimate: {},
                crewLeader: {}
            };

            if (branchId) {
                whereClause.branch_id = branchId;
            }
            if (salespersonId) {
                includeWhereClause.estimate[Op.and] = { sales_person_id: salespersonId };
            }
            if (crewLeaderId) {
                whereClause.crew_leader_id = crewLeaderId;
            }
            if (startDate && endDate) {
                whereClause.closing_date = {
                    [Op.between]: [new Date(startDate), new Date(endDate)]
                };
            }

            const jobs = await Job.findAll({
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
                order: [['closing_date', 'DESC']]
            });
            res.status(200).json({ success: true, data: jobs });
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
}

module.exports = new JobsController(); 