'use strict';

const { FollowUpTicket, FollowUpStatus, FollowUpLabel, Chat, ChatMessage, Estimate, User } = require('../models');
const { logger } = require('../utils/logger');

class FollowUpTicketsController {
    
    /**
     * Obtener ticket de follow-up por estimate_id
     */
    async getTicketByEstimateId(req, res) {
        try {
            const { estimateId } = req.params;
            
            let ticket = await FollowUpTicket.findOne({
                where: { estimate_id: estimateId },
                include: [
                    { model: FollowUpStatus, as: 'status' },
                    { model: FollowUpLabel, as: 'label' },
                    { model: User, as: 'assignedUser', attributes: ['id', 'email', 'phone'] },
                    { 
                        model: Chat, 
                        as: 'chat',
                        include: [{
                            model: ChatMessage,
                            as: 'messages',
                            order: [['sent_at', 'ASC']]
                        }]
                    }
                ]
            });

            // Si no existe, crear uno por defecto
            if (!ticket) {
                const negotiatingStatus = await FollowUpStatus.findOne({ where: { name: 'Negotiating' } });
                
                ticket = await FollowUpTicket.create({
                    estimate_id: estimateId,
                    followed_up: false,
                    status_id: negotiatingStatus ? negotiatingStatus.id : null,
                    notes: 'Created from follow-up dashboard'
                });

                // Reload con includes
                ticket = await FollowUpTicket.findByPk(ticket.id, {
                    include: [
                        { model: FollowUpStatus, as: 'status' },
                        { model: FollowUpLabel, as: 'label' },
                        { model: User, as: 'assignedUser', attributes: ['id', 'email', 'phone'] },
                        { model: Chat, as: 'chat' }
                    ]
                });
            }

            res.json({
                success: true,
                data: ticket
            });

        } catch (error) {
            logger.error('Error fetching follow-up ticket:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching follow-up ticket',
                error: error.message
            });
        }
    }

    /**
     * Actualizar ticket de follow-up
     */
    async updateTicket(req, res) {
        try {
            const { id } = req.params;
            const { status_id, label_id, followed_up, notes, assigned_to, follow_up_date } = req.body;

            const ticket = await FollowUpTicket.findByPk(id);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Follow-up ticket not found'
                });
            }

            // Actualizar campos permitidos
            const updates = {};
            if (status_id !== undefined) updates.status_id = status_id;
            if (label_id !== undefined) updates.label_id = label_id;
            if (followed_up !== undefined) updates.followed_up = followed_up;
            if (notes !== undefined) updates.notes = notes;
            if (assigned_to !== undefined) updates.assigned_to = assigned_to;
            if (follow_up_date !== undefined) updates.follow_up_date = follow_up_date;

            await ticket.update(updates);

            // Reload con includes
            const updatedTicket = await FollowUpTicket.findByPk(id, {
                include: [
                    { model: FollowUpStatus, as: 'status' },
                    { model: FollowUpLabel, as: 'label' },
                    { model: User, as: 'assignedUser', attributes: ['id', 'email', 'phone'] },
                    { model: Chat, as: 'chat' }
                ]
            });

            logger.info(`✅ Follow-up ticket ${id} updated successfully`);

            res.json({
                success: true,
                data: updatedTicket,
                message: 'Follow-up ticket updated successfully'
            });

        } catch (error) {
            logger.error('Error updating follow-up ticket:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating follow-up ticket',
                error: error.message
            });
        }
    }

    /**
     * Crear o obtener chat para un ticket
     */
    async getOrCreateChat(req, res) {
        try {
            const { ticketId } = req.params;

            const ticket = await FollowUpTicket.findByPk(ticketId);

            if (!ticket) {
                return res.status(404).json({
                    success: false,
                    message: 'Follow-up ticket not found'
                });
            }

            let chat;

            if (ticket.chat_id) {
                // Chat ya existe, traerlo con mensajes
                chat = await Chat.findByPk(ticket.chat_id, {
                    include: [{
                        model: ChatMessage,
                        as: 'messages',
                        order: [['sent_at', 'ASC']]
                    }]
                });
            } else {
                // Crear nuevo chat
                chat = await Chat.create({});
                await ticket.update({ chat_id: chat.id });
                
                // Reload para incluir mensajes (vacío)
                chat = await Chat.findByPk(chat.id, {
                    include: [{
                        model: ChatMessage,
                        as: 'messages',
                        order: [['sent_at', 'ASC']]
                    }]
                });
            }

            res.json({
                success: true,
                data: chat
            });

        } catch (error) {
            logger.error('Error getting/creating chat:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting/creating chat',
                error: error.message
            });
        }
    }

    /**
     * Agregar mensaje al chat
     */
    async addMessageToChat(req, res) {
        try {
            const { chatId } = req.params;
            const { sender_type, sender_name, message_text, metadata } = req.body;

            if (!message_text) {
                return res.status(400).json({
                    success: false,
                    message: 'message_text is required'
                });
            }

            const message = await ChatMessage.create({
                chat_id: chatId,
                sender_type: sender_type || 'agent',
                sender_name: sender_name || 'System',
                message_text,
                metadata: metadata || {},
                sent_at: new Date()
            });

            // Update chat's updated_at
            await Chat.update(
                { updated_at: new Date() },
                { where: { id: chatId } }
            );

            res.json({
                success: true,
                data: message,
                message: 'Message added successfully'
            });

        } catch (error) {
            logger.error('Error adding message to chat:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding message to chat',
                error: error.message
            });
        }
    }

    /**
     * Obtener todos los statuses de follow-up
     */
    async getAllStatuses(req, res) {
        try {
            const statuses = await FollowUpStatus.findAll({
                order: [['name', 'ASC']]
            });

            res.json({
                success: true,
                data: statuses
            });

        } catch (error) {
            logger.error('Error fetching follow-up statuses:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching follow-up statuses',
                error: error.message
            });
        }
    }

    /**
     * Obtener todos los labels de follow-up
     */
    async getAllLabels(req, res) {
        try {
            const labels = await FollowUpLabel.findAll({
                order: [['name', 'ASC']]
            });

            res.json({
                success: true,
                data: labels
            });

        } catch (error) {
            logger.error('Error fetching follow-up labels:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching follow-up labels',
                error: error.message
            });
        }
    }
}

module.exports = new FollowUpTicketsController();

