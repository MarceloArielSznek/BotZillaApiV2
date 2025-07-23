const express = require('express');
const router = express.Router();
const statusesController = require('../controllers/statuses.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { validateStatus } = require('../middleware/validation.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/estimate-statuses/analytics - Obtener analytics (con cache)
router.get('/analytics', 
    validateStatus.analytics,
    caches.analytics.middleware('status_analytics', 1800000), // 30 minutos
    statusesController.getStatusAnalytics
);

// GET /api/estimate-statuses - Listar todos los estimate statuses (con cache)
router.get('/', 
    validateStatus.list,
    caches.lists.middleware('statuses_list', 300000), // 5 minutos
    statusesController.getAllStatuses
);

// GET /api/estimate-statuses/:id - Obtener un estimate status específico (con cache)
router.get('/:id', 
    validateStatus.params,
    caches.entities.middleware('status_detail', 600000), // 10 minutos
    statusesController.getStatusById
);

// POST /api/estimate-statuses - Crear nuevo estimate status (con invalidación de cache)
router.post('/', 
    validateStatus.create,
    cacheInvalidationMiddleware('status'),
    statusesController.createStatus
);

// PUT /api/estimate-statuses/:id - Actualizar estimate status (con invalidación de cache)
router.put('/:id', 
    validateStatus.params,
    validateStatus.update,
    cacheInvalidationMiddleware('status'),
    statusesController.updateStatus
);

// DELETE /api/estimate-statuses/:id - Eliminar estimate status (con invalidación de cache)
router.delete('/:id', 
    validateStatus.params,
    cacheInvalidationMiddleware('status'),
    statusesController.deleteStatus
);

module.exports = router; 