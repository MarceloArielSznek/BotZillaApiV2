const jwt = require('jsonwebtoken');
const { User, UserRol } = require('../models');

// Cache en memoria simple para usuarios (5 minutos)
const userCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

// Limpiar cache expirado cada 10 minutos
setInterval(() => {
    const now = Date.now();
    for (const [key, value] of userCache.entries()) {
        if (now - value.timestamp > CACHE_TTL) {
            userCache.delete(key);
        }
    }
}, 10 * 60 * 1000);

const verifyToken = async (req, res, next) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            console.log('[AUTH] No token provided');
            return res.status(401).json({ message: 'No token provided' });
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        // Verificar cache primero
        const cacheKey = `user_${decoded.id}`;
        const cachedData = userCache.get(cacheKey);
        
        if (cachedData && (Date.now() - cachedData.timestamp) < CACHE_TTL) {
            req.user = cachedData.user;
            return next();
        }
        
        const user = await User.findByPk(decoded.id, {
            include: [{
                model: UserRol,
                as: 'rol'
            }]
        });

        if (!user) {
            console.log('[AUTH] User not found for token:', decoded.id);
            return res.status(401).json({ message: 'User not found' });
        }

        // Guardar en cache
        userCache.set(cacheKey, {
            user: user,
            timestamp: Date.now()
        });

        req.user = user;
        next();
    } catch (error) {
        console.log('[AUTH] Token verification failed:', error.message);
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ message: 'Token expired' });
        }
        return res.status(401).json({ message: 'Invalid token' });
    }
};

const isAdmin = (req, res, next) => {
    if (req.user.rol.name !== 'admin') {
        return res.status(403).json({ message: 'Require Admin Role!' });
    }
    next();
};

module.exports = {
    verifyToken,
    isAdmin
}; 