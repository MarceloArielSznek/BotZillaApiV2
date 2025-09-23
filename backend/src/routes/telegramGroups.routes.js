const express = require('express');
const router = express.Router();
const telegramGroupController = require('../controllers/telegramGroup.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/roles.middleware');
const { validateTelegramGroup } = require('../middleware/validation.middleware');

// GET /api/telegram-groups - Listar todos los grupos
router.get(
    '/', 
    verifyToken, 
    telegramGroupController.getAllGroups
);

// POST /api/telegram-groups - Crear un nuevo grupo
router.post(
    '/', 
    verifyToken, 
    isAdmin, 
    validateTelegramGroup.create, 
    telegramGroupController.createGroup
);

// GET /api/telegram-groups/:id - Obtener un grupo por ID
router.get(
    '/:id', 
    verifyToken, 
    telegramGroupController.getGroupById
);

// PUT /api/telegram-groups/:id - Actualizar un grupo
router.put(
    '/:id', 
    verifyToken, 
    isAdmin, 
    validateTelegramGroup.update, 
    telegramGroupController.updateGroup
);

// DELETE /api/telegram-groups/:id - Eliminar un grupo
router.delete(
    '/:id', 
    verifyToken, 
    isAdmin, 
    telegramGroupController.deleteGroup
);

module.exports = router;
