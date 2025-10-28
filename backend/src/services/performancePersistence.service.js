/**
 * Servicio para guardar datos de Performance de forma permanente
 * Maneja la persistencia de jobs y shifts desde el flujo de Performance
 */

const { logger } = require('../utils/logger');
const Job = require('../models/Job');
const Shift = require('../models/Shift');
const Employee = require('../models/Employee');
const Branch = require('../models/Branch');
const BuilderTrendShift = require('../models/BuilderTrendShift');
const PerformanceSyncJob = require('../models/PerformanceSyncJob');
const Estimate = require('../models/Estimate');
const JobStatus = require('../models/JobStatus');
const { Op } = require('sequelize');
const sequelize = require('../config/database');

/**
 * Determina el estado del branch (CA o WA) para saber qué columna usar para sold_price
 * @param {string} branchName - Nombre del branch
 * @returns {string|null} - 'CA', 'WA', o null
 */
function getBranchState(branchName) {
    const caBranches = ['Riverside', 'San Diego', 'San Bernardino', 'Orange County', 'Los Angeles'];
    const waBranches = ['Kent', 'Everett', 'Seattle'];
    
    if (caBranches.some(ca => branchName.includes(ca))) return 'CA';
    if (waBranches.some(wa => branchName.includes(wa))) return 'WA';
    
    return null;
}

/**
 * Busca o crea un employee por nombre
 * @param {string} fullName - Nombre completo del empleado
 * @param {number} branchId - ID del branch
 * @returns {Promise<Employee|null>} - Employee encontrado o creado
 */
async function findOrCreateEmployee(fullName, branchId) {
    if (!fullName || !fullName.trim()) {
        logger.warn('Empty employee name provided');
        return null;
    }
    
    // Limpiar nombre: remover paréntesis y su contenido (ej: "Drew Gipson (D)" → "Drew Gipson")
    const cleanedName = fullName.trim().replace(/\s*\([^)]*\)/g, '').trim();
    
    const nameParts = cleanedName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || firstName;
    
    // Buscar employee existente por nombre
    let employee = await Employee.findOne({
        where: {
            first_name: { [Op.iLike]: firstName },
            last_name: { [Op.iLike]: lastName },
            is_deleted: false
        }
    });
    
    // Si no existe, crear uno nuevo (pendiente de aprobación)
    if (!employee) {
        logger.info('Creating new employee from Performance', {
            first_name: firstName,
            last_name: lastName,
            branch_id: branchId
        });
        
        // Generar email válido sin espacios ni caracteres especiales
        const emailSafeFirstName = firstName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const emailSafeLastName = lastName.toLowerCase().replace(/[^a-z0-9]/g, '');
        const timestamp = Date.now(); // Para evitar duplicados
        const generatedEmail = `${emailSafeFirstName}.${emailSafeLastName}.${timestamp}@pending.local`;
        
        employee = await Employee.create({
            first_name: firstName,
            last_name: lastName,
            email: generatedEmail,
            role: 'crew_member',
            status: 'pending',
            branch_id: branchId
        });
        
        logger.info('Employee created with generated email', {
            employee_id: employee.id,
            email: generatedEmail
        });
    }
    
    return employee;
}

/**
 * Guarda o actualiza un job desde Performance
 * @param {Object} jobData - Datos del job desde Performance
 * @param {string} jobData.job_name - Nombre del job
 * @param {Date} jobData.closing_date - Fecha de cierre
 * @param {number} jobData.sold_price - Precio cobrado
 * @param {number} jobData.crew_leader_id - ID del crew leader (employee)
 * @param {number} jobData.branch_id - ID del branch
 * @param {number} jobData.attic_tech_hours - Horas estimadas de Attic Tech (opcional)
 * @param {boolean} autoApprove - Si debe auto-aprobar o requerir aprobación
 * @returns {Promise<Job>} - Job guardado o actualizado
 */
