const { TelegramGroup, Branch, TelegramGroupCategory } = require('../models');
const { logger } = require('../utils/logger');

class TelegramGroupController {
    
    /**
     * Listar todos los grupos de Telegram con paginación
     */
    async getAllGroups(req, res) {
        try {
            const { page = 1, limit = 10 } = req.query;
            const offset = (page - 1) * limit;

            const { count, rows } = await TelegramGroup.findAndCountAll({
                limit: parseInt(limit),
                offset: parseInt(offset),
                include: [
                    { model: Branch, as: 'branch' },
                    { model: TelegramGroupCategory, as: 'category' }
                ],
                order: [
                    [{ model: TelegramGroupCategory, as: 'category' }, 'name', 'ASC'],
                    ['name', 'ASC']
                ]
            });

            res.status(200).json({
                success: true,
                data: rows,
                pagination: {
                    totalItems: count,
                    totalPages: Math.ceil(count / limit),
                    currentPage: parseInt(page)
                }
            });
        } catch (error) {
            logger.error('Error fetching telegram groups', { error: error.message, stack: error.stack });
            res.status(500).json({ success: false, message: 'Failed to fetch groups.' });
        }
    }

    /**
     * Obtener un grupo por su ID
     */
    async getGroupById(req, res) {
        try {
            const group = await TelegramGroup.findByPk(req.params.id, {
                include: [{ model: Branch, as: 'branch' }]
            });
            if (!group) {
                return res.status(404).json({ success: false, message: 'Group not found.' });
            }
            res.status(200).json({ success: true, data: group });
        } catch (error) {
            logger.error('Error fetching telegram group by ID', { id: req.params.id, error: error.message });
            res.status(500).json({ success: false, message: 'Failed to fetch group.' });
        }
    }

    /**
     * Crear un nuevo grupo de Telegram
     */
    async createGroup(req, res) {
        try {
            const { name, branch_id, telegram_id, description, category_id, is_default } = req.body;
            const newGroup = await TelegramGroup.create({ name, branch_id, telegram_id, description, category_id, is_default });
            logger.info('New Telegram group created', { groupId: newGroup.id, name });
            res.status(201).json({ success: true, message: 'Group created successfully.', data: newGroup });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ success: false, message: 'A group with this Telegram ID already exists.' });
            }
            logger.error('Error creating telegram group', { error: error.message, body: req.body });
            res.status(500).json({ success: false, message: 'Failed to create group.' });
        }
    }

    /**
     * Actualizar un grupo de Telegram existente
     */
    async updateGroup(req, res) {
        try {
            const { id } = req.params;
            const { name, branch_id, telegram_id, description, category_id, is_default } = req.body;

            const group = await TelegramGroup.findByPk(id);
            if (!group) {
                return res.status(404).json({ success: false, message: 'Group not found.' });
            }

            await group.update({ name, branch_id, telegram_id, description, category_id, is_default });
            logger.info('Telegram group updated', { groupId: id });
            res.status(200).json({ success: true, message: 'Group updated successfully.', data: group });
        } catch (error) {
            if (error.name === 'SequelizeUniqueConstraintError') {
                return res.status(409).json({ success: false, message: 'Another group with this Telegram ID already exists.' });
            }
            logger.error('Error updating telegram group', { id: req.params.id, error: error.message });
            res.status(500).json({ success: false, message: 'Failed to update group.' });
        }
    }

    /**
     * Eliminar un grupo de Telegram
     */
    async deleteGroup(req, res) {
        try {
            const { id } = req.params;
            const group = await TelegramGroup.findByPk(id);
            if (!group) {
                return res.status(404).json({ success: false, message: 'Group not found.' });
            }

            await group.destroy();
            logger.info('Telegram group deleted', { groupId: id });
            res.status(200).json({ success: true, message: 'Group deleted successfully.' });
        } catch (error) {
            logger.error('Error deleting telegram group', { id: req.params.id, error: error.message });
            res.status(500).json({ success: false, message: 'Failed to delete group.' });
        }
    }
}

module.exports = new TelegramGroupController();
