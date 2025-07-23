const express = require('express');
const router = express.Router();
const salespersonsController = require('../controllers/salespersons.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateSalesPerson } = require('../middleware/validation.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');
const { isAdmin } = require('../middleware/auth.middleware');

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

// POST /api/salespersons/:id/branches - Asignar branches a salesperson (con invalidación)
router.post('/:id/branches', 
    validateSalesPerson.params,
    validateSalesPerson.assignBranches,
    cacheInvalidationMiddleware('salesperson'),
    salespersonsController.assignBranches
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
    verifyToken,
    isAdmin,
    salespersonsController.getActiveEstimates
);

// Enviar reporte de estimates activos a un salesperson (requiere token, admin)
router.post(
    '/:id/send-report',
    verifyToken,
    isAdmin,
    salespersonsController.sendActiveEstimatesReport
);

module.exports = router; 