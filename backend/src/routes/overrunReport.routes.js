const express = require('express');
const router = express.Router();
const overrunReportController = require('../controllers/overrunReport.controller');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * @route   POST /api/overrun-reports/send-bulk-to-make
 * @desc    Send multiple jobs to Make.com for bulk report generation
 * @access  Private
 */
router.post('/send-bulk-to-make', verifyToken, overrunReportController.sendBulkToMake);

module.exports = router;

