/**
 * Controller para buscar usuarios de Attic Tech
 */

const axios = require('axios');
const { logger } = require('../utils/logger');

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
 * Clasificar usuario por roles
 */
function classifyUser(user) {
    if (!user.roles || user.roles.length === 0) {
        return { type: null, is_leader: false };
    }

    const roleNames = user.roles.map(r => r.name);
    
    // Si tiene "Crew Leader" → Crew Leader
    if (roleNames.includes('Crew Leader')) {
        return { type: 'crew_leader', is_leader: true };
    }
    
    // Si solo tiene "Crew Member"
    if (roleNames.includes('Crew Member')) {
        return { type: 'crew_member', is_leader: false };
    }
    
    // Si tiene "Authenticated" → Sales Person
    if (roleNames.includes('Authenticated')) {
        return { type: 'salesperson', is_leader: false };
    }

    return { type: null, is_leader: false };
}

/**
 * Buscar usuario en Attic Tech por email
 * POST /api/attic-tech-users/search
 */
exports.searchUserByEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        logger.info(`Searching for user in AT: ${email}`);

        // 1. Login a AT
        const apiKey = await loginToAtticTech();

        // 2. Buscar usuario por email
        const response = await axios.get('https://www.attic-tech.com/api/users', {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                depth: 2,
                limit: 1,
                'where[email][equals]': email
            }
        });

        if (!response.data || !response.data.docs || response.data.docs.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'User not found in Attic Tech system'
            });
        }

        const user = response.data.docs[0];
        
        // 3. Clasificar usuario
        const classification = classifyUser(user);

        if (!classification.type) {
            return res.status(400).json({
                success: false,
                message: 'User does not have a valid role (Crew Member, Crew Leader, or Authenticated)'
            });
        }

        // 4. Extraer branches
        const branches = user.branches?.map(b => b.name) || [];

        // 5. Retornar datos del usuario
        const userData = {
            attic_tech_id: user.id,
            name: user.name,
            email: user.email,
            role: classification.type,
            is_leader: classification.is_leader,
            branches: branches,
            isVerified: user.isVerified,
            isBlocked: user.isBlocked
        };

        logger.info(`User found in AT: ${user.name} (${classification.type})`);

        return res.status(200).json({
            success: true,
            message: 'User found in Attic Tech',
            data: userData
        });

    } catch (error) {
        logger.error('Error searching user in AT', { 
            error: error.message,
            stack: error.stack 
        });
        
        return res.status(500).json({
            success: false,
            message: 'Error searching user in Attic Tech',
            error: error.message
        });
    }
};

