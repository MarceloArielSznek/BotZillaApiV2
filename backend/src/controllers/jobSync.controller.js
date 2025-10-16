const axios = require('axios');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const { findBranch: branchHelperFind } = require('../utils/branchHelper');

// Importar modelos
const Job = require('../models/Job');
const JobStatus = require('../models/JobStatus');
const Branch = require('../models/Branch');
const CrewMember = require('../models/CrewMember');
const Estimate = require('../models/Estimate');
const User = require('../models/User');
const UserRol = require('../models/UserRol');

/**
 * Login a Attic Tech API
 */
async function loginToAtticTech() {
    try {
        const response = await axios.post('https://www.attic-tech.com/api/users/login', {
            email: process.env.ATTIC_TECH_EMAIL,
            password: process.env.ATTIC_TECH_PASSWORD
        });

        if (response.data && response.data.token) {
            logger.info('✅ Login exitoso a Attic Tech');
            return response.data.token;
        } else {
            throw new Error('No se recibió token de Attic Tech');
        }
    } catch (error) {
        logger.error('❌ Error en login a Attic Tech', { error: error.message });
        throw new Error(`Login failed: ${error.message}`);
    }
}

/**
 * Fetch jobs desde Attic Tech
 * @param {string} apiKey - Token de autenticación
 * @param {string} fromDate - Fecha desde la cual buscar (formato YYYY-MM-DD)
 */
async function fetchJobsFromAtticTech(apiKey, fromDate) {
    try {
        const url = `https://www.attic-tech.com/api/jobs`;
        
        // Construir query params
        const params = {
            depth: 2,
            limit: 1000, // Ajustar según necesidad
            // Filtrar por updatedAt >= HOY (solo jobs actualizados hoy)
            'where[updatedAt][greater_than_equal]': fromDate
        };

        logger.info(`📡 Fetching jobs from Attic Tech desde: ${fromDate}`);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params
        });

        const jobs = response.data?.docs || [];
        logger.info(`✅ Se obtuvieron ${jobs.length} jobs desde AT`);
        
        return jobs;
    } catch (error) {
        logger.error('❌ Error fetching jobs from Attic Tech', { error: error.message });
        throw error;
    }
}

/**
 * Buscar o crear Job Status en nuestra BD
 */
async function findOrCreateJobStatus(statusName) {
    if (!statusName) return null;

    try {
        let status = await JobStatus.findOne({ 
            where: { 
                name: { [Op.iLike]: statusName }  // Case insensitive
            } 
        });

        if (!status) {
            status = await JobStatus.create({ name: statusName });
            logger.info(`🔖 Created new job status: ${statusName}`);
        }

        return status;
    } catch (error) {
        logger.error(`Error finding/creating job status: ${statusName}`, { error: error.message });
        return null;
    }
}

/**
 * Buscar Branch en nuestra BD
 * Usa helper centralizado para búsqueda consistente
 */
async function findBranch(branchName) {
    return await branchHelperFind(branchName);
}

/**
 * Buscar CrewMember por nombre o telegram_id
 */
async function findCrewLeader(assignedCrew) {
    if (!assignedCrew || assignedCrew.length === 0) return null;

    try {
        // Buscar el crew leader en el array (el que tiene rol "Crew Leader")
        const crewLeaderData = assignedCrew.find(member => {
            const roles = member.roles || [];
            return roles.some(role => 
                (typeof role === 'object' && role.name === 'Crew Leader') ||
                (typeof role === 'string' && role === 'Crew Leader')
            );
        });

        if (!crewLeaderData) return null;

        // Buscar en nuestra BD por nombre o email
        const crewLeader = await CrewMember.findOne({
            where: {
                [Op.or]: [
                    { name: { [Op.iLike]: `%${crewLeaderData.name}%` } },
                    ...(crewLeaderData.email ? [{ telegram_id: crewLeaderData.email }] : [])
                ]
            }
        });

        return crewLeader;
    } catch (error) {
        logger.error(`Error finding crew leader`, { error: error.message });
        return null;
    }
}

/**
 * Buscar estimate en nuestra BD por attic_tech_estimate_id
 */
async function findEstimateInOurDb(atticTechEstimateId) {
    if (!atticTechEstimateId) return null;

    try {
        const SalesPerson = require('../models/SalesPerson');
        
        const estimate = await Estimate.findOne({
            where: { attic_tech_estimate_id: atticTechEstimateId },
            include: [{
                model: SalesPerson,
                as: 'SalesPerson',
                attributes: ['id', 'name', 'phone', 'telegram_id']
            }]
        });
        return estimate;
    } catch (error) {
        logger.error(`Error finding estimate ${atticTechEstimateId}`, { error: error.message });
        return null;
    }
}

