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
    
    // Limpiar nombre: 
    // 1. Remover paréntesis y su contenido (ej: "Drew Gipson (D)" → "Drew Gipson")
    // 2. Remover comillas dobles y su contenido (ej: 'Malik "Fatu" Richardson' → "Malik Richardson")
    let cleanedName = fullName.trim();
    cleanedName = cleanedName.replace(/\s*\([^)]*\)/g, '').trim(); // Remover (texto)
    cleanedName = cleanedName.replace(/\s*"[^"]*"\s*/g, ' ').trim(); // Remover "texto"
    cleanedName = cleanedName.replace(/\s+/g, ' '); // Normalizar espacios múltiples
    
    const nameParts = cleanedName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || ''; // Si no hay apellido, dejar vacío
    
    // Buscar employee existente por nombre
    const whereClause = {
        first_name: { [Op.iLike]: firstName },
        is_deleted: false
    };
    
    // Solo agregar condición de last_name si existe
    if (lastName && lastName.trim() !== '') {
        whereClause.last_name = { [Op.iLike]: lastName };
    }
    
    let employee = await Employee.findOne({
        where: whereClause
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
            } else {
                logger.warn('Estimate not found in our DB (even with fuzzy matching)', { 
                    job_name,
                    branch_id
                });
            }
            
            // Determinar el estado del job basado en la información disponible
            // Si el job viene de Performance con shifts, debería tener un estado apropiado
            let statusName = 'In Progress'; // Estado por defecto
            
            // Si no tiene crew_leader_id, necesita un crew leader
            if (!crew_leader_id) {
                statusName = 'Requires Crew Lead';
            }
            
            const status = await JobStatus.findOne({
                where: { 
                    name: {
                        [Op.iLike]: statusName
                    }
                }
            });
            
            if (status) {
                statusId = status.id;
                logger.info(`Status "${statusName}" assigned to Performance job`, {
                    status_id: statusId,
                    job_name,
                    has_crew_leader: !!crew_leader_id
                });
            } else {
                logger.error(`Status "${statusName}" not found in database`, {
                    job_name
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
        duplicates_approved: 0, // Shifts que ya existen y ya fueron aprobados
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
                // Si el shift ya fue aprobado, NO permitir duplicación
                if (existingShift.approved_shift === true) {
                    logger.warn('Shift already approved, skipping to prevent duplication', {
                        job_id: jobId,
                        employee_id,
                        existing_hours: existingShift.hours,
                        attempted_hours: hours,
                        approved_shift: existingShift.approved_shift
                    });
                    
                    results.duplicates_approved++;
                    continue; // NO crear ni actualizar
                }
                
                // Si existe pero NO está aprobado, actualizar las horas
                logger.info('Shift exists but not approved yet, updating hours', {
                    job_id: jobId,
                    employee_id,
                    old_hours: existingShift.hours,
                    new_hours: hours
                });
                
                await existingShift.update({
                    hours: parseFloat(hours) // Reemplazar (no sumar) las horas
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
 * @param {Array} selectedJobNames - Nombres de jobs seleccionados (opcional)
 * @param {boolean} autoApprove - Si debe auto-aprobar o requerir aprobación
 * @param {Array} modifiedShifts - Shifts modificados por el usuario (opcional)
 * @returns {Promise<Object>} - Resultado del proceso
 */
async function savePerformanceDataPermanently(syncId, selectedJobNames = null, autoApprove = false, modifiedShifts = null) {
    const transaction = await sequelize.transaction();
    
    try {
        logger.info('Starting permanent save of Performance data', { 
            syncId,
            selectedJobNames: selectedJobNames?.length || 'all',
            autoApprove,
            hasModifiedShifts: !!modifiedShifts
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
        
        // 3. Obtener shifts del Excel (BuilderTrendShift) o usar modifiedShifts si están disponibles
        let builderTrendShifts = [];
        
        if (modifiedShifts && modifiedShifts.length > 0) {
            // Usar shifts modificados por el usuario
            logger.info('Using modified shifts from frontend', { count: modifiedShifts.length });
            builderTrendShifts = modifiedShifts; // Ya vienen agrupados y formateados
        } else {
            // Obtener shifts originales de la BD
            builderTrendShifts = await BuilderTrendShift.findAll({
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
        }
        
        // 4. Agrupar shifts por job
        const jobsMap = {};
        
        if (modifiedShifts && modifiedShifts.length > 0) {
            // Formato de frontend: { job_name, crew_member_name, regular_hours, ot_hours, ot2_hours, has_qc, tags }
            for (const shift of builderTrendShifts) {
                const jobName = shift.job_name;
                
                if (!jobsMap[jobName]) {
                    // Buscar el syncJob correspondiente
                    const syncJob = syncJobs.find(sj => sj.job_name === jobName);
                    if (!syncJob) {
                        logger.warn('SyncJob not found for modified shift', { jobName });
                        continue;
                    }
                    
                    jobsMap[jobName] = {
                        syncJob: syncJob,
                        shifts: []
                    };
                }
                
                jobsMap[jobName].shifts.push(shift);
            }
        } else {
            // Formato de BD: BuilderTrendShift con matchedSyncJob
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
        }
        
        logger.info('Jobs grouped', { jobCount: Object.keys(jobsMap).length });
        
        // 4. Procesar cada job
        const results = {
            jobs_processed: 0,
            jobs_created: 0,
            jobs_updated: 0,
            shifts_created: 0,
            shifts_skipped: 0,
            shifts_duplicates_approved: 0, // Shifts que ya fueron aprobados (prevención de duplicación)
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
                const closingDate = syncJob.finish_date || new Date();
                const jobData = {
                    job_name: jobName,
                    closing_date: closingDate, // Usar finish_date del spreadsheet (columna B), o fecha actual si no existe
                    sold_price: soldPrice,
                    crew_leader_id: crewLeaderId,
                    branch_id: branchId,
                    attic_tech_hours: syncJob.at_estimated_hours
                };
                
                logger.info('Job closing date determined', {
                    job_name: jobName,
                    finish_date_from_spreadsheet: syncJob.finish_date,
                    closing_date_to_save: closingDate,
                    using_spreadsheet_date: !!syncJob.finish_date
                });
                
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
                    // Adaptar formato: si viene de frontend usa regular_hours, sino total_hours
                    const totalHours = modifiedShifts 
                        ? (shift.regular_hours || 0) + (shift.ot_hours || 0) + (shift.ot2_hours || 0)
                        : shift.total_hours;
                    
                    const isQC = modifiedShifts ? (shift.has_qc || shift.tags?.toUpperCase().includes('QC')) : shift.is_qc;
                    
                    // Debug: Log cada shift para ver qué contiene
                    logger.info('🔍 PROCESSING INDIVIDUAL SHIFT', {
                        job_name: jobName,
                        crew_member_name: shift.crew_member_name,
                        total_hours: totalHours,
                        tags: shift.tags,
                        is_qc: isQC,
                        from_frontend: !!modifiedShifts
                    });
                    
                    // Validar que crew_member_name no sea un precio o valor inválido
                    if (!shift.crew_member_name || 
                        shift.crew_member_name.includes('$') || 
                        shift.crew_member_name.match(/^\d+[,.]?\d*$/)) {
                        logger.warn('⚠️ INVALID CREW MEMBER NAME - SKIPPING SHIFT', {
                            job_name: jobName,
                            crew_member_name: shift.crew_member_name,
                            hours: totalHours
                        });
                        continue; // Skip invalid shift
                    }
                    
                    // Si el shift tiene tag QC, contarlo pero no crear shift regular
                    if (isQC) {
                        // Si viene de frontend, usar las horas especificadas; si no, usar default de 3
                        const qcHours = modifiedShifts ? totalHours : 3;
                        qcShiftsCount += qcHours;
                        logger.info('✅ QC SHIFT DETECTED - WILL CREATE SPECIAL SHIFT', {
                            job_name: jobName,
                            crew_member: shift.crew_member_name,
                            hours: qcHours,
                            tags: shift.tags
                        });
                        continue; // Skip regular shift creation
                    }
                    
                    // Buscar o crear employee para cada crew member (solo shifts NO-QC)
                    const employee = await findOrCreateEmployee(shift.crew_member_name, branchId);
                    
                    if (employee) {
                        shiftsToSave.push({
                            employee_id: employee.id,
                            hours: totalHours
                        });
                    }
                }
                
                // Guardar shifts regulares
                const shiftResults = await saveShifts(savedJob.id, shiftsToSave, autoApprove);
                results.shifts_created += shiftResults.created;
                results.shifts_skipped += shiftResults.skipped;
                results.shifts_duplicates_approved += (shiftResults.duplicates_approved || 0);
                results.errors.push(...shiftResults.errors);
                
                // Si hay shifts QC, crear Special Shift QC
                if (qcShiftsCount > 0) {
                    const qcHours = modifiedShifts ? qcShiftsCount : (qcShiftsCount * 3); // Si viene de frontend ya tiene horas, sino 3 x count
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

