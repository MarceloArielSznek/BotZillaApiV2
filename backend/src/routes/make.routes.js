const express = require('express');
const router = express.Router();
const makeController = require('../controllers/make.controller');
const apiKeyMiddleware = require('../middleware/apiKey.middleware');

// Middleware para parsear JSON
router.use(express.json());

// All routes in this file are protected by the API key
router.use(apiKeyMiddleware);

/**
 * @swagger
 * /make/find-user:
 *   post:
 *     summary: Find a user by Telegram ID
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               telegram_id:
 *                 type: string
 *                 description: The Telegram ID of the user to find.
 *                 example: "123456789"
 *     responses:
 *       200:
 *         description: User found or not found response.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 telegram_id:
 *                   type: string
 *                 branch_ids:
 *                   type: array
 *                   items:
 *                     type: integer
 *                 entity_id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 role:
 *                   type: string
 *                 exists:
 *                   type: boolean
 *       400:
 *         description: Missing telegram_id.
 *       500:
 *         description: Internal server error.
 */
router.post('/find-user', makeController.findUserByTelegramId);

/**
 * @swagger
 * /make/verify-access:
 *   post:
 *     summary: Verify a user's access key for the Telegram bot.
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               accessKey:
 *                 type: string
 *                 description: The access key provided by the user.
 *                 example: "SUPER_SECRET_KEY_123"
 *     responses:
 *       200:
 *         description: Access key is valid.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Bad Request. Access key is missing.
 *       403:
 *         description: Forbidden. The provided access key is invalid.
 *       500:
 *         description: Internal Server Error. The server access key is not configured.
 */
router.post('/verify-access', makeController.verifyAccessKey);

/**
 * @swagger
 * /make/branches/list:
 *   get:
 *     summary: Get a simple list of all branches for Make.com
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     responses:
 *       200:
 *         description: A list of branches with their ID and name.
 */
router.get('/branches/list', makeController.listAllBranches);

/**
 * @swagger
 * /make/branches/{id}/salespersons-no-telegram:
 *   get:
 *     summary: Get salespersons in a branch without a Telegram ID for Make.com
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: The ID of the branch.
 *     responses:
 *       200:
 *         description: A list of salespersons without a Telegram ID.
 */
router.get('/branches/:id/salespersons-no-telegram', makeController.getSalespersonsWithoutTelegram);

/**
 * @swagger
 * /make/branches/get-id-by-choice:
 *   get:
 *     summary: Translates a user's numerical choice to a branch ID.
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: choice
 *         required: true
 *         schema:
 *           type: integer
 *         description: The number the user selected from the list.
 *     responses:
 *       200:
 *         description: The corresponding branch ID and name.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 branchId:
 *                   type: integer
 *                 branchName:
 *                   type: string
 */
router.get('/branches/get-id-by-choice', makeController.getBranchIdByChoice);

/**
 * @swagger
 * /make/salespersons/list-by-branch-choice:
 *   get:
 *     summary: Get a list of salespersons for a branch selected by numerical choice.
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     parameters:
 *       - in: query
 *         name: choice
 *         required: true
 *         schema:
 *           type: integer
 *         description: The number corresponding to the branch selected by the user.
 *     responses:
 *       200:
 *         description: A formatted string listing the salespersons for the selected branch.
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: "Please reply with the number of the salesperson:\n\n1. John Doe\n2. Jane Smith"
 *       400:
 *         description: Invalid or missing 'choice' parameter.
 *       404:
 *         description: The selected choice number is out of range.
 *       500:
 *         description: Internal server error.
 */
router.get('/salespersons/list-by-branch-choice', makeController.listSalespersonsByBranchChoice);

/**
 * @swagger
 * /make/salespersons/prepare-assignment:
 *   post:
 *     summary: Prepares to assign a Telegram ID, returning a confirmation message.
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branch_choice
 *               - salesperson_choice
 *             properties:
 *               branch_choice:
 *                 type: integer
 *               salesperson_choice:
 *                 type: integer
 *     responses:
 *       200:
 *         description: A confirmation message to show the user.
 *       400:
 *         description: Missing required parameters.
 */
router.post('/salespersons/prepare-assignment', makeController.prepareTelegramIdAssignment);

/**
 * @swagger
 * /make/salespersons/confirm-assignment:
 *   post:
 *     summary: Confirms and assigns a Telegram ID to a salesperson.
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - branch_choice
 *               - salesperson_choice
 *               - telegram_id
 *             properties:
 *               branch_choice:
 *                 type: integer
 *               salesperson_choice:
 *                 type: integer
 *               telegram_id:
 *                 type: string
 *     responses:
 *       200:
 *         description: Final confirmation of successful registration.
 *       400:
 *         description: Missing required parameters.
 *       404:
 *         description: Invalid choice or salesperson already registered.
 */
router.post('/salespersons/confirm-assignment', makeController.confirmTelegramIdAssignment);

/**
 * @swagger
 * /make/find-telegram-by-name:
 *   post:
 *     summary: Find a salesperson's telegram_id by their name using fuzzy matching
 *     tags: [Make.com]
 *     security:
 *       - ApiKeyAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *                 description: The name of the salesperson to search for (supports fuzzy matching)
 *                 example: "Marcelo Ariel Sznek"
 *               job_name:
 *                 type: string
 *                 description: Optional job name to search for customer contact information
 *                 example: "Johnson House Insulation"
 *     responses:
 *       200:
 *         description: Search results with telegram_id if found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 exact_match:
 *                   type: boolean
 *                 fuzzy_match:
 *                   type: boolean
 *                 salesperson_id:
 *                   type: integer
 *                 name:
 *                   type: string
 *                 first_name:
 *                   type: string
 *                 last_name:
 *                   type: string
 *                 telegram_id:
 *                   type: string
 *                 has_telegram:
 *                   type: boolean
 *                 customer_info:
 *                   type: object
 *                   description: Customer contact information if job_name was provided and found
 *                 similarity_score:
 *                   type: number
 *                 branches:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                       name:
 *                         type: string
 *                 other_matches:
 *                   type: array
 *                   description: Alternative matches when fuzzy matching is used
 *                 suggestions:
 *                   type: array
 *                   description: Suggested matches when no clear match is found
 *       400:
 *         description: Bad Request. Name is missing or invalid.
 *       500:
 *         description: Internal server error.
 */
router.post('/find-telegram-by-name', makeController.findTelegramIdByName);


module.exports = router; 