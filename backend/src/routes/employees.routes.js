const express = require('express');
const router = express.Router();
const employeeController = require('../controllers/employee.controller');
const { verifyToken } = require('../middleware/auth.middleware');
const { isAdmin } = require('../middleware/roles.middleware');

// GET /api/employees - Listar todos los empleados
router.get(
    '/',
    verifyToken,
    employeeController.getAllEmployees
);

// GET /api/employees/pending - Listar empleados pendientes de onboarding
router.get(
    '/pending', 
    verifyToken,
    // Podríamos restringirlo a admin/office_manager si fuera necesario
    employeeController.getPendingEmployees
);

// GET /api/employees/:id/groups - Obtener los grupos de un empleado específico
router.get(
    '/:id/groups',
    verifyToken,
    employeeController.getEmployeeGroups
);

// POST /api/employees/:id/activate - Activar un employee y crear crew_member o sales_person
router.post(
    '/:id/activate',
    verifyToken,
    isAdmin, // Solo admin y office_manager pueden activar
    employeeController.activateEmployee
);

// POST /api/employees/:id/reject - Rechazar un employee
router.post(
    '/:id/reject',
    verifyToken,
    isAdmin, // Solo admin y office_manager pueden rechazar
    employeeController.rejectEmployee
);

module.exports = router;
