const express = require('express');
const router = express.Router();
const { body } = require('express-validator');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const validateRequest = require('../middleware/validate.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');
const userController = require('../controllers/user.controller');

// Middleware para parsear JSON
router.use(express.json());

// Obtener todos los roles de usuario (solo admin)
router.get('/roles',
    verifyToken,
    isAdmin,
    userController.getUserRoles
);

// Obtener todos los usuarios (solo admin) (con cache)
router.get('/', 
    verifyToken, 
    isAdmin, 
    caches.lists.middleware('users_list', 300000), // 5 minutos
    userController.getUsers
);

// Obtener usuario por ID (con cache)
router.get('/:id', 
    verifyToken, 
    caches.entities.middleware('user_detail', 600000), // 10 minutos
    userController.getUserById
);

// Crear usuario (solo admin) (con invalidación de cache)
router.post('/', [
    verifyToken,
    isAdmin,
    body('email')
        .isEmail()
        .withMessage('Email inválido')
        .notEmpty()
        .withMessage('El email es requerido'),
    body('password')
        .isLength({ min: 6 })
        .withMessage('La contraseña debe tener al menos 6 caracteres')
        .matches(/\d/)
        .withMessage('La contraseña debe contener al menos un número')
        .notEmpty()
        .withMessage('La contraseña es requerida'),
    body('phone')
        .optional()
        .matches(/^\+?[\d\s-]+$/)
        .withMessage('Formato de teléfono inválido'),
    body('telegram_id')
        .optional(),
    body('rol_id')
        .isInt()
        .withMessage('El rol debe ser un número entero')
        .notEmpty()
        .withMessage('El rol es requerido'),
    validateRequest,
    cacheInvalidationMiddleware('user')
], userController.createUser);

// Actualizar usuario (con invalidación de cache)
router.put('/:id', [
    verifyToken,
    body('email').optional().isEmail().withMessage('Email inválido'),
    body('phone').optional().matches(/^\+?[\d\s-]+$/).withMessage('Formato de teléfono inválido'),
    body('telegram_id').optional(),
    validateRequest,
    cacheInvalidationMiddleware('user')
], userController.updateUser);

// Cambiar contraseña (con invalidación de cache)
router.put('/:id/password', [
    verifyToken,
    body('currentPassword').notEmpty().withMessage('La contraseña actual es requerida'),
    body('newPassword')
        .isLength({ min: 6 })
        .withMessage('La nueva contraseña debe tener al menos 6 caracteres')
        .matches(/\d/)
        .withMessage('La nueva contraseña debe contener al menos un número'),
    validateRequest,
    cacheInvalidationMiddleware('user')
], userController.changePassword);

// Eliminar usuario (solo admin) (con invalidación de cache)
router.delete('/:id', 
    verifyToken, 
    isAdmin, 
    cacheInvalidationMiddleware('user'),
    userController.deleteUser
);

module.exports = router; 