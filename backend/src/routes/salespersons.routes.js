const express = require('express');
const router = express.Router();
const salespersonsController = require('../controllers/salespersons.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');
const { validateSalesPerson } = require('../middleware/validation.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');

// Middleware para parsear JSON
router.use(express.json());

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/salespersons - Listar todos los salespersons (con cache)
router.get('/', 
    validateSalesPerson.list,
    caches.lists.middleware('salespersons_list', 300000), // 5 minutos
    salespersonsController.getAllSalesPersons
);

// GET /api/salespersons/:id - Obtener un salesperson específico (con cache)
router.get('/:id', 
    validateSalesPerson.params,
    caches.entities.middleware('salesperson_detail', 600000), // 10 minutos
    salespersonsController.getSalesPersonById
);

// POST /api/salespersons - Crear nuevo salesperson (con invalidación de cache)
router.post('/', 
    validateSalesPerson.create,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.createSalesPerson
);

// PUT /api/salespersons/:id - Actualizar salesperson (con invalidación de cache)
router.put('/:id', 
    validateSalesPerson.params,
    validateSalesPerson.update,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.updateSalesPerson
);

// PATCH /api/salespersons/:id/status - Activar/desactivar salesperson (con invalidación de cache)
router.patch('/:id/status',
    validateSalesPerson.params,
    validateSalesPerson.toggleStatus,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.toggleSalesPersonStatus
);

// DELETE /api/salespersons/:id - Eliminar salesperson (con invalidación de cache)
router.delete('/:id', 
    validateSalesPerson.params,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.deleteSalesPerson
);

// GET /api/salespersons/:id/branches - Obtener branches de un salesperson (con cache)
router.get('/:id/branches', 
    validateSalesPerson.params,
    caches.entities.middleware('salesperson_branches', 300000), // 5 minutos
    salespersonsController.getSalesPersonBranches
);

// POST /api/salespersons/:salespersonId/branches/:branchId - Añadir una branch a un salesperson
router.post('/:salespersonId/branches/:branchId',
    validateSalesPerson.manageBranch,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.addBranchToSalesperson
);

// DELETE /api/salespersons/:salespersonId/branches/:branchId - Eliminar una branch de un salesperson
router.delete('/:salespersonId/branches/:branchId',
    validateSalesPerson.manageBranch,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.removeBranchFromSalesperson
);

// POST /api/salespersons/:id/warning - Incrementar warning count (con invalidación)
router.post('/:id/warning', 
    validateSalesPerson.params,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.incrementWarning
);

// Obtener estimates activos de un salesperson (requiere token, admin)
router.get(
    '/:id/active-estimates',
    isAdmin,
    salespersonsController.getActiveEstimates
);

// Enviar reporte de estimates activos a un salesperson (requiere token, admin)
router.post(
    '/:id/send-report',
    isAdmin,
    salespersonsController.sendActiveEstimatesReport
);

module.exports = router;
