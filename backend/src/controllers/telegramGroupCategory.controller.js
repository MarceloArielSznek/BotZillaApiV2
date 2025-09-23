const { TelegramGroupCategory } = require('../models');
const { logger } = require('../utils/logger');

class TelegramGroupCategoryController {
    async getAllCategories(req, res) {
        try {
            const categories = await TelegramGroupCategory.findAll({
                order: [['name', 'ASC']]
            });
            res.status(200).json({ success: true, data: categories });
        } catch (error) {
            logger.error('Error fetching telegram group categories', { error: error.message });
            res.status(500).json({ success: false, message: 'Failed to fetch categories.' });
        }
    }
}

module.exports = new TelegramGroupCategoryController();
