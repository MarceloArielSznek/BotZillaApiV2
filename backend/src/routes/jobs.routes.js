const express = require('express');
const router = express.Router();
const jobsController = require('../controllers/jobs.controller');
const authMiddleware = require('../middleware/auth.middleware');

router.get('/', authMiddleware.verifyToken, jobsController.getAllJobs);
router.get('/:id', authMiddleware.verifyToken, jobsController.getJobById);
router.delete('/:id', authMiddleware.verifyToken, jobsController.deleteJob);

module.exports = router; 