async function saveOrUpdateJob(jobData, autoApprove = false) {
    const { job_name, closing_date, sold_price, crew_leader_id, branch_id, attic_tech_hours } = jobData;
    const fuzz = require('fuzzball');
    
    // Función para normalizar nombres (quitar sufijos comunes)
    const normalizeJobName = (name) => {
        if (!name) return '';
        return name
            .replace(/\s*-\s*(ARL|REVISED|SM|CLI|PM|SD|LAK|WA|CA)\s*$/i, '') // Quitar sufijos comunes
            .replace(/\s+/g, ' ') // Normalizar espacios
            .trim();
    };
    
    const normalizedJobName = normalizeJobName(job_name);
    
    // Buscar job existente por nombre exacto o normalizado
    let job = await Job.findOne({
        where: {
            [Op.or]: [
                { name: job_name },
                { name: normalizedJobName }
            ],
            branch_id: branch_id
        }
    });
    
    // Si no se encuentra exacto, buscar usando fuzzy matching (85%+ similitud) con nombres normalizados
    if (!job) {
        const existingJobs = await Job.findAll({
            where: { branch_id: branch_id },
            attributes: ['id', 'name', 'sold_price', 'crew_leader_id', 'attic_tech_hours', 'closing_date', 'performance_status']
        });
        
        if (existingJobs.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            
            existingJobs.forEach(existingJob => {
                // Normalizar ambos nombres para comparar
                const normalizedExistingName = normalizeJobName(existingJob.name);
                
                const ratio = fuzz.ratio(normalizedJobName, normalizedExistingName);
                const partialRatio = fuzz.partial_ratio(normalizedJobName, normalizedExistingName);
                const tokenSortRatio = fuzz.token_sort_ratio(normalizedJobName, normalizedExistingName);
                const tokenSetRatio = fuzz.token_set_ratio(normalizedJobName, normalizedExistingName);
                
                const score = Math.max(ratio, partialRatio, tokenSortRatio, tokenSetRatio);
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = existingJob;
                }
            });
            
            // Threshold: 85% para evitar duplicados
            if (bestMatch && bestScore >= 85) {
                job = bestMatch;
                logger.info('Existing job found using fuzzy matching (85%+ threshold)', {
                    job_name,
                    existing_job_name: job.name,
                    existing_job_id: job.id,
                    similarity: bestScore.toFixed(2) + '%'
                });
            } else if (bestMatch && bestScore >= 70) {
                logger.warn('Possible duplicate job detected but below 85% threshold (not matched)', {
                    job_name,
                    possible_match: bestMatch.name,
                    similarity: bestScore.toFixed(2) + '%'
                });
            }
        }
    }
    
    if (job) {
        // Job existe → actualizar
        // Si el job ya está 'synced' (aprobado anteriormente), mantenerlo así y no pedir aprobación nuevamente
        const shouldKeepSynced = job.performance_status === 'synced';
        const newPerformanceStatus = shouldKeepSynced ? 'synced' : (autoApprove ? 'synced' : 'pending_approval');
        
        logger.info('Updating existing job from Performance', {
            job_id: job.id,
            job_name,
            existing_name: job.name,
            old_sold_price: job.sold_price,
            new_sold_price: sold_price,
            old_performance_status: job.performance_status,
            new_performance_status: newPerformanceStatus,
            kept_synced: shouldKeepSynced
        });
        
        await job.update({
            closing_date,
            sold_price,
            crew_leader_id,
            attic_tech_hours: attic_tech_hours || job.attic_tech_hours, // Mantener el existente si no viene nuevo
            performance_status: newPerformanceStatus // Mantener 'synced' si ya estaba aprobado
        });
    } else {
        // Job no existe → crear nuevo
        logger.info('Creating new job from Performance', {
            job_name,
            branch_id,
            sold_price
        });
        
        // Buscar estimate en nuestra BD por nombre (ya están sincronizados desde AT)
        let estimateId = null;
        let statusId = null;
        
        try {
            // Buscar estimate por nombre exacto
            let estimate = await Estimate.findOne({
                where: {
                    name: {
                        [Op.iLike]: job_name.trim()
                    },
                    branch_id: branch_id
                }
            });
            
            // Si no se encuentra exacto, buscar usando fuzzy matching
            if (!estimate) {
                const fuzz = require('fuzzball');
                
                // Obtener todos los estimates del branch
                const allEstimates = await Estimate.findAll({
                    where: { branch_id: branch_id },
                    attributes: ['id', 'name', 'sales_person_id']
                });
                
                logger.info('Attempting fuzzy match for estimate', {
                    job_name,
                    branch_id,
                    total_estimates: allEstimates.length
                });
                
                if (allEstimates.length > 0) {
                    // Buscar el mejor match usando fuzzball directamente
                    let bestMatch = null;
                    let bestScore = 0;
                    
                    allEstimates.forEach(est => {
                        // Usar múltiples algoritmos y tomar el máximo
                        const ratio = fuzz.ratio(job_name, est.name);
                        const partialRatio = fuzz.partial_ratio(job_name, est.name);
                        const tokenSortRatio = fuzz.token_sort_ratio(job_name, est.name);
                        const tokenSetRatio = fuzz.token_set_ratio(job_name, est.name);
                        
                        const score = Math.max(ratio, partialRatio, tokenSortRatio, tokenSetRatio);
                        
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = est;
                        }
                    });
                    
                    logger.info('Fuzzy match result', {
                        job_name,
                        bestMatch: bestMatch?.name || null,
                        score: bestScore.toFixed(2),
                        threshold: 85
                    });
                    
                    // Si el score es >= 85%, usar ese estimate
                    if (bestMatch && bestScore >= 85) {
                        estimate = bestMatch;
                        logger.info('Estimate found using fuzzy matching (85%+ threshold)', {
                            job_name,
                            estimate_name: estimate.name,
                            similarity: bestScore.toFixed(2) + '%'
                        });
                    }
                }
            }
            
            if (estimate) {
                estimateId = estimate.id;
                logger.info('Estimate linked to Performance job', {
                    job_name,
                    estimate_id: estimateId,
                    estimate_name: estimate.name,
                    sales_person_id: estimate.sales_person_id
                });
                
                // Buscar status "Closed Job" para jobs de Performance
                const status = await JobStatus.findOne({
                    where: { 
                        name: {
                            [Op.iLike]: 'Closed Job'
                        }
                    }
                });
                
                if (status) {
                    statusId = status.id;
                    logger.info('Status "Closed Job" assigned to Performance job', {
                        status_id: statusId,
                        job_name
                    });
                }
            } else {
                logger.warn('Estimate not found in our DB (even with fuzzy matching)', { 
                    job_name,
                    branch_id
                });
            }
        } catch (error) {
            logger.error('Error finding estimate in our DB', {
                job_name,
                error: error.message
            });
            // Continuar sin estimate
        }
        
        job = await Job.create({
            name: job_name,
            closing_date,
            sold_price,
            crew_leader_id,
            branch_id,
            attic_tech_hours,
            estimate_id: estimateId,
            status_id: statusId,
            notification_sent: false,
            last_synced_at: new Date(),
            performance_status: autoApprove ? 'synced' : 'pending_approval'
        });
        
        logger.info('Job created from Performance', {
            job_id: job.id,
            estimate_id: estimateId,
            status_id: statusId,
            has_estimate: !!estimateId
        });
    }
    
    return job;
}

