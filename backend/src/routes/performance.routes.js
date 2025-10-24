const express = require('express');
const router = express.Router();
const multer = require('multer');
const performanceController = require('../controllers/performance.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Configurar multer para uploads en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10 MB max
    },
    fileFilter: (req, file, cb) => {
        // Aceptar solo archivos Excel
        const allowedMimes = [
            'application/vnd.ms-excel',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel.sheet.macroEnabled.12'
        ];
        
        if (allowedMimes.includes(file.mimetype) || file.originalname.match(/\.(xlsx|xls|xlsm)$/)) {
            cb(null, true);
        } else {
            cb(new Error('Only Excel files (.xlsx, .xls, .xlsm) are allowed'));
        }
    }
});

/**
 * Middleware to check if user is admin or office_manager
 */
const isAdminOrOfficeManager = (req, res, next) => {
    const userRole = req.user?.rol?.name;
    
    if (userRole === 'admin' || userRole === 'office_manager') {
        return next();
    }
    
    return res.status(403).json({
        success: false,
        message: 'Forbidden: You do not have permission to perform this action.'
    });
};

/**
 * @route   POST /api/performance/trigger-sync
 * @desc    Trigger Make.com webhook to fetch jobs in "uploading shifts" status
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/trigger-sync',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.triggerJobsSync
);

/**
 * @route   GET /api/performance/branches
 * @desc    Get all available branches (excluding Corporate)
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/branches',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getBranches
);

/**
 * @route   POST /api/performance/fetch-jobs-from-spreadsheet
 * @desc    Fetch jobs from spreadsheet via Make.com webhook
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/fetch-jobs-from-spreadsheet',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.fetchJobsFromSpreadsheet
);

/**
 * @route   POST /api/performance/receive-jobs-from-spreadsheet
 * @desc    Receive array of jobs from Make.com HTTP Request response
 * @access  Public (called by Make.com)
 */
router.post(
    '/receive-jobs-from-spreadsheet',
    performanceController.receiveJobsFromSpreadsheet
);

/**
 * @route   GET /api/performance/spreadsheet-jobs-cache
 * @desc    Get jobs from cache (polling endpoint)
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/spreadsheet-jobs-cache',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getSpreadsheetJobsFromCache
);

/**
 * @route   POST /api/performance/receive-job
 * @desc    Receive individual job from Make.com (called multiple times, once per row)
 * @access  Public (called by Make.com)
 */
router.post(
    '/receive-job',
    performanceController.receiveJob
);

/**
 * @route   GET /api/performance/sync-jobs/:sync_id
 * @desc    Get all jobs for a specific sync_id
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/sync-jobs/:sync_id',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getSyncJobs
);

/**
 * @route   POST /api/performance/upload-buildertrend
 * @desc    Upload BuilderTrend Excel file for shift processing
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/upload-buildertrend',
    verifyToken,
    isAdminOrOfficeManager,
    upload.single('file'),
    performanceController.uploadBuilderTrendExcel
);

/**
 * @route   GET /api/performance/processed-shifts/:sync_id
 * @desc    Get all processed shifts for a sync_id
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/processed-shifts/:sync_id',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getProcessedShifts
);

/**
 * @route   POST /api/performance/confirm-job-matches
 * @desc    Confirm manual job matches from modal
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/confirm-job-matches',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.confirmJobMatches
);

/**
 * @route   GET /api/performance/aggregated-shifts/:sync_id
 * @desc    Get aggregated shifts by crew member and job
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/aggregated-shifts/:sync_id',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getAggregatedShifts
);

/**
 * @route   POST /api/performance/send-to-spreadsheet
 * @desc    Send processed shifts to Make.com for spreadsheet write
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/send-to-spreadsheet',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.sendShiftsToSpreadsheet
);

/**
 * @route   POST /api/performance/save-permanently
 * @desc    Save Performance data permanently to job and shift tables
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/save-permanently',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.savePerformanceDataPermanently
);

/**
 * @route   GET /api/performance/pending-approval
 * @desc    Get jobs and shifts pending approval
 * @access  Private (Admin, Office Manager)
 */
router.get(
    '/pending-approval',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.getPendingApproval
);

/**
 * @route   POST /api/performance/approve-jobs
 * @desc    Approve jobs and their shifts
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/approve-jobs',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.approveJobs
);

/**
 * @route   POST /api/performance/reject-shifts
 * @desc    Reject specific shifts
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/reject-shifts',
    verifyToken,
    isAdminOrOfficeManager,
    performanceController.rejectShifts
);

module.exports = router;

