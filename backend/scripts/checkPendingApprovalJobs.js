/**
 * Script para diagnosticar jobs y shifts pendientes de aprobación
 * Verifica que los jobs con autoApprove=false estén correctamente marcados
 */

const { Job, Shift, JobSpecialShift, Branch, Employee } = require('../src/models');
const { logger } = require('../src/utils/logger');

async function checkPendingApprovalJobs() {
    try {
        logger.info('🔍 Verificando jobs y shifts pendientes de aprobación...');
        
        // 1. Buscar todos los jobs con performance_status = 'pending_approval'
        const pendingJobs = await Job.findAll({
            where: {
                performance_status: 'pending_approval'
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
        
        logger.info(`📊 Total jobs con performance_status='pending_approval': ${pendingJobs.length}`);
        
        if (pendingJobs.length === 0) {
            logger.warn('⚠️ No hay jobs pendientes de aprobación');
            return;
        }
        
        // 2. Analizar cada job
        for (const job of pendingJobs) {
            const regularShifts = job.shifts || [];
            const specialShifts = job.jobSpecialShifts || [];
            
            const pendingRegularShifts = regularShifts.filter(s => s.performance_status === 'pending_approval');
            const approvedRegularShifts = regularShifts.filter(s => s.approved_shift === true);
            const pendingSpecialShifts = specialShifts.filter(s => s.approved === false);
            const approvedSpecialShifts = specialShifts.filter(s => s.approved === true);
            
            logger.info('═══════════════════════════════════════════════');
            logger.info(`📦 JOB: ${job.name}`);
            logger.info(`   Branch: ${job.branch?.name}`);
            logger.info(`   Performance Status: ${job.performance_status}`);
            logger.info(`   Job ID: ${job.id}`);
            logger.info('───────────────────────────────────────────────');
            logger.info(`   📋 Regular Shifts: ${regularShifts.length} total`);
            logger.info(`      • Pending approval: ${pendingRegularShifts.length}`);
            logger.info(`      • Already approved: ${approvedRegularShifts.length}`);
            logger.info(`   ⭐ Special Shifts: ${specialShifts.length} total`);
            logger.info(`      • Pending approval: ${pendingSpecialShifts.length}`);
            logger.info(`      • Already approved: ${approvedSpecialShifts.length}`);
            logger.info('═══════════════════════════════════════════════\n');
            
            // Mostrar detalles de shifts pendientes
            if (pendingRegularShifts.length > 0) {
                logger.info('   🔍 Regular Shifts Pendientes:');
                pendingRegularShifts.forEach(s => {
                    logger.info(`      • ${s.employee?.first_name} ${s.employee?.last_name} - ${s.hours} hrs (approved_shift: ${s.approved_shift}, performance_status: ${s.performance_status})`);
                });
            }
            
            if (pendingSpecialShifts.length > 0) {
                logger.info('   🔍 Special Shifts Pendientes:');
                pendingSpecialShifts.forEach(s => {
                    logger.info(`      • Special Shift ID: ${s.special_shift_id} - ${s.hours} hrs (approved: ${s.approved})`);
                });
            }
        }
        
        // 3. Buscar jobs sin shifts
        const jobsWithoutShifts = pendingJobs.filter(job => {
            const regularShifts = job.shifts || [];
            const specialShifts = job.jobSpecialShifts || [];
            return regularShifts.length === 0 && specialShifts.length === 0;
        });
        
        if (jobsWithoutShifts.length > 0) {
            logger.warn(`⚠️ ${jobsWithoutShifts.length} jobs pendientes SIN SHIFTS:`);
            jobsWithoutShifts.forEach(job => {
                logger.warn(`   • ${job.name} (ID: ${job.id}, Branch: ${job.branch?.name})`);
            });
        }
        
        // 4. Buscar jobs con shifts ya aprobados pero job aún en pending_approval
        const jobsWithApprovedShifts = pendingJobs.filter(job => {
            const regularShifts = job.shifts || [];
            const specialShifts = job.jobSpecialShifts || [];
            const allRegularApproved = regularShifts.length > 0 && regularShifts.every(s => s.approved_shift === true);
            const allSpecialApproved = specialShifts.length === 0 || specialShifts.every(s => s.approved === true);
            return allRegularApproved && allSpecialApproved;
        });
        
        if (jobsWithApprovedShifts.length > 0) {
            logger.warn(`⚠️ ${jobsWithApprovedShifts.length} jobs con TODOS los shifts aprobados pero job aún en 'pending_approval':`);
            jobsWithApprovedShifts.forEach(job => {
                logger.warn(`   • ${job.name} (ID: ${job.id}, Branch: ${job.branch?.name})`);
            });
        }
        
    } catch (error) {
        logger.error('Error checking pending approval jobs', {
            error: error.message,
            stack: error.stack
        });
    } finally {
        process.exit(0);
    }
}

// Ejecutar
checkPendingApprovalJobs();

