const { NotificationTemplate, NotificationType } = require('../models');

exports.getAllTemplates = async (req, res) => {
    try {
        const templates = await NotificationTemplate.findAll({
            include: [{ model: NotificationType, as: 'notificationType' }],
            order: [['name', 'ASC']]
        });
        res.json(templates);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching notification templates', error: error.message });
    }
};

exports.createTemplate = async (req, res) => {
    try {
        const { name, notification_type_id, level, template_text } = req.body;
        const newTemplate = await NotificationTemplate.create({ name, notification_type_id, level, template_text });
        res.status(201).json(newTemplate);
    } catch (error) {
        res.status(500).json({ message: 'Error creating notification template', error: error.message });
    }
};

exports.updateTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, notification_type_id, level, template_text } = req.body;
        const template = await NotificationTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ message: 'Notification template not found' });
        }
        await template.update({ name, notification_type_id, level, template_text });
        res.json(template);
    } catch (error) {
        res.status(500).json({ message: 'Error updating notification template', error: error.message });
    }
};

exports.deleteTemplate = async (req, res) => {
    try {
        const { id } = req.params;
        const template = await NotificationTemplate.findByPk(id);
        if (!template) {
            return res.status(404).json({ message: 'Notification template not found' });
        }
        await template.destroy();
        res.status(204).send();
    } catch (error) {
        res.status(500).json({ message: 'Error deleting notification template', error: error.message });
    }
}; 