/**
 * Buscar el Operation Manager de un branch específico
 */
async function findOperationManager(branchId) {
    try {
        if (!branchId) return null;

        // Buscar el rol "operation manager" (ID 4)
        const operationManagerRole = await UserRol.findOne({
            where: { name: 'operation manager' }
        });

        if (!operationManagerRole) {
            logger.warn('⚠️  Rol "operation manager" no encontrado en la BD');
            return null;
        }

        // Buscar usuarios con rol operation manager asignados a este branch
        const operationManager = await User.findOne({
            where: { 
                rol_id: operationManagerRole.id 
            },
            include: [
                {
                    model: Branch,
                    as: 'branches',
                    where: { id: branchId },
                    through: { attributes: [] }
                }
            ],
            attributes: ['id', 'email', 'telegram_id']
        });

        if (operationManager && operationManager.telegram_id) {
            logger.info(`✅ Operation Manager encontrado para branch ${branchId}: ${operationManager.email}`);
            return operationManager;
        } else {
            logger.warn(`⚠️  No se encontró Operation Manager con telegram_id para branch ${branchId}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error buscando Operation Manager para branch ${branchId}`, { error: error.message });
        return null;
    }
}

/**
 * Generar notificación para Operation Manager (nuevo job con "Requires Crew Lead")
 */
async function generateOperationManagerNotification(atJob, branch, estimate) {
    try {
        // Priorizar datos de NUESTRA BD si el estimate existe
        const notification = {
            job_name: atJob.name,
            cx_name: estimate?.customer_name || atJob.job_estimate?.customer?.name || 'N/A',
            cx_phone: estimate?.customer_phone || atJob.job_estimate?.customer?.phone || null,
            job_address: estimate?.customer_address || atJob.job_estimate?.customer?.address || 'N/A',
            branch: branch?.name || 'N/A',
            salesperson_name: estimate?.SalesPerson?.name || atJob.job_estimate?.salesperson?.name || 'N/A',
            client_email: estimate?.customer_email || atJob.job_estimate?.customer?.email || null,
            crew_leader_name: null, // No hay crew leader aún (job requiere asignación)
            job_link: `https://www.attic-tech.com/jobs/${atJob.id}`,
            notification_type: 'New Job - Requires Crew Lead',
            telegram_id: null // Se llenará después
        };

        // Buscar Operation Manager del branch
        if (branch) {
            const operationManager = await findOperationManager(branch.id);
            if (operationManager && operationManager.telegram_id) {
                notification.telegram_id = operationManager.telegram_id;
                logger.info(`📨 Notificación generada para Operation Manager (Job: ${atJob.name}, Branch: ${branch.name})`);
                return notification;
            }
        }

        logger.warn(`⚠️  No se pudo generar notificación para Operation Manager (Job: ${atJob.name})`);
        return null;
    } catch (error) {
        logger.error(`Error generando notificación para Operation Manager (job ${atJob.id}):`, error);
        return null;
    }
}

/**
 * Guardar jobs en la BD y detectar cambios de estado para notificaciones
 */
async function saveJobsToDb(jobsFromAT) {
    let newCount = 0;
    let updatedCount = 0;
    const errors = [];
    const notifications = [];

    for (const atJob of jobsFromAT) {
        try {
            // Buscar si ya existe en job
            const existingJob = await Job.findOne({
                where: { attic_tech_job_id: atJob.id },
                include: [
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    }
                ]
            });

            // Buscar referencias en nuestra BD
            const status = await findOrCreateJobStatus(atJob.status);
            const branch = atJob.job_estimate?.branch ? 
                await findBranch(atJob.job_estimate.branch.name) : null;
            const crewLeader = await findCrewLeader(atJob.assignedCrew);
            
            // Buscar estimate en NUESTRA BD por su attic_tech_estimate_id
            const estimate = await findEstimateInOurDb(atJob.job_estimate?.id);

            const jobData = {
                name: atJob.name,
                attic_tech_job_id: atJob.id,
                attic_tech_estimate_id: atJob.job_estimate?.id || null,
                estimate_id: estimate?.id || null,
                status_id: status?.id || null,
                crew_leader_id: crewLeader?.id || null,
                branch_id: branch?.id || null,
                last_synced_at: new Date()
            };

            if (estimate) {
                logger.info(`📋 Estimate encontrado: ID ${estimate.id} (AT ID: ${atJob.job_estimate?.id})`);
            } else {
                logger.warn(`⚠️  Estimate NO encontrado en nuestra BD para job: ${atJob.name} (AT Estimate ID: ${atJob.job_estimate?.id})`);
            }

            // DETECCIÓN DE CAMBIO DE ESTADO: Requires Crew Lead → Plans In Progress
            let shouldNotify = false;
            if (existingJob) {
                // Usar last_known_status_id para detectar cambios reales
                const oldStatusId = existingJob.last_known_status_id || existingJob.status_id;
                const newStatusId = status?.id;
                const statusChanged = oldStatusId !== newStatusId;
                
                // Obtener nombre del estado ANTERIOR
                let oldStatusName = 'Unknown';
                if (existingJob.last_known_status_id) {
                    const oldStatusObj = await JobStatus.findByPk(existingJob.last_known_status_id);
                    oldStatusName = oldStatusObj?.name || 'Unknown';
                } else if (existingJob.status?.name) {
                    oldStatusName = existingJob.status.name;
                }
                
                const newStatusName = status?.name || 'Unknown';
                
                // Log de debug para ver estados
                if (statusChanged) {
                    logger.info(`📝 Estado cambió para "${atJob.name}": ${oldStatusName} (ID ${oldStatusId}) → ${newStatusName} (ID ${newStatusId})`);
                }
                
                // Detectar si cambió a "Plans In Progress" desde "Requires Crew Lead" y tiene crew leader
                if (statusChanged && oldStatusName === 'Requires Crew Lead' && newStatusName === 'Plans In Progress' && crewLeader) {
                    shouldNotify = true;
                    logger.info(`🔔 ¡Notificación necesaria! Crew Leader asignado a job: ${atJob.name}`);
                } else if (statusChanged && oldStatusName === 'Requires Crew Lead' && newStatusName === 'Plans In Progress' && !crewLeader) {
                    logger.warn(`⚠️  Job cambió a "Plans In Progress" pero NO tiene Crew Leader asignado: ${atJob.name}`);
                }

                // Verificar si algo realmente cambió
                const hasChanges = 
                    statusChanged ||
                    existingJob.name !== jobData.name ||
                    existingJob.crew_leader_id !== jobData.crew_leader_id ||
                    existingJob.branch_id !== jobData.branch_id ||
                    existingJob.estimate_id !== jobData.estimate_id;

                // Solo actualizar si algo cambió o si necesitamos notificar
                if (hasChanges || shouldNotify) {
                    // Actualizar job existente
                    if (shouldNotify && !existingJob.notification_sent) {
                        jobData.notification_sent = true;
                        jobData.last_notification_sent_at = new Date();
                        logger.info(`📧 Marcando notificación como enviada para job: ${atJob.name}`);
                    } else {
                        // Preservar el valor existente de notification_sent
                        jobData.notification_sent = existingJob.notification_sent;
                        jobData.last_notification_sent_at = existingJob.last_notification_sent_at;
                    }
                    jobData.last_known_status_id = status?.id || null; // Actualizar último estado conocido

                    await Job.update(jobData, {
                        where: { id: existingJob.id }
                    });
                    updatedCount++;
                    logger.info(`🔄 Updated job: ${atJob.name} (AT ID: ${atJob.id})`);
                } else {
                    // Solo actualizar last_synced_at sin contar como "actualización"
                    await Job.update(
                        { last_synced_at: new Date() }, 
                        { where: { id: existingJob.id } }
                    );
                    logger.debug(`✓ No changes for job: ${atJob.name} (AT ID: ${atJob.id})`);
                }

                // Generar notificación si es necesario
                if (shouldNotify && !existingJob.notification_sent && crewLeader) {
                    const notification = await generateNotification(atJob, crewLeader, branch, estimate);
                    if (notification) {
                        notifications.push(notification);
                    }
                }
            } else {
                // Crear nuevo job
                jobData.last_known_status_id = status?.id || null;
                jobData.notification_sent = false;

                await Job.create(jobData);
                newCount++;
                logger.info(`✅ Created new job: ${atJob.name} (AT ID: ${atJob.id})`);

                // NOTIFICACIÓN AL OPERATION MANAGER: Nuevo job con "Requires Crew Lead"
                const newStatus = status?.name;
                if (newStatus === 'Requires Crew Lead' && branch) {
                    logger.info(`🔔 Nuevo job con estado "Requires Crew Lead": ${atJob.name} (Branch: ${branch.name})`);
                    const notification = await generateOperationManagerNotification(atJob, branch, estimate);
                    if (notification) {
                        notifications.push(notification);
                    }
                }
            }

        } catch (error) {
            logger.error(`❌ Error saving job ${atJob.id}`, { error: error.message });
            errors.push({
                job_id: atJob.id,
                job_name: atJob.name,
                error: error.message
            });
        }
    }

    return { newCount, updatedCount, errors, notifications };
}

