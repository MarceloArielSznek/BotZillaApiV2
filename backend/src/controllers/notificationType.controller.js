const { NotificationType } = require('../models');

exports.getAllTypes = async (req, res) => {
    try {
        const types = await NotificationType.findAll({ order: [['name', 'ASC']] });
        res.json(types);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notification types', error: error.message });
    }
};

exports.createType = async (req, res) => {
    try {
        const { name } = req.body;
        const newType = await NotificationType.create({ name });
        res.status(201).json(newType);
    } catch (error) {
        res.status(500).json({ message: 'Error creating notification type', error: error.message });
    }
};

exports.updateType = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        const type = await NotificationType.findByPk(id);
        if (!type) {
            return res.status(404).json({ message: 'Notification type not found' });
        }
        await type.update({ name });
        res.json(type);
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification type', error: error.message });
    }
};

exports.deleteType = async (req, res) => {
    try {
        const { id } = req.params;
        const type = await NotificationType.findByPk(id);
        if (!type) {
            return res.status(404).json({ message: 'Notification type not found' });
        }
        await type.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification type', error: error.message });
    }
}; 