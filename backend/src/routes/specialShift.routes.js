const express = require('express');
const router = express.Router();
const specialShiftController = require('../controllers/specialShift.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/', verifyToken, specialShiftController.getAllSpecialShifts);

module.exports = router; 