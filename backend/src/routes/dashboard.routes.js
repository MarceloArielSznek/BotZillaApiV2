const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboard.controller');
const { verifyToken } = require('../middleware/auth.middleware');

router.get('/summary', verifyToken, (req, res) => dashboardController.getSummary(req, res));

module.exports = router;

