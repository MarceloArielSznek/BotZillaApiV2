const axios = require('axios');
const { logger } = require('../utils/logger');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { findBranch: branchHelperFind } = require('../utils/branchHelper');
const makeWebhookService = require('../services/makeWebhook.service');

// Importar modelos
const Job = require('../models/Job');
const JobStatus = require('../models/JobStatus');
const Branch = require('../models/Branch');
const CrewMember = require('../models/CrewMember');
const Employee = require('../models/Employee');
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
            depth: 3, // Aumentado para traer más relaciones
            limit: 1000, // Ajustar según necesidad
            // Filtrar por updatedAt >= HOY (solo jobs actualizados hoy)
            'where[updatedAt][greater_than_equal]': fromDate,
            // IMPORTANTE: Excluir jobs con status "Closed Job" - estos solo se manejan desde Performance
            'where[status][not_equals]': 'Closed Job'
        };

        logger.info(`📡 Fetching jobs from Attic Tech desde: ${fromDate} (excluyendo "Closed Job")`);

        const response = await axios.get(url, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params
        });

        const jobs = response.data?.docs || [];
        
        // DEBUG: Buscar "Nave test" en los jobs traídos
        const naveTestJob = jobs.find(job => job.name && job.name.toLowerCase().includes('nave test'));
        if (naveTestJob) {
            logger.info(`🎯🎯🎯 "Nave test" ENCONTRADO EN AT API 🎯🎯🎯`, {
                jobId: naveTestJob.id,
                jobName: naveTestJob.name,
                status: naveTestJob.status,
                updatedAt: naveTestJob.updatedAt,
                fromDate: fromDate
            });
        } else {
            logger.info(`⚠️  "Nave test" NO encontrado en los jobs traídos desde AT (total: ${jobs.length} jobs)`);
        }
        
        // Filtro adicional por si acaso (defensa en profundidad)
        const filteredJobs = jobs.filter(job => job.status !== 'Closed Job');
        
        logger.info(`✅ Se obtuvieron ${jobs.length} jobs desde AT, ${filteredJobs.length} después de filtrar "Closed Job"`);
        
        // Listar todos los nombres de jobs para debuggear
        if (jobs.length > 0 && jobs.length <= 50) {
            logger.info(`📋 Lista de jobs traídos desde AT:`, {
                jobNames: jobs.map(j => j.name).slice(0, 50)
            });
        }
        
        return filteredJobs;
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

        // 1. Buscar primero en CrewMember (crew leaders ya aprobados) - SOLO por nombre
        let crewLeaderFromCrewMember = await CrewMember.findOne({
            where: {
                name: { [Op.iLike]: `%${crewLeaderData.name}%` }
            }
        });

        // Si lo encontramos en CrewMember, buscar su Employee correspondiente
        // Un crew_member con is_leader=true SIEMPRE debe tener un employee correspondiente
        if (crewLeaderFromCrewMember) {
            logger.info(`✅ Crew Leader encontrado en CrewMember (activo): ${crewLeaderFromCrewMember.name}`);
            
            // Buscar el Employee correspondiente usando múltiples criterios
            let employeeRecord = null;
            
            // 1. Intentar por telegram_id (más confiable)
            if (crewLeaderFromCrewMember.telegram_id) {
                employeeRecord = await Employee.findOne({
                    where: {
                        telegram_id: crewLeaderFromCrewMember.telegram_id
                    },
                    attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'telegram_id', 'status', 'role', 'branch_id'],
                    raw: true
                });
            }
            
            // 2. Si no se encuentra por telegram_id, buscar por phone
            if (!employeeRecord && crewLeaderFromCrewMember.phone) {
                employeeRecord = await Employee.findOne({
                    where: {
                        phone_number: crewLeaderFromCrewMember.phone
                    },
                    attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'telegram_id', 'status', 'role', 'branch_id'],
                    raw: true
                });
                
                if (employeeRecord) {
                    logger.info(`🔍 Employee encontrado por phone: ${crewLeaderFromCrewMember.phone}`);
                }
            }
            
            // 3. Si aún no se encuentra, buscar por nombre (menos confiable pero necesario)
            if (!employeeRecord) {
                employeeRecord = await Employee.findOne({
                    where: sequelize.where(
                        sequelize.fn('CONCAT', 
                            sequelize.col('first_name'), 
                            ' ', 
                            sequelize.col('last_name')
                        ),
                        { [Op.iLike]: `%${crewLeaderFromCrewMember.name}%` }
                    ),
                    attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'telegram_id', 'status', 'role', 'branch_id'],
                    raw: true
                });
                
                if (employeeRecord) {
                    logger.info(`🔍 Employee encontrado por nombre: ${crewLeaderFromCrewMember.name}`);
                }
            }

            if (employeeRecord) {
                logger.info(`✅ Employee encontrado - ID: ${employeeRecord.id}, Status: ${employeeRecord.status}`);
                
                // Retornar un objeto combinado con el ID del Employee pero los datos del CrewMember
                const combinedRecord = {
                    id: employeeRecord.id, // ⚠️ IMPORTANTE: Usar employee.id para la foreign key
                    name: crewLeaderFromCrewMember.name,
                    telegram_id: crewLeaderFromCrewMember.telegram_id,
                    phone: crewLeaderFromCrewMember.phone || employeeRecord.phone_number,
                    email: employeeRecord.email,
                    status: employeeRecord.status || 'active', // Si viene de CrewMember, asumir activo
                    first_name: employeeRecord.first_name,
                    last_name: employeeRecord.last_name,
                    is_leader: crewLeaderFromCrewMember.is_leader,
                    _source: 'crew_member' // Flag para identificar origen
                };
                
                logger.info(`✅ Retornando crew leader combinado - ID: ${combinedRecord.id}, Status: ${combinedRecord.status}`);
                return combinedRecord;
            } else {
                logger.error(`❌ PROBLEMA: Crew Leader "${crewLeaderFromCrewMember.name}" encontrado en crew_member pero NO en employee. Esto NO debería ocurrir.`, {
                    crew_member_id: crewLeaderFromCrewMember.id,
                    telegram_id: crewLeaderFromCrewMember.telegram_id,
                    phone: crewLeaderFromCrewMember.phone
                });
            }
        }

        // 2. Si no se encuentra en CrewMember, buscar en Employee (crew leaders pendientes de aprobación)
        // Prioridad 1: Buscar por email (más confiable)
        let crewLeader = null;
        if (crewLeaderData.email) {
            crewLeader = await Employee.findOne({
                where: {
                    email: { [Op.iLike]: crewLeaderData.email }
                },
                attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'telegram_id', 'status', 'role', 'branch_id'],
                raw: true
            });
        }

        // Prioridad 2: Si no se encuentra por email, buscar concatenando first_name + last_name
        if (!crewLeader && crewLeaderData.name) {
            crewLeader = await Employee.findOne({
                where: sequelize.where(
                    sequelize.fn('CONCAT', 
                        sequelize.col('first_name'), 
                        ' ', 
                        sequelize.col('last_name')
                    ),
                    { [Op.iLike]: `%${crewLeaderData.name}%` }
                ),
                attributes: ['id', 'first_name', 'last_name', 'email', 'phone_number', 'telegram_id', 'status', 'role', 'branch_id'],
                raw: true
            });
        }
        
        if (crewLeader) {
            logger.info(`✅ Crew Leader encontrado en Employee (pendiente de aprobación): ${crewLeader.first_name} ${crewLeader.last_name} (${crewLeader.email || 'sin email'})`);
            return crewLeader;
        }

        logger.warn(`⚠️  Crew Leader "${crewLeaderData.name}" (${crewLeaderData.email}) NO encontrado en nuestra BD`);
        return null;
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
 * Obtener el nombre completo del crew leader (maneja CrewMember y Employee)
 */
