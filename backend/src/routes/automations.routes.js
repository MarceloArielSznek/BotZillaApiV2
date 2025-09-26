const express = require('express');
const router = express.Router();
const { AutomationsController } = require('../controllers/automations.controller');
const automationsController = AutomationsController;
const validateApiKey = require('../middleware/apiKey.middleware');
const { isAdmin } = require('../middleware/auth.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');
const { cleanAndParseJson } = require('../middleware/cleanBody.middleware');
const { verifyToken } = require('../middleware/auth.middleware');

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
    express.json(), // Usamos el parser estándar aquí
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
    cleanAndParseJson, // Usamos nuestro middleware de limpieza aquí
    validateApiKey,
    automationsController.processRow
);

/**
 * @swagger
 * /api/automations/process-job-notifications:
 *   post:
 *     summary: Scans for closed jobs with low performance and returns them grouped by branch.
 *     tags: [Automations]
 *     description: >
 *       This endpoint finds all jobs marked as `notification_sent = false`,
 *       calculates their performance, and filters for those below the `LOW_PERFORMANCE_THRESHOLD`.
 *       It then groups these jobs by their branch and returns a structured JSON payload
 *       ready for a service like Make.com to process and send notifications.
 *       After processing, jobs are marked as `notification_sent = true` to avoid reprocessing.
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, jobs will be processed and returned but not marked as `notification_sent = true`.
 *     responses:
 *       200:
 *         description: Successfully processed jobs and returned a payload for Make.com.
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
 *                   example: "Processed 10 jobs. Found 2 branches with low-performing jobs."
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       branch_telegram_id:
 *                         type: string
 *                         example: "-123456789"
 *                       jobs:
 *                         type: array
 *                         items:
 *                           type: string
 *                           example: "John Doe: planned to save 25% | Actual saved -5%"
 *       500:
 *         description: Server error
 */
router.post(
    '/process-job-notifications',
    validateApiKey, // Usar la validación de API Key para servicios externos
    automationsController.processJobNotifications
);

/**
 * @swagger
 * /api/automations/send-daily-summary:
 *   post:
 *     summary: Scans for low-performing jobs in the last 24h and sends a summary to managers.
 *     tags: [Automations]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, the summary will be generated and returned without sending notifications.
 *     responses:
 *       200:
 *         description: Successfully processed and sent the daily summary.
 *       500:
 *         description: Server error
 */
router.post(
    '/send-daily-summary',
    validateApiKey,
    automationsController.sendDailySummary
);


/**
 * @swagger
 * /api/automations/debug-column-mapping:
 *   get:
 *     summary: Debug column mapping for a specific sheet.
 *     tags: [Automations, Debug]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: sheet_name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the sheet to debug.
 *     responses:
 *       200:
 *         description: Successfully retrieved column mapping debug information.
 *       400:
 *         description: Bad Request - Missing sheet_name parameter.
 *       500:
 *         description: Server error
 */
router.get(
    '/debug-column-mapping',
    validateApiKey,
    automationsController.debugColumnMapping
);

/**
 * @swagger
 * /api/automations/fix-duplicate-column-mapping:
 *   post:
 *     summary: Fix duplicate column mappings for a specific sheet.
 *     tags: [Automations, Debug]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: sheet_name
 *         required: true
 *         schema:
 *           type: string
 *         description: The name of the sheet to fix.
 *     responses:
 *       200:
 *         description: Successfully fixed duplicate column mappings.
 *       400:
 *         description: Bad Request - Missing sheet_name parameter.
 *       500:
 *         description: Server error
 */
router.post(
    '/fix-duplicate-column-mapping',
    validateApiKey,
    automationsController.fixDuplicateColumnMapping
);

/**
 * @swagger
 * /api/automations/sync-inspection-reports:
 *   post:
 *     summary: Sincroniza los reportes de inspección desde Attic Tech y notifica sobre condiciones específicas.
 *     tags: [Automations]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: Sincronización completada exitosamente.
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
 *                   example: "Sincronización completada. 2 notificaciones pendientes."
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       type:
 *                         type: string
 *                         enum: [roof, hvac]
 *                       report_id:
 *                         type: integer
 *                       estimate_id:
 *                         type: integer
 *                       estimate_name:
 *                         type: string
 *                       client_name:
 *                         type: string
 *                       salesperson_name:
 *                         type: string
 *                       salesperson_email:
 *                         type: string
 *                       branch_name:
 *                         type: string
 *                       estimate_link:
 *                         type: string
 *                       condition:
 *                         type: string
 *                       interested_in_inspection:
 *                         type: boolean
 *       401:
 *         description: No autorizado - API Key faltante o inválida.
 *       500:
 *         description: Error del servidor durante la sincronización.
 */
router.post(
    '/sync-inspection-reports',
    validateApiKey,
    automationsController.syncInspectionReports
);

module.exports = router; 