/**
 * Guarda un Special Shift QC para un job
 * @param {number} jobId - ID del job
 * @param {number} hours - Horas totales de QC
 * @param {boolean} autoApprove - Si debe auto-aprobar o requerir aprobación
 * @returns {Promise<void>}
 */
async function saveQCSpecialShift(jobId, hours, autoApprove = false) {
    const JobSpecialShift = require('../models/JobSpecialShift');
    const SpecialShift = require('../models/SpecialShift');
    
    try {
        logger.info('🔍 SEARCHING FOR QC SPECIAL SHIFT IN DB', { jobId, hours, autoApprove });
        
        // Buscar el Special Shift "QC" (ID: 4)
        const qcSpecialShift = await SpecialShift.findOne({
            where: { name: 'QC' }
        });
        
        if (!qcSpecialShift) {
            logger.error('❌ QC SPECIAL SHIFT NOT FOUND IN DB');
            return;
        }
        
        logger.info('✅ QC SPECIAL SHIFT FOUND', {
            id: qcSpecialShift.id,
            name: qcSpecialShift.name
        });
        
        // Verificar si ya existe un registro QC para este job
        const existing = await JobSpecialShift.findOne({
            where: {
                job_id: jobId,
                special_shift_id: qcSpecialShift.id
            }
        });
        
        if (existing) {
            // Actualizar horas (sumar si ya existía)
            const newHours = parseFloat(existing.hours) + hours;
            await existing.update({
                hours: newHours
            });
            logger.info('🔄 QC SPECIAL SHIFT UPDATED (ADDED HOURS)', {
                job_id: jobId,
                old_hours: existing.hours,
                added_hours: hours,
                new_hours: newHours
            });
        } else {
            // Crear nuevo registro
            logger.info('📝 CREATING NEW JOB_SPECIAL_SHIFT RECORD', {
                job_id: jobId,
                special_shift_id: qcSpecialShift.id,
                date: new Date().toISOString(),
                hours: hours,
                approved_shift: autoApprove
            });
            
            const created = await JobSpecialShift.create({
                job_id: jobId,
                special_shift_id: qcSpecialShift.id,
                date: new Date(), // Fecha actual para el special shift
                hours: hours,
                approved_shift: autoApprove // Corrected field name
            });
            
            logger.info('✅ JOB_SPECIAL_SHIFT RECORD CREATED', {
                job_id: created.job_id,
                special_shift_id: created.special_shift_id,
                date: created.date,
                hours: created.hours,
                approved_shift: created.approved_shift
            });
        }
    } catch (error) {
        logger.error('Error saving QC Special Shift', {
            job_id: jobId,
            hours: hours,
            error: error.message
        });
        throw error;
    }
}

