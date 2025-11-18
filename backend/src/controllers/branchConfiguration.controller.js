const { BranchConfiguration, MultiplierRange, Branch, BranchConfigurationMultiplierRange } = require('../models');
const { logger } = require('../utils/logger');

class BranchConfigurationController {
    /**
     * Get all branch configurations with their multiplier ranges
     * GET /api/branch-configurations
     */
    async getAllConfigurations(req, res) {
        try {
            logger.info('📊 [BranchConfiguration] Fetching all branch configurations...');
            logger.info(`📊 [BranchConfiguration] User: ${req.user?.email || 'unknown'}`);

            const configurations = await BranchConfiguration.findAll({
                include: [
                    {
                        model: Branch,
                        as: 'branches',
                        attributes: ['id', 'name', 'attic_tech_branch_id']
                    },
                    {
                        model: MultiplierRange,
                        as: 'multiplierRanges',
                        through: { attributes: [] }, // Excluir campos de la tabla junction
                        attributes: [
                            'id',
                            'name',
                            'min_cost',
                            'max_cost',
                            'lowest_multiple',
                            'highest_multiple',
                            'at_multiplier_range_id'
                        ]
                    }
                ],
                order: [
                    ['name', 'ASC'],
                    [{ model: MultiplierRange, as: 'multiplierRanges' }, 'min_cost', 'ASC']
                ]
            });

            logger.info(`✅ Found ${configurations.length} configurations`);

            return res.status(200).json({
                success: true,
                data: configurations
            });

        } catch (error) {
            logger.error('❌ [BranchConfiguration] Error fetching branch configurations:', error);
            logger.error('❌ [BranchConfiguration] Stack:', error.stack);
            return res.status(500).json({
                success: false,
                message: 'Error fetching branch configurations',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }

    /**
     * Get a single configuration by ID
     * GET /api/branch-configurations/:id
     */
    async getConfigurationById(req, res) {
        try {
            const { id } = req.params;

            const configuration = await BranchConfiguration.findByPk(id, {
                include: [
                    {
                        model: Branch,
                        as: 'branches',
                        attributes: ['id', 'name', 'attic_tech_branch_id']
                    },
                    {
                        model: MultiplierRange,
                        as: 'multiplierRanges',
                        through: { attributes: [] },
                        attributes: [
                            'id',
                            'name',
                            'min_cost',
                            'max_cost',
                            'lowest_multiple',
                            'highest_multiple',
                            'at_multiplier_range_id'
                        ]
                    }
                ],
                order: [
                    [{ model: MultiplierRange, as: 'multiplierRanges' }, 'min_cost', 'ASC']
                ]
            });

            if (!configuration) {
                return res.status(404).json({
                    success: false,
                    message: 'Configuration not found'
                });
            }

            return res.status(200).json({
                success: true,
                data: configuration
            });

        } catch (error) {
            logger.error('❌ Error fetching configuration:', error);
            return res.status(500).json({
                success: false,
                message: 'Error fetching configuration',
                error: error.message
            });
        }
    }
}

module.exports = new BranchConfigurationController();

