const express = require('express');
const router = express.Router();
const automationsController = require('../controllers/automations.controller');
const validateApiKey = require('../middleware/apiKey.middleware');
const { isAdmin } = require('../middleware/auth.middleware');

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

/**
 * @swagger
 * /api/automations/column-map/sync:
 *   post:
 *     summary: Synchronize the column mapping from a spreadsheet.
 *     tags: [Automations, ColumnMap]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, the sync will be simulated without saving to the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sheet_name:
 *                 type: string
 *                 example: "San Bernardino"
 *               header_row:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Date", "Client Name", "John Doe", "", "Notes"]
 *     responses:
 *       200:
 *         description: Successfully synced the column map.
 *       400:
 *         description: Bad Request - Missing or invalid parameters.
 */
router.post('/column-map/sync',
    validateApiKey,
    automationsController.syncColumnMap
);

/**
 * @swagger
 * /api/automations/process-row:
 *   post:
 *     summary: Processes a single row of data from a spreadsheet.
 *     tags: [Automations, JobProcessing]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, the row will be processed and returned without saving to the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               sheet_name:
 *                 type: string
 *                 example: "Testing"
 *               row_number:
 *                 type: integer
 *                 example: 3
 *               row_data:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["Data A", "Data B", "Data C"]
 *     responses:
 *       200:
 *         description: Successfully processed the row. Returns the structured data.
 *       400:
 *         description: Bad Request - Missing parameters.
 *       404:
 *         description: Column map for the given sheet_name not found.
 */
router.post('/process-row',
    validateApiKey,
    automationsController.processRow
);

module.exports = router; 