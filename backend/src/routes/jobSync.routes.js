const express = require('express');
const router = express.Router();
const jobSyncController = require('../controllers/jobSync.controller');
const flexibleAuth = require('../middleware/auth.flexible.middleware');

/**
 * @route POST /api/job-sync/sync-jobs
 * @description Sincroniza jobs desde Attic Tech (desde hoy en adelante)
 * @access Private (requiere JWT Token O API Key)
 */
router.post(
    '/sync-jobs',
    flexibleAuth,
    jobSyncController.syncJobs
);

/**
 * @route GET /api/job-sync/sync-jobs
 * @description Igual que POST (para compatibilidad)
 * @access Private (requiere JWT Token O API Key)
 */
router.get(
    '/sync-jobs',
    flexibleAuth,
    jobSyncController.syncJobs
);

module.exports = router;

