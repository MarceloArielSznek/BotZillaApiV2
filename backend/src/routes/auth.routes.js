const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authController = require('../controllers/auth.controller');
const validateRequest = require('../middleware/validate.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

// Rate limiting específico para autenticación
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 5, // máximo 5 intentos por IP
    message: {
        success: false,
        message: 'Demasiados intentos de autenticación, intenta de nuevo en 15 minutos'
    },
    skipSuccessfulRequests: true,
});

// Middleware para parsear JSON en todas las rutas de este archivo
router.use(express.json());

// Login con rate limiting
router.post('/login', authLimiter, [
    body('email').isEmail().withMessage('Debe ser un email válido'),
    body('password').notEmpty().withMessage('La contraseña es requerida'),
    validateRequest
], authController.login);

// Register con rate limiting
router.post('/register', authLimiter, [
    body('email').isEmail().withMessage('Debe ser un email válido'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/\d/)
        .withMessage('La contraseña debe contener al menos un número'),
    body('phone').optional().matches(/^\+?[\d\s-]+$/).withMessage('Formato de teléfono inválido'),
    body('telegram_id').optional(),
    validateRequest
], authController.register);

// Logout (requiere autenticación)
router.post('/logout', verifyToken, authController.logout);

// Verificar token
router.get('/verify', verifyToken, authController.verifyToken);

module.exports = router; 