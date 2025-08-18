const express = require('express');
const router = express.Router();
const notificationsController = require('../controllers/notifications.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const validateApiKey = require('../middleware/apiKey.middleware');

// Middleware para parsear JSON
router.use(express.json());

/**
 * @swagger
 * tags:
 *   name: Notifications
 *   description: Endpoints for generating notification payloads for external services like Make.com.
 */

/**
 * @swagger
 * /notifications/estimates:
 *   post:
 *     summary: Generates a list of notifications related to new or updated estimates.
 *     description: |
 *       This endpoint is called by an external service (e.g., Make.com) to get a structured JSON payload.
 *       The payload contains the necessary information to send notifications (e.g., via Telegram) to the relevant parties (salespersons, managers, etc.).
 *       The server is responsible for the logic of "what" and "to whom" to notify, while the external service handles the "how" and "when".
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: A JSON object containing the list of notifications to be sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Estimate notifications generated successfully."
 *                 notifications:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       recipient:
 *                         type: string
 *                         example: "telegram_user_id_123"
 *                       message:
 *                         type: string
 *                         example: "New estimate assigned: #1234 - John Doe"
 *       '401':
 *         description: Unauthorized. Token is missing or invalid.
 *       '403':
 *         description: Forbidden. User is not an administrator.
 *       '500':
 *         description: Internal server error.
 */
router.post(
    '/estimates',
    verifyToken,
    isAdmin,
    notificationsController.getEstimateNotifications
);

/**
 * @swagger
 * /notifications/salesperson-warnings:
 *   post:
 *     summary: Generates warning and congratulatory notifications for salespersons.
 *     description: |
 *       This endpoint analyzes the active leads for each salesperson.
 *       - If a salesperson has more than 12 active leads ('In Progress' or 'Released'), a warning is issued and their warning count is incremented.
 *       - If a salesperson drops below the 12-lead threshold and had previous warnings, a congratulatory message is generated and their count is reset.
 *       - Includes a 'dryRun' mode to test the logic without making changes to the database.
 *     tags: [Notifications]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: header
 *         name: X-API-Key
 *         required: true
 *         schema:
 *           type: string
 *         description: The API key for authenticating the request.
 *       - in: query
 *         name: dryRun
 *         schema:
 *           type: boolean
 *         description: If true, the logic runs without saving warnings or updating counts in the database.
 *     responses:
 *       '200':
 *         description: A JSON object containing the list of notifications to be sent.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Salesperson notifications processed successfully."
 *                 notifications:
 *                   type: array
 *                   items:
 *                      $ref: '#/components/schemas/NotificationPayload'
 *                 summary:
 *                   type: object
 *                   properties:
 *                      warningsIssued:
 *                          type: integer
 *                      congratulationsSent:
 *                          type: integer
 *                      dryRun:
 *                          type: boolean
 *       '401':
 *         description: Unauthorized. API Key is missing.
 *       '403':
 *         description: Forbidden. Invalid API Key.
 *       '500':
 *         description: Internal server error.
 */
router.post(
    '/salesperson-warnings',
    validateApiKey, // Usamos la validación por API Key
    (req, res) => notificationsController.generateSalesPersonWarningNotifications(req, res)
);

/**
 * @swagger
 * /notifications/manager-warnings:
 *   post:
 *     summary: Generates warning notifications for Branch Managers.
 *     description: |
 *       This endpoint identifies all salespeople exceeding their active lead limit (12),
 *       groups them by their respective branches, and then generates a consolidated notification
 *       for each Branch Manager. The manager for a branch is identified by having the 'branch-manager' role
 *       and being associated with the branch via the `user_branch` table.
 *
 *       The response is a JSON array where each object represents a message to be sent to a specific manager,
 *       containing their Telegram ID and the formatted message with the list of their salespeople who have warnings.
 *     tags: [Notifications]
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
 *         description: A JSON object containing the list of notifications to be sent to managers.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Manager warning notifications generated successfully."
 *                 notifications:
 *                   type: array
 *                   items:
 *                      type: object
 *                      properties:
 *                          recipient_telegram_id:
 *                              type: string
 *                          message_text:
 *                              type: string
 *                          branch_id:
 *                              type: integer
 *                          manager_id:
 *                              type: integer
 *       '401':
 *         description: Unauthorized. API Key is missing.
 *       '403':
 *         description: Forbidden. Invalid API Key.
 *       '500':
 *         description: Internal server error.
 */
router.post(
    '/manager-warnings',
    validateApiKey,
    (req, res) => notificationsController.generateManagerWarningNotifications(req, res)
);

/**
 * @swagger
 * /api/notifications/dashboard-stats:
 *   get:
 *     summary: Get statistics for the notifications dashboard
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: An object with dashboard statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *       401:
 *         description: Unauthorized
 */
router.get(
    '/dashboard-stats',
    verifyToken,
    notificationsController.getDashboardStats
);

/**
 * @swagger
 * /notifications:
 *   get:
 *     summary: Retrieves a list of all historical notifications.
 *     description: |
 *       Fetches a paginated and filterable list of all notifications that have been generated by the system.
 *       Allows administrators to audit and review the communication history.
 *     tags: [Notifications]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: The page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: The number of items per page.
 *       - in: query
 *         name: recipientId
 *         schema:
 *           type: integer
 *         description: Filter notifications by the recipient's ID.
 *       - in: query
 *         name: recipientType
 *         schema:
 *           type: string
 *           enum: [sales_person, user, crew_member]
 *         description: Filter notifications by the recipient's type.
 *       - in: query
 *         name: level
 *         schema:
 *           type: string
 *           enum: ['1', '2', '3+']
 *         description: Filter notifications by the warning level.
 *     responses:
 *       '200':
 *         description: A list of notifications.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Notification'
 *                 total:
 *                   type: integer
 *                 pages:
 *                   type: integer
 *                 currentPage:
 *                   type: integer
 *       '401':
 *         description: Unauthorized. Token is missing or invalid.
 */
router.get(
    '/',
    verifyToken,
    notificationsController.getAllNotifications
);

module.exports = router;

/**
 * @swagger
 * components:
 *   schemas:
 *     Notification:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *         message:
 *           type: string
 *         recipient_type:
 *           type: string
 *         recipient_id:
 *           type: integer
 *         recipient_name:
 *           type: string
 *           description: "The name of the recipient (e.g., the salesperson's name)."
 *           example: "Marcelo Sztainberg"
 *         read_at:
 *           type: string
 *           format: date-time
 *         sent_to_telegram:
 *           type: boolean
 *         created_at:
 *           type: string
 *           format: date-time
 *     NotificationPayload:
 *       type: object
 *       properties:
 *         recipient_telegram_id:
 *           type: string
 *           example: "salesperson_telegram_123"
 *         message_text:
 *           type: string
 *           example: "🚨 **Warning 1: High Active Lead Count** 🚨\n\nYou currently have 13 active leads. Please take action to reduce this number."
 *         type:
 *           type: string
 *           enum: [warning, congratulations]
 *           example: "warning"
 */ 