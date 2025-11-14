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

// Ruta para sincronización manual desde el frontend (usa JWT auth)
router.post('/sync-estimates', 
    verifyToken,
    estimatesController.syncEstimatesManual.bind(estimatesController)
);

// Obtener todos los estimates con filtros y paginación (requiere autenticación)
router.get('/', 
    verifyToken,
    // validateEstimate.fetch, // Se comenta por ahora
    estimatesController.getAllEstimates
);

router.get('/sold',
    verifyToken,
    estimatesController.getSoldEstimates
);

// Obtener lost estimates para el módulo de follow-ups
router.get('/lost',
    verifyToken,
    estimatesController.getLostEstimates
);

// Obtener detalles de un estimate específico (requiere autenticación)
router.get('/:id', 
    verifyToken,
    estimatesController.getEstimateDetails
);

// Actualizar un estimate (requiere autenticación)
router.put('/:id',
    verifyToken,
    estimatesController.updateEstimate
);

// Eliminar un estimate (requiere autenticación)
router.delete('/:id',
    verifyToken,
    estimatesController.deleteEstimate
);

module.exports = router; 