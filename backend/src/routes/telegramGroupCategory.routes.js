const express = require('express');
const router = express.Router();
const telegramGroupCategoryController = require('../controllers/telegramGroupCategory.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// GET /api/telegram-group-categories - Listar todas las categorías
router.get('/', verifyToken, telegramGroupCategoryController.getAllCategories);

module.exports = router;
