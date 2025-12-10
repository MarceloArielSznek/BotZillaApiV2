/**
 * Servicio para persistir shifts diarios desde Attic DB
 */

const { logger } = require('../utils/logger');
const { DailyShift, Job, Employee, Branch } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const atticService = require('./attic.service');

/**
 * Mapear branch_id de Attic a nuestro branch_id de BotZilla
 * @param {number} atticBranchId
 * @returns {Promise<number|null>}
 */
async function mapAtticBranchToBotzilla(atticBranchId) {
    try {
        // Primero intentar buscar por nombre usando Attic service
        const atticBranches = await atticService.getBranches();
        const atticBranch = atticBranches.find(b => b.branch_id === atticBranchId);
        
        if (!atticBranch) {
            logger.warn('Attic branch not found', { atticBranchId });
            return null;
        }
        
        // Buscar branch en BotZilla por nombre similar
        const botzillaBranch = await Branch.findOne({
            where: {
                name: {
                    [Op.iLike]: `%${atticBranch.branch_desc}%`
                }
            }
        });
        
        return botzillaBranch ? botzillaBranch.id : null;
    } catch (error) {
        logger.error('Error mapping Attic branch to BotZilla', {
            atticBranchId,
            error: error.message
        });
        return null;
    }
}

/**
 * Encontrar o crear un employee por nombre
 * @param {string} employeeName
 * @param {number|null} branchId
 * @returns {Promise<Employee|null>}
 */
async function findOrCreateEmployee(employeeName, branchId = null) {
    if (!employeeName || !employeeName.trim()) {
        logger.warn('Empty employee name provided');
        return null;
    }
    
    // Limpiar nombre
    let cleanedName = employeeName.trim();
    cleanedName = cleanedName.replace(/\s*\([^)]*\)/g, '').trim();
    cleanedName = cleanedName.replace(/\s*"[^"]*"\s*/g, ' ').trim();
    cleanedName = cleanedName.replace(/#/g, '').trim();
    cleanedName = cleanedName.replace(/\s+/g, ' ');
    
    const nameParts = cleanedName.split(/\s+/);
    const firstName = nameParts[0];
    const lastName = nameParts.slice(1).join(' ') || '';
    
    // Buscar employee existente
    const whereClause = {
        first_name: { [Op.iLike]: firstName },
        is_deleted: false
    };
    
    if (lastName.trim() !== '') {
        whereClause.last_name = { [Op.iLike]: lastName };
    }
    
    let employee = await Employee.findOne({ where: whereClause });
    
    // Si no existe, crear uno nuevo
    if (!employee) {
        logger.info('Creating new employee from Attic shift', {
            original_name: employeeName,
            first_name: firstName,
            last_name: lastName,
            branch_id: branchId
        });
        
        const timestamp = Date.now();
        const generatedEmail = `${firstName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${lastName.toLowerCase().replace(/[^a-z0-9]/g, '')}.${timestamp}@pending.local`;
        
        employee = await Employee.create({
            first_name: firstName,
            last_name: lastName,
            email: generatedEmail,
            role: 'crew_member',
            status: 'pending',
            branch_id: branchId
        });
    }
    
    return employee;
}

/**
 * Encontrar o crear job desde Attic
 * @param {Object} atticJobData
 * @returns {Promise<Job|null>}
 */
