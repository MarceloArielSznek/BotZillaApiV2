const express = require('express');
const router = express.Router();
const automationsController = require('../controllers/automations.controller');
const validateApiKey = require('../middleware/apiKey.middleware');

/**
 * @swagger
 * tags:
 *   name: Automations
 *   description: Endpoints for triggering server automations, primarily for use with services like Make.com.
 */

/**
 * @swagger
 * /automations/estimates/sync-external:
 *   post:
 *     summary: Triggers the synchronization of estimates from an external source.
 *     tags: [Automations]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-API-Key
 *         required: true
 *         schema:
 *           type: string
 *         description: The API key for authenticating the request.
 *     responses:
 *       '200':
 *         description: Synchronization process started successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "External estimates synchronization finished."
 *                 newEstimatesCount:
 *                   type: integer
 *                   example: 5
 *       '401':
 *         description: Unauthorized. API Key is missing.
 *       '403':
 *         description: Forbidden. Invalid API Key.
 *       '500':
 *         description: Internal server error during the synchronization process.
 */
router.post(
    '/estimates/sync-external',
    validateApiKey,
    automationsController.syncExternalEstimates
);

module.exports = router; 