function getCrewLeaderName(crewLeader) {
    if (!crewLeader) return 'Unknown';
    
    // Si tiene first_name y last_name, es de Employee
    if (crewLeader.first_name && crewLeader.last_name) {
        return `${crewLeader.first_name} ${crewLeader.last_name}`.trim();
    }
    
    // Si tiene name, es de CrewMember
    if (crewLeader.name) {
        return crewLeader.name;
    }
    
    return 'Unknown';
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

        if (operationManager) {
            if (operationManager.telegram_id) {
                logger.info(`✅ Operation Manager encontrado para branch ${branchId}: ${operationManager.email} (con telegram_id)`);
            } else {
                logger.warn(`⚠️  Operation Manager encontrado para branch ${branchId}: ${operationManager.email} (SIN telegram_id - se generará notificación sin telegram)`);
            }
            return operationManager; // Retornar incluso si no tiene telegram_id
        } else {
            logger.warn(`⚠️  No se encontró Operation Manager para branch ${branchId}`);
            return null;
        }
    } catch (error) {
        logger.error(`Error buscando Operation Manager para branch ${branchId}`, { error: error.message });
        return null;
    }
}

/**
 * Helper: Send registration alert webhook ONLY if not already sent
 * Prevents spam by checking registration_alert_sent flag
 */
async function sendRegistrationAlertOnce(existingJob, alertData, jobName) {
    if (existingJob.registration_alert_sent) {
        logger.info(`ℹ️  Registration alert already sent for job "${jobName}", skipping to prevent spam`);
        return false;
    }
    
    // Send webhook
    await makeWebhookService.sendCrewLeaderRegistrationAlert(alertData);
    
    // Mark as sent
    await Job.update(
        { registration_alert_sent: true },
        { where: { id: existingJob.id } }
    );
    
    logger.info(`✅ Registration alert sent (1x) for job: ${jobName}`);
    return true;
}

/**
 * Generar notificación para Operation Manager (job cambió a "Pending Review")
 */
