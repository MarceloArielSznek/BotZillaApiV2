const express = require('express');
const router = express.Router();
const notificationTemplateController = require('../controllers/notificationTemplate.controller');
const { verifyToken, isAdmin } = require('../middleware/auth.middleware');

// Middleware para parsear JSON
router.use(express.json());

// GET all notification templates
router.get('/', verifyToken, notificationTemplateController.getAllTemplates);

// POST a new notification template (admin only)
router.post('/', verifyToken, isAdmin, notificationTemplateController.createTemplate);

// PUT to update a notification template (admin only)
router.put('/:id', verifyToken, isAdmin, notificationTemplateController.updateTemplate);

// DELETE a notification template (admin only)
router.delete('/:id', verifyToken, isAdmin, notificationTemplateController.deleteTemplate);

module.exports = router; 