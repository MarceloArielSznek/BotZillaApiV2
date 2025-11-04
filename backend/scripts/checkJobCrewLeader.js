/**
 * Script para verificar el estado de un job y su crew leader
 * Útil para debuggear problemas con notificaciones
 */

const { Job, JobStatus, Employee, Branch } = require('../src/models');
const { logger } = require('../src/utils/logger');

async function checkJobCrewLeader(jobName) {
    try {
        logger.info(`🔍 Buscando job: "${jobName}"`);
        
        const job = await Job.findOne({
            where: {
                name: {
                    [require('sequelize').Op.iLike]: `%${jobName}%`
                }
            },
            include: [
                {
                    model: JobStatus,
                    as: 'status',
                    attributes: ['id', 'name']
                },
                {
                    model: Employee,
                    as: 'crewLeader',
                    attributes: ['id', 'first_name', 'last_name', 'email', 'telegram_id', 'status']
                },
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                }
            ]
        });
        
        if (!job) {
            logger.error(`❌ Job no encontrado: "${jobName}"`);
            return;
        }
        
        logger.info('═══════════════════════════════════════════════');
        logger.info(`📦 JOB: ${job.name}`);
        logger.info(`   Job ID: ${job.id}`);
        logger.info(`   AccuLynx ID: ${job.attic_tech_job_id}`);
        logger.info(`   Branch: ${job.branch?.name || 'N/A'}`);
        logger.info('───────────────────────────────────────────────');
        logger.info(`   📊 Status: ${job.status?.name || 'N/A'} (ID: ${job.status_id})`);
        logger.info(`   🎭 Performance Status: ${job.performance_status || 'N/A'}`);
        logger.info('───────────────────────────────────────────────');
        
        if (job.crewLeader) {
            logger.info(`   👤 Crew Leader:`);
            logger.info(`      • ID: ${job.crewLeader.id}`);
            logger.info(`      • Name: ${job.crewLeader.first_name} ${job.crewLeader.last_name}`);
            logger.info(`      • Email: ${job.crewLeader.email || 'N/A'}`);
            logger.info(`      • Telegram ID: ${job.crewLeader.telegram_id || 'NO REGISTRADO'}`);
            logger.info(`      • Status: ${job.crewLeader.status || 'N/A'}`);
        } else {
            logger.warn(`   ⚠️  NO tiene Crew Leader asignado (crew_leader_id: ${job.crew_leader_id})`);
        }
        
        logger.info('───────────────────────────────────────────────');
        logger.info(`   🔔 Notificaciones:`);
        logger.info(`      • notification_sent: ${job.notification_sent}`);
        logger.info(`      • last_notification_sent_at: ${job.last_notification_sent_at || 'N/A'}`);
        logger.info(`      • registration_alert_sent: ${job.registration_alert_sent || false}`);
        logger.info('───────────────────────────────────────────────');
        logger.info(`   📅 Fechas:`);
        logger.info(`      • last_synced_at: ${job.last_synced_at || 'N/A'}`);
        logger.info(`      • closing_date: ${job.closing_date || 'N/A'}`);
        logger.info('═══════════════════════════════════════════════');
        
        // Verificar si debería notificar según la lógica del Escenario 3
        const activeJobStatuses = ['Plans In Progress', 'Job in Progress', 'Uploading Shifts', 'Missing Data to Close'];
        const isActiveJob = activeJobStatuses.includes(job.status?.name);
        
        logger.info('');
        logger.info('🔍 ANÁLISIS para Escenario 3 (Cambio de Crew Leader):');
        logger.info(`   ✓ Estado es activo? ${isActiveJob ? '✅ SÍ' : '❌ NO'} (Estado: ${job.status?.name})`);
        logger.info(`   ✓ Tiene crew leader? ${job.crewLeader ? '✅ SÍ' : '❌ NO'}`);
        logger.info(`   ✓ Crew leader activo? ${job.crewLeader?.status === 'active' ? '✅ SÍ' : '❌ NO'}`);
        logger.info(`   ✓ Tiene telegram_id? ${job.crewLeader?.telegram_id ? '✅ SÍ' : '❌ NO'}`);
        logger.info(`   ✓ notification_sent? ${job.notification_sent ? '✅ SÍ (bloqueado)' : '❌ NO (puede notificar)'}`);
        
        if (isActiveJob && job.crewLeader && !job.notification_sent && job.crewLeader.status === 'active' && job.crewLeader.telegram_id) {
            logger.info('');
            logger.info('💡 Este job DEBERÍA generar notificación al cambiar crew leader');
        } else if (!isActiveJob) {
            logger.warn('');
            logger.warn(`⚠️  El job NO está en un estado activo. Estado actual: "${job.status?.name}"`);
            logger.warn(`   Estados activos: ${activeJobStatuses.join(', ')}`);
        } else if (!job.crewLeader) {
            logger.warn('');
            logger.warn('⚠️  El job NO tiene crew leader asignado');
        } else if (job.notification_sent) {
            logger.warn('');
            logger.warn('⚠️  notification_sent = true (bloqueado). Debe resetearse al cambiar crew leader');
        }
        
    } catch (error) {
        logger.error('Error checking job crew leader', {
            error: error.message,
            stack: error.stack
        });
    } finally {
        process.exit(0);
    }
}

// Obtener nombre del job de los argumentos
const jobName = process.argv[2];

if (!jobName) {
    console.error('❌ Uso: node checkJobCrewLeader.js "Nombre del Job"');
    console.error('   Ejemplo: node checkJobCrewLeader.js "2nd notifications test"');
    process.exit(1);
}

// Ejecutar
checkJobCrewLeader(jobName);

