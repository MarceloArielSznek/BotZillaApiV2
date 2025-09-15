const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobs.controller');
const authMiddleware = require('../middleware/auth.middleware');

// Middleware para parsear JSON
router.use(express.json());

router.get('/', authMiddleware.verifyToken, jobsController.getAllJobs);
router.get('/:id', authMiddleware.verifyToken, jobsController.getJobById);
router.post('/', authMiddleware.verifyToken, jobsController.createJob);
router.put('/:id', authMiddleware.verifyToken, jobsController.updateJob);
router.delete('/:id', authMiddleware.verifyToken, jobsController.deleteJob);
router.post('/:id/shifts', authMiddleware.verifyToken, jobsController.addOrUpdateShifts);
router.get('/:id/performance', authMiddleware.verifyToken, jobsController.getJobPerformance);

// Nuevas rutas para manejo de job status
router.post('/create-from-sold-estimates', authMiddleware.verifyToken, jobsController.createJobsFromSoldEstimates);
router.patch('/:id/mark-done', authMiddleware.verifyToken, jobsController.markJobAsDone);
router.get('/status/stats', authMiddleware.verifyToken, jobsController.getJobStatusStats);

module.exports = router; 