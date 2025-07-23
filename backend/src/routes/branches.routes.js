const express = require('express');
const router = express.Router();
const branchesController = require('../controllers/branches.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateBranch, validateCompositeParams } = require('../middleware/validation.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/branches - Listar todas las branches (con cache)
router.get('/', 
    validateBranch.list,
    caches.lists.middleware('branches_list', 300000), // 5 minutos
    branchesController.getAllBranches
);

// GET /api/branches/:id - Obtener una branch específica (con cache)
router.get('/:id', 
    validateBranch.params,
    caches.entities.middleware('branch_detail', 600000), // 10 minutos
    branchesController.getBranchById
);

// POST /api/branches - Crear nueva branch (con invalidación de cache)
router.post('/', 
    validateBranch.create,
    cacheInvalidationMiddleware('branch'),
    branchesController.createBranch
);

// PUT /api/branches/:id - Actualizar branch (con invalidación de cache)
router.put('/:id', 
    validateBranch.params,
    validateBranch.update,
    cacheInvalidationMiddleware('branch'),
    branchesController.updateBranch
);

// DELETE /api/branches/:id - Eliminar branch (con invalidación de cache)
router.delete('/:id', 
    validateBranch.params,
    cacheInvalidationMiddleware('branch'),
    branchesController.deleteBranch
);

// POST /api/branches/:id/salespersons - Asignar salesperson (con invalidación)
router.post('/:id/salespersons', 
    validateBranch.params,
    validateBranch.assignSalesPerson,
    cacheInvalidationMiddleware('branch'),
    branchesController.assignSalesPerson
);

// DELETE /api/branches/:id/salespersons/:salesPersonId - Remover salesperson (con invalidación)
router.delete('/:id/salespersons/:salesPersonId', 
    validateCompositeParams,
    cacheInvalidationMiddleware('branch'),
    branchesController.removeSalesPerson
);

module.exports = router; 