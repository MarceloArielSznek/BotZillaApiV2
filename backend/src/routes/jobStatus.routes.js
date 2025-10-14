const express = require('express');
const router = express.Router();
const { JobStatus } = require('../models');
const { verifyToken } = require('../middleware/auth.middleware');

/**
 * @route GET /api/job-statuses
 * @description Get all job statuses
 * @access Private
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const statuses = await JobStatus.findAll({
            attributes: ['id', 'name'],
            order: [['id', 'ASC']]
        });

        res.status(200).json(statuses);
    } catch (error) {
        console.error('Error fetching job statuses:', error);
        res.status(500).json({ success: false, message: 'Server error fetching job statuses.' });
    }
});

module.exports = router;

