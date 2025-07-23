const express = require('express');
const router = express.Router();
const crewController = require('../controllers/crew.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { caches, cacheInvalidationMiddleware } = require('../utils/cache');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/crew-members - Listar todos los crew members (con cache)
router.get('/', 
    caches.lists.middleware('crew_members_list', 300000), // 5 minutos
    crewController.getAllCrewMembers
);

// GET /api/crew-members/:id - Obtener un crew member específico (con cache)
router.get('/:id', 
    caches.entities.middleware('crew_member_detail', 600000), // 10 minutos
    crewController.getCrewMemberById
);

// POST /api/crew-members - Crear nuevo crew member (con invalidación de cache)
router.post('/', 
    cacheInvalidationMiddleware('crew_member'),
    crewController.createCrewMember
);

// PUT /api/crew-members/:id - Actualizar crew member (con invalidación de cache)
router.put('/:id', 
    cacheInvalidationMiddleware('crew_member'),
    crewController.updateCrewMember
);

// DELETE /api/crew-members/:id - Eliminar crew member (con invalidación de cache)
router.delete('/:id', 
    cacheInvalidationMiddleware('crew_member'),
    crewController.deleteCrewMember
);

// GET /api/crew-members/:id/branches - Obtener branches de un crew member (con cache)
router.get('/:id/branches', 
    caches.entities.middleware('crew_member_branches', 300000), // 5 minutos
    crewController.getCrewMemberBranches
);

// POST /api/crew-members/:id/branches - Asignar branches a crew member (con invalidación)
router.post('/:id/branches', 
    cacheInvalidationMiddleware('crew_member'),
    crewController.assignBranches
);

module.exports = router; 