'use strict';

const express = require('express');
const router = express.Router();
const dailyShiftUploadController = require('../controllers/dailyShiftUpload.controller');
const { verifyToken, isAdminOrOfficeManager } = require('../middleware/auth');
const multer = require('multer');

// Configurar multer para manejar archivos en memoria
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB límite
    },
    fileFilter: (req, file, cb) => {
        // Aceptar solo archivos Excel
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'application/vnd.ms-excel',
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
 * @route   POST /api/daily-shift-upload/parse
 * @desc    Parsear Excel de BuilderTrend y devolver datos agrupados (sin guardar en BD)
 * @access  Private (Admin, Office Manager)
 */
router.post(
    '/parse',
    verifyToken,
    isAdminOrOfficeManager,
    upload.single('file'),
    dailyShiftUploadController.parseDailyShifts
);

module.exports = router;

