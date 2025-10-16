const { Branch } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('./logger');

/**
 * Normaliza el nombre de un branch
 * - Trim espacios al inicio/fin
 * - Convierte múltiples espacios en uno solo
 * - Capitaliza primera letra de cada palabra
 */
function normalizeBranchName(name) {
    if (!name) return null;
    
    return name
        .trim()                           // Quitar espacios al inicio/fin
        .replace(/\s+/g, ' ')             // Múltiples espacios → 1 espacio
        .split(' ')                       // Separar por espacios
        .map(word => 
            word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )                                 // Capitalizar primera letra
        .join(' ');                       // Unir de nuevo
}

/**
 * Encontrar o crear branch en la BD
 * Usa normalización para evitar duplicados
 * 
 * @param {string} branchName - Nombre del branch (puede venir con espacios extra, mayúsculas, etc)
 * @param {Array} logMessages - Array opcional para agregar logs
 * @returns {Promise<Branch|null>} - Branch encontrado o creado, o null si falla
 */
async function findOrCreateBranch(branchName, logMessages = []) {
    if (!branchName) return null;

    try {
        const normalizedName = normalizeBranchName(branchName);
        
        if (!normalizedName) return null;

        // Buscar branches existentes con nombre similar (case-insensitive)
        const existingBranches = await Branch.findAll({
            where: { 
                name: {
                    [Op.iLike]: normalizedName
                }
            }
        });

        // Si ya existe un branch con ese nombre (case-insensitive), retornarlo
        if (existingBranches.length > 0) {
            return existingBranches[0];
        }

        // Si no existe, crear uno nuevo con el nombre normalizado
        const branch = await Branch.create({
            name: normalizedName
        });

        const message = `🏢 Created new branch: ${normalizedName}`;
        logger.info(message);
        
        if (logMessages && Array.isArray(logMessages)) {
            logMessages.push(message);
        }

        return branch;

    } catch (error) {
        const errorMsg = `Error finding/creating branch: ${branchName}`;
        logger.error(errorMsg, { error: error.message });
        
        if (logMessages && Array.isArray(logMessages)) {
            logMessages.push(`❌ ${errorMsg}: ${error.message}`);
        }
        
        return null;
    }
}

/**
 * Buscar branch por nombre (sin crear si no existe)
 * Usa normalización para búsqueda flexible
 * 
 * @param {string} branchName - Nombre del branch a buscar
 * @returns {Promise<Branch|null>} - Branch encontrado o null
 */
async function findBranch(branchName) {
    if (!branchName) return null;

    try {
        const normalizedName = normalizeBranchName(branchName);
        
        if (!normalizedName) return null;

        // Buscar con case-insensitive
        const branch = await Branch.findOne({ 
            where: { 
                name: {
                    [Op.iLike]: normalizedName
                }
            } 
        });

        return branch;

    } catch (error) {
        logger.error(`Error finding branch: ${branchName}`, { error: error.message });
        return null;
    }
}

/**
 * Limpiar branches duplicados en la BD
 * Encuentra branches con nombres similares y mantiene solo uno (el primero creado)
 * 
 * @returns {Promise<Object>} - Resultado con branches eliminados y consolidados
 */
async function cleanupDuplicateBranches() {
    try {
        const allBranches = await Branch.findAll({
            order: [['createdAt', 'ASC']] // Más viejos primero (usa camelCase de Sequelize)
        });

        const branchMap = new Map();
        const duplicatesToDelete = [];
        const consolidationMap = new Map(); // oldId -> newId

        // Agrupar branches por nombre normalizado
        for (const branch of allBranches) {
            const normalizedName = normalizeBranchName(branch.name);
            
            if (!branchMap.has(normalizedName)) {
                // Primer branch con este nombre normalizado → mantener
                branchMap.set(normalizedName, branch);
            } else {
                // Duplicado → marcar para eliminar
                const masterBranch = branchMap.get(normalizedName);
                duplicatesToDelete.push(branch);
                consolidationMap.set(branch.id, masterBranch.id);
                
                logger.info(`🗑️ Duplicate branch found: "${branch.name}" (ID: ${branch.id}) → will merge into "${masterBranch.name}" (ID: ${masterBranch.id})`);
            }
        }

        if (duplicatesToDelete.length === 0) {
            logger.info('✅ No duplicate branches found');
            return {
                success: true,
                duplicatesFound: 0,
                duplicatesDeleted: 0,
                consolidationMap: {}
            };
        }

        // Actualizar referencias antes de eliminar
        const { Employee, Job, Estimate, SalesPerson, CrewMember } = require('../models');

        for (const [oldId, newId] of consolidationMap.entries()) {
            // Actualizar employees
            await Employee.update(
                { branch_id: newId },
                { where: { branch_id: oldId } }
            );

            // Actualizar jobs
            await Job.update(
                { branch_id: newId },
                { where: { branch_id: oldId } }
            );

            // Actualizar estimates
            await Estimate.update(
                { branch_id: newId },
                { where: { branch_id: oldId } }
            );

            // Actualizar salespersons (si tienen branch_id)
            await SalesPerson.update(
                { branch_id: newId },
                { where: { branch_id: oldId } }
            );

            logger.info(`✅ Updated all references from branch ID ${oldId} to ${newId}`);
        }

        // Eliminar branches duplicados
        const deletedIds = duplicatesToDelete.map(b => b.id);
        await Branch.destroy({
            where: {
                id: { [Op.in]: deletedIds }
            }
        });

        logger.info(`✅ Deleted ${deletedIds.length} duplicate branches`);

        return {
            success: true,
            duplicatesFound: duplicatesToDelete.length,
            duplicatesDeleted: deletedIds.length,
            consolidationMap: Object.fromEntries(consolidationMap)
        };

    } catch (error) {
        logger.error('Error cleaning up duplicate branches', { error: error.message });
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    normalizeBranchName,
    findOrCreateBranch,
    findBranch,
    cleanupDuplicateBranches
};

