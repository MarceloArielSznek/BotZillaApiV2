/**
 * Controller para sincronizar usuarios de Attic Tech
 */

const axios = require('axios');
const { logger } = require('../utils/logger');
const { Employee, Branch } = require('../models');
const { Op } = require('sequelize');

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
            return response.data.token;
        } else {
            throw new Error('No se recibió token de Attic Tech');
        }
    } catch (error) {
        logger.error('Error en login a Attic Tech', { error: error.message });
        throw new Error(`Login failed: ${error.message}`);
    }
}

/**
 * Fetch all users from Attic Tech
 */
async function fetchAllUsers(apiKey) {
    try {
        const url = 'https://www.attic-tech.com/api/users';
        
        const params = {
            depth: 2,
            limit: 1000,
            draft: false
        };

        const response = await axios.get(url, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params
        });

        if (response.data && response.data.docs) {
            return response.data.docs;
        } else {
            return [];
        }

    } catch (error) {
        logger.error('Error fetching users from AT', { 
            error: error.message,
            status: error.response?.status 
        });
        throw error;
    }
}

/**
 * Clasificar usuario por roles
 */
function classifyUser(user) {
    if (!user.roles || user.roles.length === 0) {
        return { type: null, is_leader: false };
    }

    const roleNames = user.roles.map(r => r.name);
    
    if (roleNames.includes('Crew Leader')) {
        return { type: 'crew_leader', is_leader: true };
    }
    
    if (roleNames.includes('Crew Member')) {
        return { type: 'crew_member', is_leader: false };
    }
    
    if (roleNames.includes('Authenticated')) {
        return { type: 'salesperson', is_leader: false };
    }

    return { type: null, is_leader: false };
}

/**
 * Encontrar o crear branch en nuestra BD
 */
async function findOrCreateBranch(branchName) {
    if (!branchName) return null;

    try {
        const trimmedName = branchName.trim();
        
        // Buscar branch existente con nombre similar (case-insensitive y sin espacios extra)
        const existingBranches = await Branch.findAll({
            where: { 
                name: {
                    [Op.iLike]: `%${trimmedName}%`
                }
            }
        });

        // Buscar coincidencia exacta después de normalizar
        let branch = existingBranches.find(b => {
            const normalizedDbName = b.name.trim().toLowerCase().replace(/\s+/g, ' ');
            const normalizedSearchName = trimmedName.toLowerCase().replace(/\s+/g, ' ');
            return normalizedDbName === normalizedSearchName;
        });

        // Si no existe, crear uno nuevo
        if (!branch) {
            // Verificar una vez más con búsqueda exacta antes de crear
            branch = await Branch.findOne({
                where: { 
                    name: trimmedName
                }
            });

            if (!branch) {
                branch = await Branch.create({
                    name: trimmedName
                });
                logger.info(`✅ Created new branch: ${trimmedName}`);
            }
        }

        return branch;
    } catch (error) {
        logger.error(`Error finding/creating branch: ${branchName}`, { error: error.message });
        return null;
    }
}

/**
 * Sincronizar usuarios a BD
 */