/**
 * Guarda shifts de Performance para un job
 * @param {number} jobId - ID del job
 * @param {Array} shiftsData - Array de shifts a guardar
 * @param {boolean} autoApprove - Si debe auto-aprobar o requerir aprobación
 * @returns {Promise<Object>} - Resultado del guardado
 */
async function saveShifts(jobId, shiftsData, autoApprove = false) {
    const results = {
        created: 0,
        skipped: 0,
        errors: []
    };
    
    for (const shiftData of shiftsData) {
        try {
            const { employee_id, hours } = shiftData;
            
            if (!employee_id || !hours) {
                logger.warn('Shift missing required data', { employee_id, hours });
                results.skipped++;
                continue;
            }
            
            // Verificar si el shift ya existe (mismo employee + job)
            const existingShift = await Shift.findOne({
                where: {
                    employee_id: employee_id,
                    job_id: jobId
                }
            });
            
            if (existingShift) {
                // Shift ya existe → actualizar horas (sumar o reemplazar según necesites)
                logger.info('Shift already exists, updating hours', {
                    job_id: jobId,
                    employee_id,
                    old_hours: existingShift.hours,
                    new_hours: hours
                });
                
                await existingShift.update({
                    hours: parseFloat(existingShift.hours) + parseFloat(hours) // Sumar horas
                });
                
                results.skipped++;
            } else {
                // Crear nuevo shift
                // crew_member_id es PK, así que usamos el employee_id como valor
                // Esto funciona porque employee_id es el ID real de la persona
                await Shift.create({
                    crew_member_id: employee_id, // PK: usamos employee_id
                    employee_id: employee_id,    // FK: referencia a employee
                    job_id: jobId,
                    hours: hours,
                    approved_shift: autoApprove, // Auto-aprobar si se especifica
                    performance_status: autoApprove ? 'approved' : 'pending_approval' // Auto-aprobar o requerir aprobación
                });
                
                results.created++;
            }
        } catch (error) {
            logger.error('Error saving shift', {
                error: error.message,
                shift_data: shiftData
            });
            results.errors.push({
                shift: shiftData,
                error: error.message
            });
        }
    }
    
    return results;
}

/**
 * Procesa y guarda permanentemente los datos de Performance
 * @param {string} syncId - UUID del sync
 * @returns {Promise<Object>} - Resultado del proceso
 */
