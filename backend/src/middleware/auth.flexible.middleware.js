require('dotenv').config();
const jwt = require('jsonwebtoken');

/**
 * Middleware flexible que acepta JWT Token O API Key
 * Útil para endpoints que pueden ser llamados por usuarios O automaciones
 */
const flexibleAuth = (req, res, next) => {
    // Opción 1: Verificar API Key en header X-API-Key
    const apiKey = req.headers['x-api-key'];
    const serverApiKey = process.env.AUTOMATION_API_KEY;

    if (apiKey) {
        // Si hay API Key, validarla
        if (!serverApiKey) {
            console.error('CRITICAL: AUTOMATION_API_KEY is not set in environment variables.');
            return res.status(500).json({ 
                success: false, 
                message: 'Internal Server Error: API Key not configured.' 
            });
        }

        if (apiKey === serverApiKey) {
            // API Key válida, continuar
            req.authMethod = 'api_key';
            return next();
        } else {
            return res.status(403).json({ 
                success: false, 
                message: 'Forbidden: Invalid API Key.' 
            });
        }
    }

    // Opción 2: Verificar JWT Token en header Authorization
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: No token or API key provided.' 
        });
    }

    const token = authHeader.split(' ')[1]; // Obtener el token después de "Bearer"

    if (!token) {
        return res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: Token format invalid.' 
        });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        req.authMethod = 'jwt_token';
        next();
    } catch (error) {
        return res.status(401).json({ 
            success: false, 
            message: 'Unauthorized: Invalid or expired token.' 
        });
    }
};

module.exports = flexibleAuth;

