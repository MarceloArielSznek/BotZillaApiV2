/**
 * Rutas para sincronización con Attic Tech
 */

const express = require('express');
const router = express.Router();
const atticTechSyncController = require('../controllers/atticTechSync.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/roles.middleware');

/**
 * @route POST /api/attic-tech-sync/sync-users
 * @description Sincronizar usuarios de Attic Tech a nuestra BD
 * @access Private (Admin only)
 */
router.post('/sync-users', verifyToken, isAdmin, atticTechSyncController.syncUsers);

/**
 * @route GET /api/attic-tech-sync/stats
 * @description Obtener estadísticas de employees
 * @access Private
 */
router.get('/stats', verifyToken, atticTechSyncController.getStats);

module.exports = router;

