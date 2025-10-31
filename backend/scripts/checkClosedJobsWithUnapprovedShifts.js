/**
 * Script para diagnosticar jobs en "Closed Job" con shifts no aprobados
 * Estos jobs deberían estar en Shifts Approval, no en Job List
 */

const { Job, Shift, JobSpecialShift, Branch, Employee, JobStatus } = require('../src/models');
const { logger } = require('../src/utils/logger');

async function checkClosedJobsWithUnapprovedShifts() {
    try {
        logger.info('🔍 Buscando jobs en "Closed Job" con shifts no aprobados...');
        
        // 1. Buscar el status "Closed Job"
        const closedJobStatus = await JobStatus.findOne({
            where: { name: 'Closed Job' }
        });
        
        if (!closedJobStatus) {
            logger.error('❌ Status "Closed Job" no encontrado en la base de datos');
            return;
        }
        
        logger.info(`✅ Status "Closed Job" encontrado (ID: ${closedJobStatus.id})`);
        
        // 2. Buscar todos los jobs con status "Closed Job"
        const closedJobs = await Job.findAll({
            where: {
                status_id: closedJobStatus.id
            },
            include: [
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                },
                {
                    model: Shift,
                    as: 'shifts',
                    include: [
                        {
                            model: Employee,
                            as: 'employee',
                            attributes: ['id', 'first_name', 'last_name']
                        }
                    ]
                },
                {
                    model: JobSpecialShift,
                    as: 'jobSpecialShifts'
                }
            ]
        });
        
        logger.info(`📊 Total jobs en "Closed Job": ${closedJobs.length}`);
        
        if (closedJobs.length === 0) {
            logger.warn('⚠️ No hay jobs en estado "Closed Job"');
            return;
        }
        
        // 3. Filtrar jobs que tienen shifts NO aprobados
        const jobsWithUnapprovedShifts = [];
        
        for (const job of closedJobs) {
            const regularShifts = job.shifts || [];
            const specialShifts = job.jobSpecialShifts || [];
            
            const unapprovedRegularShifts = regularShifts.filter(s => s.approved_shift !== true);
            const unapprovedSpecialShifts = specialShifts.filter(s => s.approved !== true);
            
            if (unapprovedRegularShifts.length > 0 || unapprovedSpecialShifts.length > 0) {
                jobsWithUnapprovedShifts.push({
                    job,
                    unapprovedRegularShifts,
                    unapprovedSpecialShifts
                });
            }
        }
        
        logger.info(`🚨 Jobs en "Closed Job" con shifts NO aprobados: ${jobsWithUnapprovedShifts.length}`);
        
        if (jobsWithUnapprovedShifts.length === 0) {
            logger.info('✅ Todos los jobs en "Closed Job" tienen sus shifts aprobados');
            return;
        }
        
        // 4. Mostrar detalles de cada job problemático
        for (const { job, unapprovedRegularShifts, unapprovedSpecialShifts } of jobsWithUnapprovedShifts) {
            logger.warn('═══════════════════════════════════════════════');
            logger.warn(`🚨 JOB PROBLEMÁTICO: ${job.name}`);
            logger.warn(`   Branch: ${job.branch?.name}`);
            logger.warn(`   Job ID: ${job.id}`);
            logger.warn(`   Status: Closed Job (❌ INCORRECTO - debería estar en pending_approval)`);
            logger.warn(`   Performance Status: ${job.performance_status}`);
            logger.warn('───────────────────────────────────────────────');
            logger.warn(`   📋 Shifts Regulares NO Aprobados: ${unapprovedRegularShifts.length}`);
            
            if (unapprovedRegularShifts.length > 0) {
                unapprovedRegularShifts.forEach(s => {
                    logger.warn(`      • ${s.employee?.first_name} ${s.employee?.last_name} - ${s.hours} hrs (approved_shift: ${s.approved_shift}, performance_status: ${s.performance_status})`);
                });
            }
            
            logger.warn(`   ⭐ Special Shifts NO Aprobados: ${unapprovedSpecialShifts.length}`);
            
            if (unapprovedSpecialShifts.length > 0) {
                unapprovedSpecialShifts.forEach(s => {
                    logger.warn(`      • Special Shift ID: ${s.special_shift_id} - ${s.hours} hrs (approved: ${s.approved})`);
                });
            }
            
            logger.warn('═══════════════════════════════════════════════\n');
        }
        
        // 5. Ofrecer SQL para arreglar
        logger.info('💡 Para arreglar estos jobs, puedes ejecutar:');
        logger.info('');
        logger.info('-- Cambiar estos jobs de "Closed Job" a "In Progress" o "Requires Crew Lead"');
        logger.info('-- para que aparezcan en Shifts Approval:');
        logger.info('');
        
        const inProgressStatus = await JobStatus.findOne({ where: { name: 'In Progress' } });
        
        jobsWithUnapprovedShifts.forEach(({ job }) => {
            logger.info(`UPDATE botzilla.job SET status_id = ${inProgressStatus?.id || 'NULL'}, performance_status = 'pending_approval' WHERE id = ${job.id}; -- ${job.name}`);
        });
        
    } catch (error) {
        logger.error('Error checking closed jobs with unapproved shifts', {
            error: error.message,
            stack: error.stack
        });
    } finally {
        process.exit(0);
    }
}

// Ejecutar
checkClosedJobsWithUnapprovedShifts();