async function generatePendingReviewNotification(atJob, branch, estimate, crewLeader) {
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
            crew_leader_name: crewLeader ? getCrewLeaderName(crewLeader) : 'N/A',
            job_link: `https://www.attic-tech.com/jobs/${atJob.id}`,
            notification_type: 'Job Status Changed - Pending Review',
            telegram_id: null // Se llenará después
        };

        // Buscar Operation Manager del branch
        if (branch) {
            const operationManager = await findOperationManager(branch.id);
            if (operationManager) {
                if (operationManager.telegram_id) {
                    notification.telegram_id = operationManager.telegram_id;
                    logger.info(`📨 Notificación generada para Operation Manager (Job: ${atJob.name}, Branch: ${branch.name}, Status: Pending Review)`);
                    return notification;
                } else {
                    logger.warn(`⚠️  Operation Manager encontrado pero NO tiene telegram_id (Job: ${atJob.name}, Branch: ${branch.name}, Email: ${operationManager.email || 'N/A'})`);
                    // Aún así retornar la notificación sin telegram_id para que se pueda enviar por otro medio si es necesario
                    logger.info(`📨 Notificación generada SIN telegram_id (Job: ${atJob.name}, Branch: ${branch.name}, Status: Pending Review)`);
                    return notification;
                }
            } else {
                logger.warn(`⚠️  No se encontró Operation Manager para branch ${branch.id} (${branch.name})`);
            }
        } else {
            logger.warn(`⚠️  No hay branch asignado al job ${atJob.name}`);
        }

        logger.warn(`⚠️  No se pudo generar notificación para Operation Manager (Job: ${atJob.name}, Status: Pending Review)`);
        return null;
    } catch (error) {
        logger.error(`Error generando notificación de Pending Review para Operation Manager (job ${atJob.id}):`, error);
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
            // DEBUG ESPECÍFICO PARA "Nave test" AL INICIO (solo para este job)
            const isNaveTest = atJob.name && atJob.name.toLowerCase().includes('nave test');
            if (isNaveTest) {
                logger.info(`🎯🎯🎯 ENCONTRADO "Nave test" EN EL SYNC 🎯🎯🎯`);
                logger.info(`📋 Información inicial del job:`, {
                    atticTechJobId: atJob.id,
                    jobName: atJob.name,
                    statusFromAT: atJob.status,
                    hasEstimate: !!atJob.job_estimate,
                    estimateId: atJob.job_estimate?.id || 'N/A',
                    branchName: atJob.job_estimate?.branch?.name || 'N/A'
                });
            }
            // No mostrar log para todos los jobs (solo cuando hay cambios o es "Nave test")
            
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
            
            // Buscar crew leader en nuestra BD
            const crewLeader = await findCrewLeader(atJob.assignedCrew);
            
            // Debug log para crew leader
            if (atJob.assignedCrew && atJob.assignedCrew.length > 0) {
                logger.info('🔍 DEBUG Crew Leader Search', {
                    jobName: atJob.name,
                    assignedCrewCount: atJob.assignedCrew.length,
                    assignedCrew: atJob.assignedCrew.map(c => ({
                        name: c.name,
                        roles: c.roles,
                        email: c.email
                    })),
                    crewLeaderFound: !!crewLeader,
                    crewLeaderId: crewLeader?.id || null
                });
            }
            
            // Extraer datos del crew leader desde AT (aunque no esté en nuestra BD)
            const crewLeaderFromAT = atJob.assignedCrew?.find(member => {
                const roles = member.roles || [];
                return roles.some(role => 
                    (typeof role === 'object' && role.name === 'Crew Leader') ||
                    (typeof role === 'string' && role === 'Crew Leader')
                );
            });
            
            // Buscar estimate en NUESTRA BD por su attic_tech_estimate_id
            const estimate = await findEstimateInOurDb(atJob.job_estimate?.id);

            // Determinar el status_id a usar
            // Si el job está en "pending_approval", preservar el status y performance_status
            let statusIdToUse = status?.id || null;
            let shouldPreserveStatus = false;
            
            if (existingJob) {
                // Si el job está en "pending_approval", preservar el status y performance_status
                if (existingJob.performance_status === 'pending_approval') {
                    statusIdToUse = existingJob.status_id; // Mantener status actual
                    shouldPreserveStatus = true;
                    logger.info(`🔒 Job "${atJob.name}" está en "pending_approval" (esperando aprobación de shifts). Status y performance_status preservados, NO sobrescritos por sync.`);
                }
            }

            const jobData = {
                name: atJob.name,
                attic_tech_job_id: atJob.id,
                attic_tech_estimate_id: atJob.job_estimate?.id || null,
                estimate_id: estimate?.id || null,
                status_id: statusIdToUse,
                crew_leader_id: crewLeader?.id || null,
                branch_id: branch?.id || null,
                last_synced_at: new Date()
            };
            
            // Si el job está protegido (pending_approval), preservar performance_status
            if (shouldPreserveStatus && existingJob) {
                jobData.performance_status = existingJob.performance_status;
            }
            
            // IMPORTANTE: Preservar closing_date existente si el job ya lo tiene
            // El closing_date solo debe venir del Performance spreadsheet, NO del sync de Attic Tech
            // Si ya existe un closing_date, no lo sobrescribir
            if (existingJob && existingJob.closing_date) {
                // NO incluir closing_date en jobData para preservar el valor existente
                // Sequelize solo actualizará los campos que estén en jobData
                logger.info(`🔒 Preservando closing_date existente para job "${atJob.name}": ${existingJob.closing_date}`);
            } else {
                // Si no existe closing_date, dejarlo como null (no establecer fecha de hoy)
                // El closing_date solo debe venir del Performance spreadsheet
                logger.info(`ℹ️  Job "${atJob.name}" no tiene closing_date. Se mantendrá como null (vendrá del Performance spreadsheet si aplica).`);
            }

            // Solo mostrar logs de estimate si es "Nave test" o hay cambios
            if (isNaveTest) {
                if (estimate) {
                    logger.info(`📋 Estimate encontrado: ID ${estimate.id} (AT ID: ${atJob.job_estimate?.id})`);
                } else {
                    logger.warn(`⚠️  Estimate NO encontrado en nuestra BD para job: ${atJob.name} (AT Estimate ID: ${atJob.job_estimate?.id})`);
                }
            }

            // DETECCIÓN DE CAMBIO DE ESTADO: Requires Crew Lead → Plans In Progress
            let shouldNotify = false;
            if (existingJob) {
                // CRÍTICO: Para detectar cambios, comparar el status_id ACTUAL en nuestra BD
                // con el nuevo status que viene de Attic Tech
                // last_known_status_id solo se usa si existe, sino usamos status_id actual
                const oldStatusId = existingJob.status_id; // SIEMPRE usar el status_id actual de nuestra BD
                const newStatusId = status?.id; // El nuevo status que viene de Attic Tech
                const statusChanged = oldStatusId !== newStatusId;
                
                // Obtener nombre del estado ANTERIOR
                let oldStatusName = 'Unknown';
                if (existingJob.status?.name) {
                    oldStatusName = existingJob.status.name; // Usar el nombre del status_id actual
                } else if (existingJob.status_id) {
                    const oldStatusObj = await JobStatus.findByPk(existingJob.status_id);
                    oldStatusName = oldStatusObj?.name || 'Unknown';
                }
                
                const newStatusName = status?.name || 'Unknown';
                
                // SOLO mostrar logs detallados cuando hay cambio de estado o es "Nave test"
                if (statusChanged) {
                    // Log cuando HAY cambio de estado (siempre visible)
                    logger.info(`📝 ✅ CAMBIO DE ESTADO: "${atJob.name}" - ${oldStatusName} (ID ${oldStatusId}) → ${newStatusName} (ID ${newStatusId})`);
                    logger.info(`🔍 DEBUG - Comparación de estados:`, {
                        oldStatusName,
                        newStatusName,
                        oldStatusId,
                        newStatusId,
                        statusChanged,
                        isPlansToPending: oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review',
                        branchExists: !!branch,
                        branchId: branch?.id,
                        branchName: branch?.name
                    });
                } else if (isNaveTest) {
                    // Log detallado solo para "Nave test" aunque no haya cambio
                    logger.info(`🔍 DEBUG - Estado del job "Nave test" (sin cambios):`, {
                        existingJobId: existingJob.id,
                        last_known_status_id: existingJob.last_known_status_id,
                        current_status_id_in_db: existingJob.status_id,
                        new_status_id_from_at: newStatusId,
                        statusChanged,
                        current_status_name: existingJob.status?.name || 'N/A',
                        comparison: `BD: ${existingJob.status_id} vs AT: ${newStatusId}`
                    });
                    logger.info(`ℹ️  No hay cambio de estado para "Nave test": ${oldStatusName} (ID ${oldStatusId}) → ${newStatusName} (ID ${newStatusId})`);
                }
                // Si no hay cambio y no es "Nave test", no mostrar logs (reducir ruido)
                
                // ⚠️  RESETEAR NOTIFICACIÓN: Si el job regresa a "Requires Crew Leader"
                // Esto permite que el NUEVO crew leader reciba una notificación cuando sea asignado
                if (statusChanged && newStatusName === 'Requires Crew Lead') {
                    logger.info(`🔄 Job "${atJob.name}" regresó a "Requires Crew Leader". Reseteando notification_sent, registration_alert_sent y crew_leader_id...`);
                    await Job.update(
                        { 
                            notification_sent: false,
                            last_notification_sent_at: null,
                            registration_alert_sent: false, // Resetear alerta de registro también
                            crew_leader_id: null // Remover crew leader anterior
                        },
                        { where: { id: existingJob.id } }
                    );
                    logger.info(`✅ Notification reset completado para job: ${atJob.name}`);
                }

                // ⚠️  RESETEAR NOTIFICACIÓN: Si el crew_leader_id cambió (fue removido o cambiado a otro CL)
                // Esto asegura que el nuevo crew leader reciba su notificación
                const crewLeaderIdChanged = existingJob.crew_leader_id !== (crewLeader ? crewLeader.id : null);
                if (crewLeaderIdChanged && (existingJob.notification_sent || existingJob.registration_alert_sent)) {
                    logger.info(`🔄 Crew Leader cambió para job "${atJob.name}": ${existingJob.crew_leader_id} → ${crewLeader ? crewLeader.id : null}. Reseteando notification_sent y registration_alert_sent...`);
                    await Job.update(
                        { 
                            notification_sent: false,
                            last_notification_sent_at: null,
                            registration_alert_sent: false // Resetear alerta de registro también
                        },
                        { where: { id: existingJob.id } }
                    );
                    // Actualizar el registro en memoria para que el resto del código lo vea actualizado
                    existingJob.notification_sent = false;
                    existingJob.last_notification_sent_at = null;
                    existingJob.registration_alert_sent = false;
                    logger.info(`✅ Notification reset completado por cambio de crew leader para job: ${atJob.name}`);
                }

                // ⚠️  LIMPIEZA: Si notification_sent = true PERO no hay crew_leader_id, resetear
                // Esto cubre casos donde el crew leader fue removido en un sync anterior
                if (existingJob.notification_sent && !existingJob.crew_leader_id && !crewLeader) {
                    logger.warn(`🧹 Limpieza: Job "${atJob.name}" tiene notification_sent=true pero sin crew_leader_id. Reseteando...`);
                    await Job.update(
                        { 
                            notification_sent: false,
                            last_notification_sent_at: null
                        },
                        { where: { id: existingJob.id } }
                    );
                    existingJob.notification_sent = false;
                    existingJob.last_notification_sent_at = null;
                    logger.info(`✅ Limpieza completada para job: ${atJob.name}`);
                }
                
                // ⚠️  RESETEAR NOTIFICACIÓN: Si el job cambia A "Plans In Progress" desde CUALQUIER estado
                // Esto permite re-notificar al CL cuando hay cambios en el estimate/plan
                if (statusChanged && newStatusName === 'Plans In Progress' && oldStatusName !== 'Plans In Progress') {
                    logger.info(`🔄 Job "${atJob.name}" cambió a "Plans In Progress" desde "${oldStatusName}". Reseteando notification_sent para permitir nueva notificación...`);
                    await Job.update(
                        { 
                            notification_sent: false,
                            last_notification_sent_at: null
                            // NO resetear registration_alert_sent aquí (solo para cambios de CL)
                        },
                        { where: { id: existingJob.id } }
                    );
                    existingJob.notification_sent = false;
                    existingJob.last_notification_sent_at = null;
                    logger.info(`✅ Notification reset completado - CL será re-notificado sobre cambios en el job`);
                }
                
                // ESCENARIO 1: Detectar si cambió a "Plans In Progress" desde "Requires Crew Lead"
                if (statusChanged && oldStatusName === 'Requires Crew Lead' && newStatusName === 'Plans In Progress') {
                    if (crewLeader) {
                        shouldNotify = true;
                        logger.info(`🔔 Escenario 1: Estado cambió a "Plans In Progress" con Crew Leader asignado: ${atJob.name}`);
                        
                        // Verificar si el crew leader tiene telegram_id - ANTI-SPAM: enviar solo 1 vez
                        if (!crewLeader.telegram_id) {
                            logger.warn(`⚠️  Crew Leader "${getCrewLeaderName(crewLeader)}" no tiene telegram_id. Enviando alerta de registro (1x)...`);
                            
                            // Enviar webhook de alerta (crew leader debe registrarse) - SOLO 1 VEZ
                            await sendRegistrationAlertOnce(existingJob, {
                                crewLeaderId: crewLeader.id,
                                crewLeaderName: getCrewLeaderName(crewLeader),
                                crewLeaderEmail: crewLeader.email || 'No email',
                                jobName: atJob.name,
                                branchName: branch?.name || 'Unknown',
                                registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                                activeUser: false,
                                hasTelegramId: false
                            }, atJob.name);
                        } else if (crewLeader.status !== 'active') {
                            logger.warn(`⚠️  Crew Leader "${getCrewLeaderName(crewLeader)}" tiene telegram_id pero no está aprobado (status: ${crewLeader.status}). Enviando alerta (1x)...`);
                            
                            // Enviar webhook de alerta (crew leader pendiente de aprobación) - SOLO 1 VEZ
                            await sendRegistrationAlertOnce(existingJob, {
                                crewLeaderId: crewLeader.id,
                                crewLeaderName: getCrewLeaderName(crewLeader),
                                crewLeaderEmail: crewLeader.email || 'No email',
                                jobName: atJob.name,
                                branchName: branch?.name || 'Unknown',
                                registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                                activeUser: false,
                                hasTelegramId: true
                            }, atJob.name);
                        }
                    } else if (crewLeaderFromAT) {
                        // Crew leader existe en AT pero NO en nuestra BD
                        logger.warn(`⚠️  Crew Leader "${crewLeaderFromAT.name}" NO encontrado en BD. Enviando alerta de registro (1x)...`);
                        
                        // Enviar webhook de alerta usando datos de AT - SOLO 1 VEZ
                        await sendRegistrationAlertOnce(existingJob, {
                            crewLeaderId: null,
                            crewLeaderName: crewLeaderFromAT.name,
                            crewLeaderEmail: crewLeaderFromAT.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            notInDatabase: true,
                            activeUser: false,
                            hasTelegramId: false
                        }, atJob.name);
                    } else {
                        logger.warn(`⚠️  Job cambió a "Plans In Progress" pero NO tiene Crew Leader asignado: ${atJob.name}`);
                    }
                }
                
                // NOTIFICACIÓN AL OPERATION MANAGER: Job cambió de "Plans In Progress" a "Pending Review"
                // Log detallado ANTES de la condición para debuggear
                if (statusChanged) {
                    logger.info(`🔍 EVALUANDO NOTIFICACIÓN PENDING REVIEW para "${atJob.name}":`, {
                        oldStatusName,
                        newStatusName,
                        oldStatusNameMatch: oldStatusName === 'Plans In Progress',
                        newStatusNameMatch: newStatusName === 'Pending Review',
                        branchExists: !!branch,
                        branchId: branch?.id,
                        branchName: branch?.name,
                        condition1: oldStatusName === 'Plans In Progress',
                        condition2: newStatusName === 'Pending Review',
                        condition3: !!branch,
                        allConditionsMet: statusChanged && oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review' && branch
                    });
                }
                
                if (statusChanged && oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review' && branch) {
                    logger.info(`🔔 Job cambió de "Plans In Progress" a "Pending Review": ${atJob.name} (Branch: ${branch.name})`);
                    logger.info(`🔍 DEBUG - Detalles del cambio:`, {
                        oldStatusName,
                        newStatusName,
                        oldStatusId,
                        newStatusId,
                        branchId: branch?.id,
                        branchName: branch?.name,
                        crewLeaderName: crewLeader ? getCrewLeaderName(crewLeader) : 'N/A'
                    });
                    const notification = await generatePendingReviewNotification(atJob, branch, estimate, crewLeader);
                    logger.info(`🔍 RESULTADO generatePendingReviewNotification para "${atJob.name}":`, {
                        notificationGenerated: !!notification,
                        hasTelegramId: notification?.telegram_id ? true : false,
                        telegramId: notification?.telegram_id || 'N/A',
                        notificationType: notification?.notification_type || 'N/A'
                    });
                    if (notification) {
                        notifications.push(notification);
                        logger.info(`✅ Notificación de Pending Review agregada para Operation Manager (telegram_id: ${notification.telegram_id || 'VACÍO - se enviará sin telegram'})`);
                    } else {
                        logger.warn(`⚠️  No se pudo generar notificación de Pending Review (verificar Operation Manager y telegram_id)`);
                    }
                } else if (statusChanged && oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review') {
                    // Log cuando falta branch
                    logger.warn(`⚠️  Job cambió a "Pending Review" pero NO tiene branch asignado: ${atJob.name}`, {
                        oldStatusName,
                        newStatusName,
                        branchExists: !!branch,
                        branchId: branch?.id
                    });
                } else if (statusChanged) {
                    // Log para otros cambios de estado para debuggear
                    logger.info(`📝 Cambio de estado detectado pero no coincide con Pending Review:`, {
                        jobName: atJob.name,
                        oldStatusName,
                        newStatusName,
                        statusChanged,
                        isPlansInProgress: oldStatusName === 'Plans In Progress',
                        isPendingReview: newStatusName === 'Pending Review',
                        hasBranch: !!branch
                    });
                }
                
                // RECORDATORIO CONTINUO: Si el job tiene crew leader sin telegram_id - ANTI-SPAM: solo 1 vez
                if (!statusChanged && crewLeader && !crewLeader.telegram_id && newStatusName === 'Plans In Progress') {
                    logger.warn(`🔄 Recordatorio: Crew Leader "${getCrewLeaderName(crewLeader)}" aún no tiene telegram_id. Enviando alerta (1x)...`);
                    
                    await sendRegistrationAlertOnce(existingJob, {
                        crewLeaderId: crewLeader.id,
                        crewLeaderName: getCrewLeaderName(crewLeader),
                        crewLeaderEmail: crewLeader.email || 'No email',
                        jobName: atJob.name,
                        branchName: branch?.name || 'Unknown',
                        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                        activeUser: false,
                        hasTelegramId: false
                    }, atJob.name);
                }
                
                // RECORDATORIO CONTINUO: Si el crew leader tiene telegram_id pero NO está aprobado - ANTI-SPAM: solo 1 vez
                if (!statusChanged && crewLeader && crewLeader.telegram_id && crewLeader.status !== 'active' && newStatusName === 'Plans In Progress') {
                    logger.warn(`🔄 Recordatorio: Crew Leader "${getCrewLeaderName(crewLeader)}" tiene telegram_id pero aún no está aprobado (status: ${crewLeader.status}). Enviando alerta (1x)...`);
                    
                    await sendRegistrationAlertOnce(existingJob, {
                        crewLeaderId: crewLeader.id,
                        crewLeaderName: getCrewLeaderName(crewLeader),
                        crewLeaderEmail: crewLeader.email || 'No email',
                        jobName: atJob.name,
                        branchName: branch?.name || 'Unknown',
                        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                        activeUser: false,
                        hasTelegramId: true
                    }, atJob.name);
                }
                
                // RECORDATORIO CONTINUO: Si el job tiene crew leader de AT pero NO en BD - ANTI-SPAM: solo 1 vez
                if (!statusChanged && !crewLeader && crewLeaderFromAT && newStatusName === 'Plans In Progress') {
                    logger.warn(`🔄 Recordatorio: Crew Leader "${crewLeaderFromAT.name}" aún NO está en BD. Enviando alerta (1x)...`);
                    
                    await sendRegistrationAlertOnce(existingJob, {
                        crewLeaderId: null,
                        crewLeaderName: crewLeaderFromAT.name,
                        crewLeaderEmail: crewLeaderFromAT.email || 'No email',
                        jobName: atJob.name,
                        branchName: branch?.name || 'Unknown',
                        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                        notInDatabase: true,
                        activeUser: false,
                        hasTelegramId: false
                    }, atJob.name);
                }
                
                // ESCENARIO 2: Job ya está en "Plans In Progress" pero se le asignó crew leader ahora
                const crewLeaderChanged = existingJob.crew_leader_id !== jobData.crew_leader_id;
                const isPlansInProgress = newStatusName === 'Plans In Progress';
                const hadNoCrewLeader = !existingJob.crew_leader_id;
                const hadCrewLeader = !!existingJob.crew_leader_id;
                const nowHasCrewLeader = !!crewLeader;
                const nowHasCrewLeaderFromAT = !!crewLeaderFromAT;
                
                if (!shouldNotify && isPlansInProgress && crewLeaderChanged && hadNoCrewLeader) {
                    if (nowHasCrewLeader) {
                        shouldNotify = true;
                        logger.info(`🔔 Escenario 2: Crew Leader asignado a job existente en "Plans In Progress": ${atJob.name}`);
                        
                        // Verificar si el crew leader tiene telegram_id - ANTI-SPAM: solo 1 vez
                        if (!crewLeader.telegram_id) {
                            logger.warn(`⚠️  Crew Leader "${getCrewLeaderName(crewLeader)}" no tiene telegram_id. Enviando alerta de registro (1x)...`);
                            
                            // Enviar webhook de alerta (crew leader debe registrarse) - SOLO 1 VEZ
                            await sendRegistrationAlertOnce(existingJob, {
                                crewLeaderId: crewLeader.id,
                                crewLeaderName: getCrewLeaderName(crewLeader),
                                crewLeaderEmail: crewLeader.email || 'No email',
                                jobName: atJob.name,
                                branchName: branch?.name || 'Unknown',
                                registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                                activeUser: false,
                                hasTelegramId: false
                            }, atJob.name);
                        } else if (crewLeader.status !== 'active') {
                            logger.warn(`⚠️  Crew Leader "${getCrewLeaderName(crewLeader)}" tiene telegram_id pero no está aprobado (status: ${crewLeader.status}). Enviando alerta (1x)...`);
                            
                            // Enviar webhook de alerta (crew leader pendiente de aprobación) - SOLO 1 VEZ
                            await sendRegistrationAlertOnce(existingJob, {
                                crewLeaderId: crewLeader.id,
                                crewLeaderName: getCrewLeaderName(crewLeader),
                                crewLeaderEmail: crewLeader.email || 'No email',
                                jobName: atJob.name,
                                branchName: branch?.name || 'Unknown',
                                registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                                activeUser: false,
                                hasTelegramId: true
                            }, atJob.name);
                        }
                    } else if (nowHasCrewLeaderFromAT) {
                        // Crew leader existe en AT pero NO en nuestra BD
                        logger.warn(`⚠️  Crew Leader "${crewLeaderFromAT.name}" NO encontrado en BD (Escenario 2). Enviando alerta de registro (1x)...`);
                        
                        // Enviar webhook de alerta usando datos de AT - SOLO 1 VEZ
                        await sendRegistrationAlertOnce(existingJob, {
                            crewLeaderId: null,
                            crewLeaderName: crewLeaderFromAT.name,
                            crewLeaderEmail: crewLeaderFromAT.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            notInDatabase: true,
                            activeUser: false,
                            hasTelegramId: false
                        }, atJob.name);
                    }
                }
                
                // ESCENARIO 3: Job está en estado ACTIVO CON crew leader, pero se CAMBIA por otro
                // Este es el caso que el Operation Manager quiere: mantener el plan pero cambiar al crew leader
                // Estados activos: Plans In Progress, In Production, Job in Progress, Uploading Shifts, Missing Data to Close, Pending Review
                const activeJobStatuses = ['Plans In Progress', 'In Production', 'Job in Progress', 'Uploading Shifts', 'Missing Data to Close', 'Pending Review'];
                const isActiveJob = activeJobStatuses.includes(newStatusName);
                
                if (!shouldNotify && isActiveJob && crewLeaderChanged && hadCrewLeader && nowHasCrewLeader) {
                    shouldNotify = true;
                    logger.info(`🔔 Escenario 3: Crew Leader REEMPLAZADO en job ACTIVO: ${atJob.name}`);
                    logger.info(`   📊 Estado actual: ${newStatusName}`);
                    logger.info(`   👤 Crew Leader anterior: ID ${existingJob.crew_leader_id}`);
                    logger.info(`   👤 Crew Leader nuevo: ${getCrewLeaderName(crewLeader)} (ID ${crewLeader.id})`);
                    
                    // Verificar si el NUEVO crew leader tiene telegram_id - ANTI-SPAM: solo 1 vez
                    if (!crewLeader.telegram_id) {
                        logger.warn(`⚠️  Nuevo Crew Leader "${getCrewLeaderName(crewLeader)}" no tiene telegram_id. Enviando alerta de registro (1x)...`);
                        
                        // Enviar webhook de alerta (crew leader debe registrarse) - SOLO 1 VEZ
                        await sendRegistrationAlertOnce(existingJob, {
                            crewLeaderId: crewLeader.id,
                            crewLeaderName: getCrewLeaderName(crewLeader),
                            crewLeaderEmail: crewLeader.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            activeUser: false,
                            hasTelegramId: false
                        }, atJob.name);
                    } else if (crewLeader.status !== 'active') {
                        logger.warn(`⚠️  Nuevo Crew Leader "${getCrewLeaderName(crewLeader)}" tiene telegram_id pero no está aprobado (status: ${crewLeader.status}). Enviando alerta (1x)...`);
                        
                        // Enviar webhook de alerta (crew leader pendiente de aprobación) - SOLO 1 VEZ
                        await sendRegistrationAlertOnce(existingJob, {
                            crewLeaderId: crewLeader.id,
                            crewLeaderName: getCrewLeaderName(crewLeader),
                            crewLeaderEmail: crewLeader.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            activeUser: false,
                            hasTelegramId: true
                        }, atJob.name);
                    } else {
                        // Crew leader nuevo está activo y tiene telegram_id - ¡notificar!
                        logger.info(`✅ Nuevo Crew Leader "${getCrewLeaderName(crewLeader)}" está activo y tiene telegram_id. Notificación será enviada.`);
                    }
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
                    // IMPORTANTE: Guardar el status_id ACTUAL como last_known_status_id ANTES de actualizar
                    // Esto permite detectar cambios en el próximo sync
                    jobData.last_known_status_id = existingJob.status_id; // Guardar el estado ACTUAL antes de cambiarlo

                    await Job.update(jobData, {
                        where: { id: existingJob.id }
                    });
                    updatedCount++;
                    // Solo mostrar log de actualización si hay cambios de estado o es "Nave test"
                    if (statusChanged || isNaveTest) {
                        logger.info(`🔄 Updated job: ${atJob.name} (AT ID: ${atJob.id}) - last_known_status_id guardado como: ${existingJob.status_id}`);
                    }
                } else {
                    // IMPORTANTE: Si no hay cambios, actualizar last_known_status_id al status_id actual
                    // Esto asegura que en el próximo sync podamos detectar cambios
                    await Job.update(
                        { 
                            last_synced_at: new Date(),
                            last_known_status_id: existingJob.status_id // Guardar el estado actual
                        }, 
                        { where: { id: existingJob.id } }
                    );
                    // Solo mostrar log si es "Nave test"
                    if (isNaveTest) {
                        logger.debug(`✓ No changes for job: ${atJob.name} (AT ID: ${atJob.id}), last_known_status_id actualizado a: ${existingJob.status_id}`);
                    }
                }

                // Generar notificación si es necesario (el sistema existente la enviará)
                // SOLO para usuarios ACTIVOS (status = 'active')
                const needsNotification = shouldNotify || 
                    (!existingJob.notification_sent && crewLeader && crewLeader.telegram_id && crewLeader.status === 'active' && newStatusName === 'Plans In Progress');
                
                // Determinar el contexto de la notificación
                // Si es un cambio de crew leader (Escenario 3), usar un identificador especial
                const wasCrewLeaderReplaced = isActiveJob && crewLeaderChanged && hadCrewLeader && nowHasCrewLeader;
                const notificationContext = wasCrewLeaderReplaced ? 'Crew Leader Replaced' : oldStatusName;
                
                // DEBUG ESPECÍFICO PARA "Nave test"
                if (atJob.name && atJob.name.toLowerCase().includes('nave test')) {
                    logger.info(`🔍🔍🔍 DEBUG COMPLETO PARA "Nave test" 🔍🔍🔍`);
                    logger.info(`📊 Estado del job:`, {
                        jobName: atJob.name,
                        jobId: existingJob?.id,
                        atticTechJobId: atJob.id,
                        statusChanged,
                        oldStatusId,
                        newStatusId,
                        oldStatusName,
                        newStatusName,
                        last_known_status_id: existingJob?.last_known_status_id,
                        current_status_id: existingJob?.status_id,
                        branchId: branch?.id,
                        branchName: branch?.name,
                        branchExists: !!branch,
                        crewLeaderId: crewLeader?.id,
                        crewLeaderName: crewLeader ? getCrewLeaderName(crewLeader) : 'N/A',
                        estimateId: estimate?.id,
                        isPlansToPending: oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review',
                        conditionMet: statusChanged && oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review' && branch,
                        shouldNotify,
                        needsNotification,
                        notificationSent: existingJob?.notification_sent
                    });
                    
                    // Verificar Operation Manager
                    if (branch) {
                        const operationManager = await findOperationManager(branch.id);
                        logger.info(`👤 Operation Manager para branch ${branch.id}:`, {
                            found: !!operationManager,
                            hasTelegramId: operationManager?.telegram_id ? true : false,
                            telegramId: operationManager?.telegram_id || 'N/A',
                            email: operationManager?.email || 'N/A'
                        });
                    } else {
                        logger.warn(`⚠️  NO HAY BRANCH para "Nave test" - esto impedirá la notificación`);
                    }
                    
                    logger.info(`🔍🔍🔍 FIN DEBUG "Nave test" 🔍🔍🔍`);
                }
                
                if (needsNotification && !existingJob.notification_sent && crewLeader && crewLeader.telegram_id && crewLeader.status === 'active') {
                    const notification = await generateNotification(atJob, crewLeader, branch, estimate, notificationContext);
                    if (notification) {
                        // Agregar a la lista de notificaciones
                        // El sistema existente (que se ejecuta cada 15 min) las procesará
                        notifications.push(notification);
                        
                        logger.info(`📨 Notificación generada para Crew Leader activo: ${getCrewLeaderName(crewLeader)} (será enviada por el sistema de notificaciones)`);
                        
                        // Marcar como notificado
                        await Job.update(
                            { 
                                notification_sent: true,
                                last_notification_sent_at: new Date()
                            },
                            { where: { id: existingJob.id } }
                        );
                        logger.info(`✅ Marcado notification_sent = true para job: ${atJob.name}`);
                    }
                } else if (needsNotification && !existingJob.notification_sent && crewLeader && crewLeader.telegram_id && crewLeader.status !== 'active') {
                    // Crew leader tiene telegram_id pero NO está aprobado → Enviar webhook de alerta - ANTI-SPAM: solo 1 vez
                    logger.warn(`⚠️  Crew Leader "${getCrewLeaderName(crewLeader)}" tiene telegram_id pero no está aprobado (status: ${crewLeader.status}). Enviando alerta al admin (1x)...`);
                    
                    await sendRegistrationAlertOnce(existingJob, {
                        crewLeaderId: crewLeader.id,
                        crewLeaderName: getCrewLeaderName(crewLeader),
                        crewLeaderEmail: crewLeader.email || 'No email',
                        jobName: atJob.name,
                        branchName: branch?.name || 'Unknown',
                        registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                        activeUser: false,
                        hasTelegramId: true
                    }, atJob.name);
                }
            } else {
                // Crear nuevo job
                jobData.last_known_status_id = status?.id || null;
                jobData.notification_sent = false;

                await Job.create(jobData);
                newCount++;
                logger.info(`✅ Created new job: ${atJob.name} (AT ID: ${atJob.id})`);

                const newStatus = status?.name;
                
                // ESCENARIO 1 (Job Nuevo): Si el job viene con crew leader en AT pero NO está en nuestra BD
                // NOTA: Para jobs nuevos, no hay existingJob, así que usamos newJob después de crear
                if (newStatus === 'Plans In Progress' && !crewLeader && crewLeaderFromAT) {
                    logger.warn(`⚠️  Nuevo job con Crew Leader "${crewLeaderFromAT.name}" NO encontrado en BD. Enviando alerta (1x)...`);
                    
                    // Para jobs nuevos, necesitamos buscar el job recién creado
                    const newJob = await Job.findOne({ where: { attic_tech_job_id: atJob.id } });
                    if (newJob) {
                        // Enviar webhook de alerta usando datos de AT - SOLO 1 VEZ
                        await sendRegistrationAlertOnce(newJob, {
                            crewLeaderId: null,
                            crewLeaderName: crewLeaderFromAT.name,
                            crewLeaderEmail: crewLeaderFromAT.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            notInDatabase: true,
                            activeUser: false,
                            hasTelegramId: false
                        }, atJob.name);
                    }
                }
                
                // NOTIFICACIÓN AL OPERATION MANAGER: Nuevo job con "Requires Crew Lead"
                if (newStatus === 'Requires Crew Lead' && branch) {
                    logger.info(`🔔 Nuevo job con estado "Requires Crew Lead": ${atJob.name} (Branch: ${branch.name})`);
                    const notification = await generateOperationManagerNotification(atJob, branch, estimate);
                    if (notification) {
                        notifications.push(notification);
                    }
                }
                
                // NOTIFICACIÓN AL CREW LEADER: Nuevo job con "Plans In Progress" y crew leader activo
                if (newStatus === 'Plans In Progress' && crewLeader && crewLeader.telegram_id && crewLeader.status === 'active') {
                    // Para jobs nuevos, el previousStatus es 'Requires Crew Lead' por defecto (nueva asignación)
                    const notification = await generateNotification(atJob, crewLeader, branch, estimate, 'Requires Crew Lead');
                    if (notification) {
                        notifications.push(notification);
                        logger.info(`📨 Notificación generada para Crew Leader activo (nuevo job): ${getCrewLeaderName(crewLeader)}`);
                    }
                } else if (newStatus === 'Plans In Progress' && crewLeader && crewLeader.telegram_id && crewLeader.status !== 'active') {
                    // Crew leader tiene telegram_id pero NO está aprobado
                    logger.warn(`⚠️  Nuevo job con Crew Leader "${getCrewLeaderName(crewLeader)}" pendiente de aprobación (status: ${crewLeader.status}). Enviando alerta (1x)...`);
                    
                    // Para jobs nuevos, buscar el job recién creado
                    const newJob = await Job.findOne({ where: { attic_tech_job_id: atJob.id } });
                    if (newJob) {
                        await sendRegistrationAlertOnce(newJob, {
                            crewLeaderId: crewLeader.id,
                            crewLeaderName: getCrewLeaderName(crewLeader),
                            crewLeaderEmail: crewLeader.email || 'No email',
                            jobName: atJob.name,
                            branchName: branch?.name || 'Unknown',
                            registrationUrl: `${process.env.FRONTEND_URL || 'http://localhost:5173'}/employee-registration`,
                            activeUser: false,
                            hasTelegramId: true
                        }, atJob.name);
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
 * @param {Object} atJob - Job from Attic Tech
 * @param {Object} crewLeader - Crew Leader from our DB
 * @param {Object} branch - Branch from our DB
 * @param {Object} estimate - Estimate from our DB
 * @param {String} previousStatus - Previous job status (optional, for contextual messages)
 */
async function generateNotification(atJob, crewLeader, branch, estimate, previousStatus = null) {
    try {
        // Determinar tipo de notificación y mensaje contextual
        let notificationType = 'Crew Leader Assigned';
        let contextMessage = null;
        
        if (previousStatus) {
            if (previousStatus === 'Crew Leader Replaced') {
                notificationType = 'Job Reassigned with Existing Plan';
                contextMessage = 'You have been assigned a job with an approved plan. Please review the plan and proceed with execution.';
            } else if (previousStatus === 'Pending Review') {
                notificationType = 'Job Plan Changes Required';
                contextMessage = 'Changes detected in the estimate. Please recreate the plan.';
            } else if (previousStatus === 'Requires Crew Lead') {
                notificationType = 'New Job Assigned';
                contextMessage = 'New job assigned! Please create the plan.';
            } else {
                notificationType = 'Job Returned to Planning';
                contextMessage = 'Job returned to planning phase. Please review and update the plan.';
            }
        }
        
        // Priorizar datos de NUESTRA BD si el estimate existe
        const notification = {
            job_name: atJob.name,
            cx_name: estimate?.customer_name || atJob.job_estimate?.customer?.name || 'N/A',
            cx_phone: estimate?.customer_phone || atJob.job_estimate?.customer?.phone || null,
            job_address: estimate?.customer_address || atJob.job_estimate?.customer?.address || 'N/A',
            branch: branch?.name || 'N/A',
            salesperson_name: estimate?.SalesPerson?.name || atJob.job_estimate?.salesperson?.name || 'N/A',
            client_email: estimate?.customer_email || atJob.job_estimate?.customer?.email || null,
            crew_leader_name: getCrewLeaderName(crewLeader), // Nombre del crew leader asignado
            job_link: `https://www.attic-tech.com/jobs/${atJob.id}`,
            notification_type: notificationType,
            context_message: contextMessage, // Mensaje contextual para el CL
            telegram_id: crewLeader.telegram_id
        };

        logger.info(`📨 Notificación generada para Crew Leader: ${getCrewLeaderName(crewLeader)} (Job: ${atJob.name}, Type: ${notificationType})`);
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
     * - days_back: número de días hacia atrás para buscar (default: 1 = último día)
     *   Ejemplo: ?days_back=7 para traer jobs de los últimos 7 días
     */
    async syncJobs(req, res) {
        const startTime = Date.now();
        
        try {
            logger.info('🚀 Starting job sync from Attic Tech...');

            // Parámetro opcional para testing: cuántos días hacia atrás buscar (default 1 día)
            const daysBack = parseInt(req.query.days_back || req.body.days_back || '1', 10);
            
            // Calcular fecha desde
            const fromDateObj = new Date();
            fromDateObj.setDate(fromDateObj.getDate() - daysBack);
            const fromDate = fromDateObj.toISOString().split('T')[0]; // YYYY-MM-DD
            const today = new Date().toISOString().split('T')[0];

            logger.info(`📅 Syncing jobs from last ${daysBack} days: ${fromDate} to ${today}`);

            // 1. Login a Attic Tech
            const apiKey = await loginToAtticTech();

            // 2. Fetch jobs actualizados HOY
            const jobsFromAT = await fetchJobsFromAtticTech(apiKey, fromDate);

            if (jobsFromAT.length === 0) {
                return res.status(200).json({
                    success: true,
                    message: `No jobs updated in the last ${daysBack} days`,
                    data: {
                        totalJobs: 0,
                        newJobs: 0,
                        updatedJobs: 0,
                        syncDate: today,
                        fromDate: fromDate,
                        daysBack
                    }
                });
            }

            // 3. Guardar en BD y detectar cambios de estado
            const { newCount, updatedCount, errors, notifications } = await saveJobsToDb(jobsFromAT);

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            const notificationCount = notifications.length;
            const message = notificationCount > 0 
                ? `Job sync completed. ${notificationCount} notification${notificationCount > 1 ? 's' : ''} sent.`
                : 'Job sync completed successfully. No notifications sent.';

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
                    fromDate: fromDate,
                    daysBack
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

