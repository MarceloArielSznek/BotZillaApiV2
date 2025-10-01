const express = require('express');
const router = express.Router();
const inspectionReportsController = require('../controllers/inspectionReports.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Stats endpoint must come before the generic / route
router.get(
  '/stats',
  verifyToken,
  inspectionReportsController.getInspectionReportsStats
);

router.get(
  '/',
  verifyToken,
  inspectionReportsController.getAllInspectionReports
);

module.exports = router;
