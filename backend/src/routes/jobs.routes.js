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
router.post('/fix-crew-leaders', authMiddleware.verifyToken, jobsController.fixJobsWithoutCrewLeader);

module.exports = router; 