/**
 * Generar notificación para Crew Leader asignado
 */
async function generateNotification(atJob, crewLeader, branch, estimate) {
    try {
        // Priorizar datos de NUESTRA BD si el estimate existe
        const notification = {
            job_name: atJob.name,
            cx_name: estimate?.customer_name || atJob.job_estimate?.customer?.name || 'N/A',
            cx_phone: estimate?.customer_phone || atJob.job_estimate?.customer?.phone || null,
            job_address: estimate?.customer_address || atJob.job_estimate?.customer?.address || 'N/A',
            branch: branch?.name || 'N/A',
            salesperson_name: estimate?.SalesPerson?.name || atJob.job_estimate?.salesperson?.name || 'N/A',
            client_email: estimate?.customer_email || atJob.job_estimate?.customer?.email || null,
            crew_leader_name: crewLeader.name, // Nombre del crew leader asignado
            job_link: `https://www.attic-tech.com/jobs/${atJob.id}`,
            notification_type: 'Crew Leader Assigned',
            telegram_id: crewLeader.telegram_id
        };

        logger.info(`📨 Notificación generada para Crew Leader: ${crewLeader.name} (Job: ${atJob.name})`);
        return notification;
    } catch (error) {
        logger.error(`Error generando notificación para job ${atJob.id}:`, error);
        return null;
    }
}

