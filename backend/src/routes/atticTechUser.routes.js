/**
 * Rutas para búsqueda de usuarios de Attic Tech
 */

const express = require('express');
const router = express.Router();
const atticTechUserController = require('../controllers/atticTechUser.controller');

/**
 * @route POST /api/attic-tech-users/search
 * @description Buscar usuario en Attic Tech por email
 * @access Public (para registro de empleados)
 */
router.post('/search', atticTechUserController.searchUserByEmail);

module.exports = router;

