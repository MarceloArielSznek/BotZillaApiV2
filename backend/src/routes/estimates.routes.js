const express = require('express');
const router = express.Router();
const estimatesController = require('../controllers/estimates.controller');
const { verifyToken } = require('../middleware/auth.middleware');
// const { validateEstimate } = require('../middleware/validation.middleware'); // Se comenta por ahora

// La funcionalidad de sync se ha movido al módulo de automations
// router.post('/sync-estimates', 
//     verifyToken,
//     validateEstimate.sync,
//     estimatesController.syncEstimates
// );

// Esta ruta se ha movido a /automations/estimates/sync-external
// router.post('/sync-external',
//     verifyToken,
//     estimatesController.syncExternalEstimates
// );

// Obtener todos los estimates con filtros y paginación (requiere autenticación)
router.get('/', 
    verifyToken,
    // validateEstimate.fetch, // Se comenta por ahora
    estimatesController.getAllEstimates
);

// Obtener detalles de un estimate específico (requiere autenticación)
router.get('/:id', 
    verifyToken,
    estimatesController.getEstimateDetails
);

module.exports = router; 