async function savePerformanceDataPermanently(syncId, selectedJobNames = null, autoApprove = false) {
    const transaction = await sequelize.transaction();
    
    try {
        logger.info('Starting permanent save of Performance data', { 
            syncId,
            selectedJobNames: selectedJobNames?.length || 'all',
            autoApprove
        });
        
        // 1. Obtener jobs del spreadsheet (PerformanceSyncJob)
        const whereClause = { sync_id: syncId };
        
        // Si hay jobs seleccionados, filtrar solo esos
        if (selectedJobNames && selectedJobNames.length > 0) {
            whereClause.job_name = { [Op.in]: selectedJobNames };
        }
        
        const syncJobs = await PerformanceSyncJob.findAll({
            where: whereClause,
            include: [
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                }
            ]
        });
        
        if (syncJobs.length === 0) {
            throw new Error('No sync jobs found for this sync_id');
        }
        
        const branchName = syncJobs[0].branch_name;
        const branchId = syncJobs[0].branch_id;
        const branchState = getBranchState(branchName);
        
        if (!branchState) {
            throw new Error(`Cannot determine state for branch: ${branchName}`);
        }
        
        logger.info('Branch state determined', { branchName, branchState });
        
        // 2. Obtener IDs de los syncJobs seleccionados
        const syncJobIds = syncJobs.map(sj => sj.id);
        
        // 3. Obtener shifts del Excel (BuilderTrendShift) que están matched con los jobs seleccionados
        const builderTrendShifts = await BuilderTrendShift.findAll({
            where: {
                sync_id: syncId,
                match_status: 'matched',
                matched_sync_job_id: { 
                    [Op.ne]: null,
                    [Op.in]: syncJobIds  // Solo shifts de jobs seleccionados
                }
            },
            include: [
                {
                    model: PerformanceSyncJob,
                    as: 'matchedSyncJob',
                    required: true
                }
            ]
        });
        
        if (builderTrendShifts.length === 0) {
            logger.warn('No matched shifts found for selected jobs', { 
                syncId, 
                selectedJobsCount: syncJobs.length 
            });
            // No lanzar error, puede que los jobs seleccionados no tengan shifts (manual entry)
        }
        
        logger.info('Found matched shifts', { count: builderTrendShifts.length });
        
        // 4. Agrupar shifts por job
        const jobsMap = {};
        
        for (const shift of builderTrendShifts) {
            const syncJob = shift.matchedSyncJob;
            const jobName = syncJob.job_name;
            
            if (!jobsMap[jobName]) {
                jobsMap[jobName] = {
                    syncJob: syncJob,
                    shifts: []
                };
            }
            
            jobsMap[jobName].shifts.push(shift);
        }
        
        logger.info('Jobs grouped', { jobCount: Object.keys(jobsMap).length });
        
        // 4. Procesar cada job
        const results = {
            jobs_processed: 0,
            jobs_created: 0,
            jobs_updated: 0,
            shifts_created: 0,
            shifts_skipped: 0,
            errors: []
        };
        
        for (const [jobName, jobInfo] of Object.entries(jobsMap)) {
            try {
                const syncJob = jobInfo.syncJob;
                const shifts = jobInfo.shifts;
                
                // Obtener sold_price del raw_data del syncJob
                const rawData = syncJob.raw_data;
                const soldPriceIndex = branchState === 'CA' ? 9 : 10; // J=9, K=10
                const soldPrice = rawData && rawData[soldPriceIndex] 
                    ? parseFloat(rawData[soldPriceIndex]) 
                    : null;
                
                // Buscar o crear crew leader
                let crewLeaderId = null;
                if (syncJob.crew_leader) {
                    const crewLeader = await findOrCreateEmployee(syncJob.crew_leader, branchId);
                    crewLeaderId = crewLeader ? crewLeader.id : null;
                }
                
                // Guardar o actualizar job
                const jobData = {
                    job_name: jobName,
                    closing_date: new Date(), // Usar fecha actual o parsear del spreadsheet
                    sold_price: soldPrice,
                    crew_leader_id: crewLeaderId,
                    branch_id: branchId,
                    attic_tech_hours: syncJob.at_estimated_hours
                };
                
                const savedJob = await saveOrUpdateJob(jobData, autoApprove);
                
                if (savedJob.createdAt === savedJob.updatedAt) {
                    results.jobs_created++;
                } else {
                    results.jobs_updated++;
                }
                
                // Procesar shifts de este job
                const shiftsToSave = [];
                let qcShiftsCount = 0;
                
                // Log todos los shifts para debugging
                logger.info('🔍 PROCESSING SHIFTS FOR JOB', {
                    job_name: jobName,
                    total_shifts: shifts.length,
                    shifts_details: shifts.map(s => ({
                        crew: s.crew_member_name,
                        hours: s.total_hours,
                        tags: s.tags,
                        is_qc: s.is_qc
                    }))
                });
                
                for (const shift of shifts) {
                    // Debug: Log cada shift para ver qué contiene
                    logger.info('🔍 PROCESSING INDIVIDUAL SHIFT', {
                        job_name: jobName,
                        crew_member_name: shift.crew_member_name,
                        total_hours: shift.total_hours,
                        tags: shift.tags,
                        is_qc: shift.is_qc,
                        full_shift_object: shift
                    });
                    
                    // Validar que crew_member_name no sea un precio o valor inválido
                    if (!shift.crew_member_name || 
                        shift.crew_member_name.includes('$') || 
                        shift.crew_member_name.match(/^\d+[,.]?\d*$/)) {
                        logger.warn('⚠️ INVALID CREW MEMBER NAME - SKIPPING SHIFT', {
                            job_name: jobName,
                            crew_member_name: shift.crew_member_name,
                            hours: shift.total_hours
                        });
                        continue; // Skip invalid shift
                    }
                    
                    // Si el shift tiene tag QC, contarlo pero no crear shift regular
                    if (shift.is_qc) {
                        qcShiftsCount++;
                        logger.info('✅ QC SHIFT DETECTED - WILL CREATE SPECIAL SHIFT', {
                            job_name: jobName,
                            crew_member: shift.crew_member_name,
                            hours: shift.total_hours,
                            tags: shift.tags
                        });
                        continue; // Skip regular shift creation
                    }
                    
                    // Buscar o crear employee para cada crew member (solo shifts NO-QC)
                    const employee = await findOrCreateEmployee(shift.crew_member_name, branchId);
                    
                    if (employee) {
                        shiftsToSave.push({
                            employee_id: employee.id,
                            hours: shift.total_hours
                        });
                    }
                }
                
                // Guardar shifts regulares
                const shiftResults = await saveShifts(savedJob.id, shiftsToSave, autoApprove);
                results.shifts_created += shiftResults.created;
                results.shifts_skipped += shiftResults.skipped;
                results.errors.push(...shiftResults.errors);
                
                // Si hay shifts QC, crear Special Shift QC
                if (qcShiftsCount > 0) {
                    const qcHours = qcShiftsCount * 3; // 3 horas por shift QC
                    logger.info('🚀 CREATING QC SPECIAL SHIFT', {
                        job_id: savedJob.id,
                        job_name: jobName,
                        qc_shifts_count: qcShiftsCount,
                        total_qc_hours: qcHours,
                        auto_approve: autoApprove
                    });
                    await saveQCSpecialShift(savedJob.id, qcHours, autoApprove);
                    logger.info('✅ QC SPECIAL SHIFT CREATED SUCCESSFULLY', {
                        job_id: savedJob.id,
                        job_name: jobName,
                        qc_shifts_count: qcShiftsCount,
                        total_qc_hours: qcHours
                    });
                } else {
                    logger.info('ℹ️ NO QC SHIFTS FOR THIS JOB', {
                        job_name: jobName,
                        total_shifts: shifts.length
                    });
                }
                
                results.jobs_processed++;
                
            } catch (error) {
                logger.error('Error processing job', {
                    job_name: jobName,
                    error: error.message
                });
                results.errors.push({
                    job: jobName,
                    error: error.message
                });
            }
        }
        
        await transaction.commit();
        
        logger.info('Performance data saved permanently', results);
        
        return {
            success: true,
            data: results
        };
        
    } catch (error) {
        await transaction.rollback();
        
        logger.error('Error saving Performance data permanently', {
            syncId,
            error: error.message,
            stack: error.stack
        });
        
        throw error;
    }
}

module.exports = {
    savePerformanceDataPermanently,
    getBranchState,
    findOrCreateEmployee,
    saveOrUpdateJob,
    saveShifts
};