async function syncUsersToDb(users) {
    let newCount = 0;
    let updatedCount = 0;
    let skippedCount = 0;
    const errors = [];

    for (const atUser of users) {
        try {
            const classification = classifyUser(atUser);
            if (!classification.type) {
                skippedCount++;
                continue;
            }

            const nameParts = atUser.name.split(' ');
            let firstName = nameParts[0] || 'Unknown';
            let lastName = nameParts.slice(1).join(' ') || 'User';
            
            // Sanitizar nombres para que solo contengan caracteres válidos
            const sanitizeName = (name) => {
                // Remover caracteres no válidos y mantener solo letras, números, espacios, guiones, apóstrofes y puntos
                return name.replace(/[^a-zA-ZÀ-ÿ\u00f1\u00d1\s'\-0-9.]/g, '').trim() || 'Unknown';
            };
            
            firstName = sanitizeName(firstName);
            lastName = sanitizeName(lastName);

            const existingEmployee = await Employee.findOne({
                where: { email: atUser.email }
            });

            const firstBranchName = atUser.branches?.[0]?.name;
            const branch = firstBranchName ? await findOrCreateBranch(firstBranchName) : null;

            if (existingEmployee) {
                if (existingEmployee.status === 'pending') {
                    await existingEmployee.update({
                        first_name: firstName,
                        last_name: lastName,
                        role: classification.type,
                        branch_id: branch?.id || existingEmployee.branch_id,
                        attic_tech_user_id: atUser.id
                    });
                    updatedCount++;
                } else {
                    skippedCount++;
                }
            } else {
                await Employee.create({
                    first_name: firstName,
                    last_name: lastName,
                    email: atUser.email,
                    role: classification.type,
                    branch_id: branch?.id || null,
                    status: 'pending',
                    attic_tech_user_id: atUser.id
                });
                newCount++;
            }

        } catch (error) {
            logger.error(`Error syncing user ${atUser.email}`, { error: error.message });
            errors.push({
                email: atUser.email,
                name: atUser.name,
                error: error.message
            });
        }
    }

    return { newCount, updatedCount, skippedCount, errors };
}

class AtticTechSyncController {
    /**
     * Sincronizar usuarios de Attic Tech
     * POST /api/attic-tech-sync/sync-users
     */
    async syncUsers(req, res) {
        try {
            logger.info('Starting Attic Tech user sync...');

            // 1. Login a AT
            const apiKey = await loginToAtticTech();

            // 2. Fetch users de AT
            const users = await fetchAllUsers(apiKey);

            // 3. Clasificar usuarios válidos
            const validUsers = users.filter(user => {
                const classification = classifyUser(user);
                return classification.type !== null;
            });

            logger.info(`Found ${validUsers.length} users with valid roles`);

            // 4. Sincronizar a BD
            const result = await syncUsersToDb(validUsers);

            // 5. Retornar resultado
            res.status(200).json({
                success: true,
                message: 'Sync completed successfully',
                data: {
                    total_users_in_at: users.length,
                    valid_users: validUsers.length,
                    new_employees: result.newCount,
                    updated_employees: result.updatedCount,
                    skipped: result.skippedCount,
                    errors: result.errors.length,
                    error_details: result.errors
                }
            });

        } catch (error) {
            logger.error('Error during Attic Tech sync', { 
                error: error.message,
                stack: error.stack 
            });
            
            res.status(500).json({
                success: false,
                message: 'Failed to sync users from Attic Tech',
                error: error.message
            });
        }
    }

    /**
     * Obtener estadísticas de employees
     * GET /api/attic-tech-sync/stats
     */
    async getStats(req, res) {
        try {
            const total = await Employee.count();
            const pending = await Employee.count({ where: { status: 'pending' } });
            const pendingReadyToActivate = await Employee.count({ 
                where: { 
                    status: 'pending',
                    telegram_id: { [Op.ne]: null }
                } 
            });
            const pendingAwaitingRegistration = pending - pendingReadyToActivate;
            const active = await Employee.count({ where: { status: 'active' } });
            const rejected = await Employee.count({ where: { status: 'rejected' } });
            const fromAt = await Employee.count({ where: { attic_tech_user_id: { [Op.ne]: null } } });

            res.status(200).json({
                success: true,
                data: {
                    total,
                    pending,
                    pending_ready_to_activate: pendingReadyToActivate,
                    pending_awaiting_registration: pendingAwaitingRegistration,
                    active,
                    rejected,
                    from_attic_tech: fromAt,
                    manual: total - fromAt
                }
            });

        } catch (error) {
            logger.error('Error fetching employee stats', { error: error.message });
            res.status(500).json({
                success: false,
                message: 'Failed to fetch employee statistics'
            });
        }
    }
}

module.exports = new AtticTechSyncController();

