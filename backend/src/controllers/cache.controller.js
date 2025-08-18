const { caches } = require('../utils/cache');
const { logger } = require('../utils/logger');

class CacheController {
    async clearAllCaches(req, res) {
        try {
            logger.info('Received request to clear all caches...');
            let clearedCount = 0;

            Object.values(caches).forEach(cacheInstance => {
                clearedCount += cacheInstance.clear();
            });

            const message = `All caches cleared successfully. ${clearedCount} items removed.`;
            logger.info(message);

            res.status(200).json({
                success: true,
                message: message,
                clearedItems: clearedCount
            });
        } catch (error) {
            logger.error('Error clearing caches:', error);
            res.status(500).json({
                success: false,
                message: 'An internal server error occurred while clearing caches.',
                error: error.message
            });
        }
    }

    async clearCrewMembersCache(req, res) {
        try {
            logger.info('Received request to clear crew members cache...');
            let clearedCount = 0;

            // Limpiar cache específico de crew members
            clearedCount += caches.lists.deletePattern('.*crew.*member.*');
            clearedCount += caches.lists.deletePattern('.*crew.*members.*');
            clearedCount += caches.entities.deletePattern('.*crew.*member.*');
            clearedCount += caches.entities.deletePattern('.*crew.*members.*');

            const message = `Crew members cache cleared successfully. ${clearedCount} items removed.`;
            logger.info(message);

            res.status(200).json({
                success: true,
                message: message,
                clearedItems: clearedCount
            });
        } catch (error) {
            logger.error('Error clearing crew members cache:', error);
            res.status(500).json({
                success: false,
                message: 'An internal server error occurred while clearing crew members cache.',
                error: error.message
            });
        }
    }
}

module.exports = new CacheController(); 