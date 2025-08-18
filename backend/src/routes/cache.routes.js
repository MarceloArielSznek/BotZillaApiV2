const express = require('express');
const router = express.Router();
const cacheController = require('../controllers/cache.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Todas las rutas en este archivo requieren que el usuario sea un administrador autenticado.
router.use(verifyToken, isAdmin);

/**
 * @swagger
 * /api/cache/clear-all:
 *   post:
 *     summary: Clears all system caches
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: All caches were cleared successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "All caches cleared successfully. 123 items removed."
 *                 clearedItems:
 *                   type: integer
 *                   example: 123
 *       500:
 *         description: Server error
 */
router.post('/clear-all', cacheController.clearAllCaches);

/**
 * @swagger
 * /api/cache/clear-crew-members:
 *   post:
 *     summary: Clears crew members cache specifically
 *     tags: [Cache]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Crew members cache was cleared successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Crew members cache cleared successfully. 45 items removed."
 *                 clearedItems:
 *                   type: integer
 *                   example: 45
 *       500:
 *         description: Server error
 */
router.post('/clear-crew-members', cacheController.clearCrewMembersCache);

module.exports = router; 