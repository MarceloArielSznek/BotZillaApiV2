const express = require('express');
const router = express.Router();
const branchConfigurationController = require('../controllers/branchConfiguration.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET all configurations
router.get('/', branchConfigurationController.getAllConfigurations);

// GET configuration by ID
router.get('/:id', branchConfigurationController.getConfigurationById);

module.exports = router;