async function findOrCreateJobFromAttic(atticJobData) {
    const { job_gk, job_name, job_id, branch_id } = atticJobData;
    
    if (!job_gk || !job_name) {
        logger.warn('Missing job data from Attic', atticJobData);
        return null;
    }
    
    // Buscar job existente por job_name y branch
    const botzillaBranchId = await mapAtticBranchToBotzilla(branch_id);
    
    if (!botzillaBranchId) {
        logger.warn('Could not map Attic branch to BotZilla', { branch_id });
        return null;
    }
    
    let job = await Job.findOne({
        where: {
            name: { [Op.iLike]: job_name },
            branch_id: botzillaBranchId
        }
    });
    
    // Si no existe, intentar fuzzy matching
    if (!job) {
        const fuzz = require('fuzzball');
        const existingJobs = await Job.findAll({
            where: { branch_id: botzillaBranchId },
            attributes: ['id', 'name']
        });
        
        if (existingJobs.length > 0) {
            let bestMatch = null;
            let bestScore = 0;
            
            existingJobs.forEach(existingJob => {
                const score = Math.max(
                    fuzz.ratio(job_name, existingJob.name),
                    fuzz.partial_ratio(job_name, existingJob.name),
                    fuzz.token_sort_ratio(job_name, existingJob.name)
                );
                
                if (score > bestScore) {
                    bestScore = score;
                    bestMatch = existingJob;
                }
            });
            
            if (bestMatch && bestScore >= 85) {
                job = bestMatch;
                logger.info('Job matched using fuzzy search', {
                    attic_job_name: job_name,
                    matched_job_name: job.name,
                    similarity: bestScore
                });
            }
        }
    }
    
    // Si aún no existe, crear placeholder
    if (!job) {
        logger.info('Creating placeholder job from Attic', {
            job_name,
            job_gk,
            branch_id: botzillaBranchId
        });
        
        // Buscar status "In Progress" o usar el primero disponible
        const JobStatus = require('../models/JobStatus');
        let statusId = null;
        
        const inProgressStatus = await JobStatus.findOne({
            where: { name: { [Op.iLike]: 'In Progress' } }
        });
        
        if (inProgressStatus) {
            statusId = inProgressStatus.id;
        }
        
        job = await Job.create({
            name: job_name,
            branch_id: botzillaBranchId,
            status_id: statusId,
            notification_sent: false
        });
    }
    
    return job;
}

/**
 * Guardar shifts diarios desde Attic
 * @param {Array} atticShifts - Shifts desde Attic DB
 * @returns {Promise<Object>}
 */
async function saveDailyShiftsFromAttic(atticShifts) {
    const transaction = await sequelize.transaction();
    
    try {
        const results = {
            created: 0,
            updated: 0,
            skipped: 0,
            errors: []
        };
        
        for (const atticShift of atticShifts) {
            try {
                // Validar datos mínimos
                if (!atticShift.job_gk || !atticShift.employee_name || !atticShift.report_date) {
                    logger.warn('Missing required data in Attic shift', atticShift);
                    results.skipped++;
                    continue;
                }
                
                // Encontrar o crear job
                const job = await findOrCreateJobFromAttic({
                    job_gk: atticShift.job_gk,
                    job_name: atticShift.job_name,
                    job_id: atticShift.job_id,
                    branch_id: atticShift.branch_id
                });
                
                if (!job) {
                    logger.warn('Could not find or create job for shift', {
                        job_gk: atticShift.job_gk,
                        job_name: atticShift.job_name
                    });
                    results.skipped++;
                    continue;
                }
                
                // Encontrar o crear employee
                const botzillaBranchId = await mapAtticBranchToBotzilla(atticShift.branch_id);
                const employee = await findOrCreateEmployee(atticShift.employee_name, botzillaBranchId);
                
                if (!employee) {
                    logger.warn('Could not find or create employee for shift', {
                        employee_name: atticShift.employee_name
                    });
                    results.skipped++;
                    continue;
                }
                
                // Crear o actualizar daily_shift
                const shiftData = {
                    job_id: job.id,
                    employee_id: employee.id,
                    shift_date: atticShift.report_date,
                    regular_hours: atticShift.Actual_Reg_Hrs || 0,
                    overtime_hours: atticShift.Actual_OT_Hrs || 0,
                    double_overtime_hours: atticShift.Actual_double_OT_Hrs || 0,
                    total_hours: atticShift.total_hours || 0,
                    clocked_in_at: atticShift.clocked_in_at,
                    clocked_out_at: atticShift.clocked_out_at,
                    job_gk: atticShift.job_gk,
                    attic_branch_id: atticShift.branch_id,
                    synced_from_attic: true,
                    approved: false
                };
                
                const [dailyShift, created] = await DailyShift.upsert(shiftData, {
                    transaction,
                    returning: true
                });
                
                if (created) {
                    results.created++;
                } else {
                    results.updated++;
                }
                
            } catch (error) {
                logger.error('Error processing individual shift', {
                    error: error.message,
                    shift: atticShift
                });
                results.errors.push({
                    shift: atticShift,
                    error: error.message
                });
            }
        }
        
        await transaction.commit();
        
        logger.info('Daily shifts saved successfully', results);
        
        return {
            success: true,
            data: results
        };
        
    } catch (error) {
        await transaction.rollback();
        
        logger.error('Error saving daily shifts from Attic', {
            error: error.message,
            stack: error.stack
        });
        
        throw error;
    }
}

module.exports = {
    saveDailyShiftsFromAttic,
    findOrCreateEmployee,
    findOrCreateJobFromAttic,
    mapAtticBranchToBotzilla
};

