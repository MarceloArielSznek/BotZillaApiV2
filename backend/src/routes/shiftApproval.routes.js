const express = require('express');
const router = express.Router();
const shiftApprovalController = require('../controllers/shiftApproval.controller');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * @swagger
 * /api/shift-approval/pending:
 *   get:
 *     summary: Get all pending shifts awaiting approval
 *     tags: [ShiftApproval]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branch_id
 *         schema:
 *           type: integer
 *         description: Filter by specific branch ID
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *         description: Number of results to return
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: Number of results to skip
 *     responses:
 *       200:
 *         description: Successfully retrieved pending shifts
 *       500:
 *         description: Internal server error
 */
router.get('/pending', verifyToken, shiftApprovalController.getPendingShifts);

/**
 * @swagger
 * /api/shift-approval/stats:
 *   get:
 *     summary: Get statistics of pending shifts
 *     tags: [ShiftApproval]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Successfully retrieved pending shifts statistics
 *       500:
 *         description: Internal server error
 */
router.get('/stats', verifyToken, shiftApprovalController.getPendingShiftsStats);

/**
 * @swagger
 * /api/shift-approval/approve:
 *   post:
 *     summary: Approve specific shifts
 *     tags: [ShiftApproval]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shiftIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Shifts approved successfully
 *       400:
 *         description: Bad request - invalid shiftIds
 *       500:
 *         description: Internal server error
 */
router.post('/approve', verifyToken, shiftApprovalController.approveShifts);

/**
 * @swagger
 * /api/shift-approval/reject:
 *   post:
 *     summary: Reject (delete) specific shifts
 *     tags: [ShiftApproval]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               shiftIds:
 *                 type: array
 *                 items:
 *                   type: integer
 *                 example: [1, 2, 3]
 *     responses:
 *       200:
 *         description: Shifts rejected successfully
 *       400:
 *         description: Bad request - invalid shiftIds
 *       500:
 *         description: Internal server error
 */
router.post('/reject', verifyToken, shiftApprovalController.rejectShifts);

module.exports = router;
