const { logger } = require('../utils/logger');

/**
 * Middleware para verificar si el usuario es administrador.
 * Se asume que este middleware se usa DESPUÉS de verifyToken,
 * por lo que req.user estará disponible.
 */
const isAdmin = (req, res, next) => {
    // Corrección: El rol se encuentra en req.user.rol.name
    if (req.user && req.user.rol && req.user.rol.name === 'admin') {
        return next();
    }

    logger.warn('Forbidden access attempt by non-admin user', { 
        userId: req.user ? req.user.id : 'N/A',
        role: req.user && req.user.rol ? req.user.rol.name : 'N/A',
        route: req.originalUrl
    });

    return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to perform this action.'
    });
};

module.exports = {
    isAdmin
};
