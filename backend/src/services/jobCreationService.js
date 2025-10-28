const { Estimate, Job, JobStatus, EstimateStatus, Branch } = require('../models');
const { logger } = require('../utils/logger');

class JobCreationService {
    /**
     * Convierte estimates con status "Sold" en jobs con status "In Progress"
     * Solo crea jobs para estimates que no tengan ya un job asociado
     */
    async createJobsFromSoldEstimates() {
        try {
            logger.info('🚀 Iniciando creación automática de jobs desde estimates Sold...');

            // 1. Buscar el status "Sold"
            const soldStatus = await EstimateStatus.findOne({
                where: { name: 'Sold' }
            });

            if (!soldStatus) {
                logger.warn('❌ Status "Sold" no encontrado en estimate_status');
                return { created: 0, message: 'Status "Sold" not found' };
            }

            // 2. Buscar el status "In Progress" para jobs
            const inProgressStatus = await JobStatus.findOne({
                where: { name: 'In Progress' }
            });

            if (!inProgressStatus) {
                logger.warn('❌ Status "In Progress" no encontrado en job_status');
                return { created: 0, message: 'Status "In Progress" not found' };
            }

            // 3. Buscar estimates "Sold" que NO tengan job asociado
            const soldEstimatesWithoutJob = await Estimate.findAll({
                where: {
                    status_id: soldStatus.id
                },
                include: [
                    {
                        model: Job,
                        as: 'job',
                        required: false // LEFT JOIN para incluir estimates sin job
                    },
                    {
                        model: Branch,
                        as: 'Branch',
                        attributes: ['id', 'name']
                    }
                ]
            });

            // Filtrar solo los que NO tienen job
            const estimatesWithoutJob = soldEstimatesWithoutJob.filter(estimate => !estimate.job);

            logger.info(`📊 Encontrados ${estimatesWithoutJob.length} estimates "Sold" sin job asociado`);

            if (estimatesWithoutJob.length === 0) {
                return { created: 0, message: 'No sold estimates without jobs found' };
            }

            let createdCount = 0;
            const createdJobs = [];

            // 4. Crear jobs para cada estimate
            for (const estimate of estimatesWithoutJob) {
                try {
                    const jobData = {
                        name: estimate.name,
                        estimate_id: estimate.id,
                        branch_id: estimate.branch_id,
                        status_id: inProgressStatus.id,
                        attic_tech_hours: estimate.attic_tech_hours,
                        closing_date: null, // Se establecerá cuando se marque como "Done"
                        crew_leader_id: null, // Se asignará manualmente
                        note: `Auto-created from estimate ${estimate.name}`,
                        review: null,
                        crew_leader_hours: null,
                        cl_estimated_plan_hours: null,
                        notification_sent: false
                    };

                    const newJob = await Job.create(jobData);
                    createdCount++;
                    createdJobs.push({
                        jobId: newJob.id,
                        jobName: newJob.name,
                        estimateId: estimate.id,
                        estimateName: estimate.name,
                        branchName: estimate.Branch?.name || 'Unknown'
                    });

                    logger.info(`✅ Job creado: ${newJob.name} (ID: ${newJob.id}) desde estimate ${estimate.name}`);

                } catch (error) {
                    logger.error(`❌ Error creando job para estimate ${estimate.name}:`, error);
                }
            }

            logger.info(`🎉 Proceso completado. ${createdCount} jobs creados automáticamente`);

            return {
                created: createdCount,
                message: `Successfully created ${createdCount} jobs from sold estimates`,
                jobs: createdJobs
            };

        } catch (error) {
            logger.error('❌ Error en createJobsFromSoldEstimates:', error);
            throw error;
        }
    }

    /**
     * Actualiza el status de un job a "Closed Job" y establece la fecha de cierre
     */
    async markJobAsClosedJob(jobId) {
        try {
            const closedJobStatus = await JobStatus.findOne({
                where: { name: 'Closed Job' }
            });

            if (!closedJobStatus) {
                throw new Error('Status "Closed Job" not found');
            }

            const job = await Job.findByPk(jobId);
            if (!job) {
                throw new Error('Job not found');
            }

            await job.update({
                status_id: closedJobStatus.id,
                closing_date: new Date()
            });

            logger.info(`✅ Job ${job.name} (ID: ${jobId}) marcado como "Closed Job"`);

            return job;

        } catch (error) {
            logger.error(`❌ Error marcando job ${jobId} como Closed Job:`, error);
            throw error;
        }
    }
    
    /**
     * @deprecated Use markJobAsClosedJob instead. This method exists for backward compatibility.
     */
    async markJobAsDone(jobId) {
        return this.markJobAsClosedJob(jobId);
    }

    /**
     * Obtiene estadísticas de jobs por status
     */
    async getJobStatusStats() {
        try {
            const stats = await Job.findAll({
                attributes: [
                    'status_id',
                    [require('sequelize').fn('COUNT', '*'), 'count']
                ],
                include: [{
                    model: JobStatus,
                    as: 'status',
                    attributes: ['name']
                }],
                group: ['status_id', 'status.id', 'status.name']
            });

            return stats.map(stat => ({
                status: stat.status?.name || 'Unknown',
                count: parseInt(stat.dataValues.count)
            }));

        } catch (error) {
            logger.error('❌ Error obteniendo estadísticas de job status:', error);
            throw error;
        }
    }
}

module.exports = new JobCreationService();
