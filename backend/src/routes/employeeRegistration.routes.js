const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const employeeRegistrationController = require('../controllers/employeeRegistration.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateEmployeeRegistration } = require('../middleware/validation.middleware');

// Rate limiting para registro de empleados
const registrationLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 3, // máximo 3 intentos por IP cada 15 min
    message: {
        success: false,
        message: 'Too many registration attempts. Please try again in 15 minutes.',
        error: 'RATE_LIMIT_EXCEEDED'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => {
        // Skip rate limiting for localhost during development
        return process.env.NODE_ENV === 'development' && req.ip === '::1';
    }
});

/**
 * @route POST /api/employee-registration/register
 * @desc Register a new employee
 * @access Public (no authentication required for registration)
 */
router.post('/register', 
    registrationLimiter,
    validateEmployeeRegistration,
    employeeRegistrationController.registerEmployee
);

/**
 * @route GET /api/employee-registration/stats
 * @desc Get employee registration statistics
 * @access Private (requires authentication)
 */
router.get('/stats', 
    verifyToken,
    employeeRegistrationController.getRegistrationStats
);

/**
 * @route POST /api/employee-registration/validate-telegram
 * @desc Validate Telegram ID
 * @access Public
 */
router.post('/validate-telegram', 
    employeeRegistrationController.validateTelegramId
);

// Rutas para webhook de Make.com (requieren autenticación)
router.post('/test-webhook', 
    verifyToken,
    employeeRegistrationController.testMakeWebhook
);

router.get('/webhook-status', 
    verifyToken,
    employeeRegistrationController.getWebhookStatus
);

module.exports = router;
