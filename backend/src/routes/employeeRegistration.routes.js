const express = require('express');
const router = express.Router();
const employeeRegistrationController = require('../controllers/employeeRegistration.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateEmployeeRegistration } = require('../middleware/validation.middleware');

/**
 * @route POST /api/employee-registration/register
 * @desc Register a new employee
 * @access Public (no authentication required for registration)
 */
router.post('/register', 
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

module.exports = router;
