'use strict';

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth.middleware');
const aiController = require('../controllers/ai.controller');

router.post('/generate-operation-post', verifyToken, aiController.generateOperationPost);

module.exports = router;

