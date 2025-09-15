const rateLimit = require('express-rate-limit');

// Rate limiting para operaciones generales
const generalLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 100, // máximo 100 requests por minuto por IP
    message: {
        success: false,
        message: 'Demasiadas requests. Intenta de nuevo en un minuto.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests
    skipSuccessfulRequests: false,
    // Skip failed requests
    skipFailedRequests: true
});

// Rate limiting más estricto para operaciones de escritura
const writeLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minuto
    max: 30, // máximo 30 operaciones de escritura por minuto
    message: {
        success: false,
        message: 'Demasiadas operaciones de escritura. Espera un momento antes de continuar.'
    },
    standardHeaders: true,
    legacyHeaders: false
});

// Rate limiting para login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos de login por IP cada 15 minutos
    message: {
        success: false,
        message: 'Demasiados intentos de login. Intenta de nuevo en 15 minutos.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true // No contar logins exitosos
});

module.exports = {
    generalLimiter,
    writeLimiter,
    loginLimiter
};