/**
 * Controller principal
 */
class JobSyncController {
    
    /**
     * Sync jobs desde Attic Tech
     * GET/POST /api/job-sync/sync-jobs
     * 
     * Query params opcionales:
     * - days_back: número de días hacia atrás para buscar (default: 0 = solo hoy)
     *   Ejemplo: ?days_back=7 para traer jobs de los últimos 7 días
     */
    async syncJobs(req, res) {
        const startTime = Date.now();
        
        try {
            logger.info('🚀 Starting job sync from Attic Tech...');

            // Parámetro opcional para testing: cuántos días hacia atrás buscar
            const daysBack = parseInt(req.query.days_back || req.body.days_back || '0', 10);
            
            // Calcular fecha desde
            const fromDateObj = new Date();
            fromDateObj.setDate(fromDateObj.getDate() - daysBack);
            const fromDate = fromDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];

            if (daysBack > 0) {
                logger.info(`📅 Syncing jobs from last ${daysBack} days: ${fromDate} to ${today}`);
            } else {
                logger.info(`📅 Syncing jobs updated TODAY: ${today}`);
            }

            // 1. Login a Attic Tech
            const apiKey = await loginToAtticTech();

            // 2. Fetch jobs actualizados HOY
            const jobsFromAT = await fetchJobsFromAtticTech(apiKey, fromDate);

            if (jobsFromAT.length === 0) {
                const message = daysBack > 0 
                    ? `No jobs updated in the last ${daysBack} days` 
                    : 'No jobs updated today';
                    
                return res.status(200).json({
                    success: true,
                    message,
                    data: {
                        totalJobs: 0,
                        newJobs: 0,
                        updatedJobs: 0,
                        syncDate: today,
                        daysBack: daysBack > 0 ? daysBack : undefined
                    }
                });
            }

            // 3. Guardar en BD y detectar cambios de estado
            const { newCount, updatedCount, errors, notifications } = await saveJobsToDb(jobsFromAT);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            const notificationCount = notifications.length;
            const message = notificationCount > 0 
                ? `Job sync completed. ${notificationCount} notification${notificationCount > 1 ? 's' : ''} pending.`
                : 'Job sync completed successfully. No notifications pending.';

            logger.info(`✅ Job sync completed in ${duration}s - New: ${newCount}, Updated: ${updatedCount}, Notifications: ${notificationCount}`);

            res.status(200).json({
                success: true,
                message,
                data: {
                    totalJobs: jobsFromAT.length,
                    newJobs: newCount,
                    updatedJobs: updatedCount,
                    errors: errors.length > 0 ? errors : undefined,
                    duration: `${duration}s`,
                    syncDate: today,
                    daysBack: daysBack > 0 ? daysBack : undefined
                },
                notifications: notifications.length > 0 ? notifications : undefined
            });

        } catch (error) {
            logger.error('❌ Job sync failed', { error: error.message, stack: error.stack });
            res.status(500).json({
                success: false,
                message: 'Job sync failed',
                error: error.message
            });
        }
    }
}

module.exports = new JobSyncController();

