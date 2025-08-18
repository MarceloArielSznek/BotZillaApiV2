const express = require('express');
const router = express.Router();
const notificationTypeController = require('../controllers/notificationType.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Middleware para parsear JSON
router.use(express.json());

// GET all notification types
router.get('/', verifyToken, notificationTypeController.getAllTypes);

// POST a new notification type (admin only)
router.post('/', verifyToken, isAdmin, notificationTypeController.createType);

// PUT to update a notification type (admin only)
router.put('/:id', verifyToken, isAdmin, notificationTypeController.updateType);

// DELETE a notification type (admin only)
router.delete('/:id', verifyToken, isAdmin, notificationTypeController.deleteType);

module.exports = router; 