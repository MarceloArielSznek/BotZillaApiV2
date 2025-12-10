const express = require('express');
const router = express.Router();
const smsBatchesController = require('../controllers/smsBatches.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// GET /api/sms-batches - Listar batches
router.get('/', smsBatchesController.getAllBatches);

// GET /api/sms-batches/:id - Obtener batch por ID
router.get('/:id', smsBatchesController.getBatchById);

// POST /api/sms-batches/filter - Crear batch desde filtros
router.post('/filter', smsBatchesController.createBatchFromFilters);

// POST /api/sms-batches/selection - Crear batch desde selección manual
router.post('/selection', smsBatchesController.createBatchFromSelection);

// PUT /api/sms-batches/:id - Actualizar batch
router.put('/:id', smsBatchesController.updateBatch);

// DELETE /api/sms-batches/:id - Eliminar batch
router.delete('/:id', smsBatchesController.deleteBatch);

// POST /api/sms-batches/:id/estimates - Agregar estimates al batch
router.post('/:id/estimates', smsBatchesController.addEstimatesToBatch);

// DELETE /api/sms-batches/:id/estimates/:estimateId - Remover estimate del batch
router.delete('/:id/estimates/:estimateId', smsBatchesController.removeEstimateFromBatch);

// POST /api/sms-batches/:id/send - Enviar batch a QUO vía webhook
router.post('/:id/send', smsBatchesController.sendBatchToQuo);

module.exports = router;

