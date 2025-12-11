'use strict';

const { FollowUpTicket, FollowUpStatus, FollowUpLabel, Chat, ChatMessage, Estimate, User } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');
const axios = require('axios');
const { emitNewMessage, emitInboxUpdate } = require('../socket/socketServer');

/**
 * Normaliza un número de teléfono al formato +1xxxxxxxxxx requerido por Make.com
 * @param {string} phone - Número de teléfono en cualquier formato
 * @returns {string|null} - Número normalizado en formato +1xxxxxxxxxx o null si no es válido
 */
function normalizePhoneNumber(phone) {
    if (!phone) {
        return null;
    }

    // Convertir a string si no lo es
    const phoneStr = String(phone).trim();
    
    if (!phoneStr || phoneStr.length === 0) {
        return null;
    }

    // Remover todos los caracteres no numéricos excepto el +
    let cleaned = phoneStr.replace(/[^\d+]/g, '');

    // Si no tiene dígitos, retornar null
    if (cleaned.length === 0 || cleaned === '+') {
        logger.warn(`⚠️ Invalid phone number (no digits): ${phone}`);
        return null;
    }

    // Remover el + si existe para procesar solo los dígitos
    const hasPlus = cleaned.startsWith('+');
    const digitsOnly = hasPlus ? cleaned.substring(1) : cleaned;

    // Si empieza con 1 y tiene 11 dígitos, es +1 + 10 dígitos
    if (digitsOnly.startsWith('1') && digitsOnly.length === 11) {
        return '+1' + digitsOnly.substring(1);
    }
    
    // Si empieza con 1 y tiene más de 11 dígitos, tomar solo los primeros 11
    if (digitsOnly.startsWith('1') && digitsOnly.length > 11) {
        return '+1' + digitsOnly.substring(1, 11);
    }

    // Si tiene exactamente 10 dígitos, agregar +1
    if (digitsOnly.length === 10) {
        return '+1' + digitsOnly;
    }

    // Si tiene más de 10 dígitos pero no empieza con 1, tomar los últimos 10
    if (digitsOnly.length > 10) {
        const last10 = digitsOnly.substring(digitsOnly.length - 10);
        return '+1' + last10;
    }

    // Si tiene menos de 10 dígitos, no es válido
    logger.warn(`⚠️ Invalid phone number (too short): ${phone} -> ${digitsOnly} (${digitsOnly.length} digits)`);
    return null;
}

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
                const pendingFUStatus = await FollowUpStatus.findOne({ where: { name: 'Pending FU' } });
                
                ticket = await FollowUpTicket.create({
                    estimate_id: estimateId,
                    followed_up: false,
                    status_id: pendingFUStatus ? pendingFUStatus.id : null,
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
     * Agregar mensaje al chat y enviar SMS si es del agente
     */
    async addMessageToChat(req, res) {
        try {
            const { chatId } = req.params;
            const { sender_type, sender_name, message_text, metadata, send_sms } = req.body;

            if (!message_text) {
                return res.status(400).json({
                    success: false,
                    message: 'message_text is required'
                });
            }

            // Verificar que el chat existe
            const chat = await Chat.findByPk(chatId);
            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: 'Chat not found'
                });
            }

            // Crear el mensaje en el chat
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

            // Emitir evento WebSocket para notificar a los clientes conectados
            emitNewMessage(chatId, message);

            // Emitir actualización del inbox
            await emitInboxUpdateForChat(chatId);

            // Si es mensaje del agente y se solicita envío SMS, enviar al webhook
            const isAgentMessage = (sender_type || 'agent') === 'agent';
            if (isAgentMessage && send_sms !== false) {
                // Buscar el ticket asociado al chat
                const ticket = await FollowUpTicket.findOne({
                    where: { chat_id: chatId },
                    include: [{
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'customer_phone', 'customer_name', 'name']
                    }]
                });

                if (ticket && ticket.estimate && ticket.estimate.customer_phone) {
                    try {
                        const webhookUrl = process.env.QUO_SMS_WEBHOOK_URL;
                        
                        if (webhookUrl) {
                            // Normalizar número de teléfono al formato +1xxxxxxxxxx
                            const normalizedPhone = normalizePhoneNumber(ticket.estimate.customer_phone);
                            
                            if (!normalizedPhone) {
                                logger.warn(`⚠️ Cannot send SMS - invalid phone number: ${ticket.estimate.customer_phone}`);
                            } else {
                                // Preparar payload en el mismo formato que los batches
                                const payload = {
                                    messages: [{
                                        phone: normalizedPhone,
                                        message: message_text
                                    }]
                                };

                                // Enviar al webhook
                                await axios.post(
                                    webhookUrl,
                                    payload,
                                    {
                                        headers: {
                                            'Content-Type': 'application/json'
                                        },
                                        timeout: 30000
                                    }
                                );

                                // Actualizar metadata del mensaje para indicar que se envió SMS
                                await message.update({
                                    metadata: {
                                        ...(metadata || {}),
                                        sms_sent: true,
                                        sms_sent_at: new Date().toISOString()
                                    }
                                });

                                // Obtener el status "Texted" para actualizar el ticket
                                const textedStatus = await FollowUpStatus.findOne({
                                    where: { name: 'Texted' }
                                });

                                // Actualizar el follow-up ticket: estado a "Texted", fecha de follow-up y marcado como seguido
                                const today = new Date();
                                today.setHours(0, 0, 0, 0); // Establecer a medianoche para DATEONLY
                                
                                const ticketUpdates = {
                                    last_contact_date: new Date(),
                                    follow_up_date: today,
                                    followed_up: true
                                };

                                // Si existe el status "Texted", actualizarlo
                                if (textedStatus) {
                                    ticketUpdates.status_id = textedStatus.id;
                                }

                                await ticket.update(ticketUpdates);

                                logger.info(`✅ SMS sent via webhook for chat ${chatId}, estimate ${ticket.estimate.id}`);
                            }
                        } else {
                            logger.warn('QUO_SMS_WEBHOOK_URL not configured, skipping SMS send');
                        }
                    } catch (smsError) {
                        // No fallar el proceso si hay error al enviar SMS
                        logger.error(`Error sending SMS for chat ${chatId}:`, smsError);
                        // Actualizar metadata para indicar error
                        await message.update({
                            metadata: {
                                ...(metadata || {}),
                                sms_error: smsError.message
                            }
                        });
                    }
                } else {
                    logger.warn(`No phone number found for estimate in chat ${chatId}`);
                }
            }

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

    /**
     * Webhook para recibir mensajes SMS entrantes de QUO
     * QUO envía el objeto directamente:
     * {
     *   "id": "ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
     *   "object": "message",
     *   "from": "+16198805091",
     *   "to": "+18586098330",
     *   "direction": "incoming",
     *   "text": "123 test",
     *   "status": "received",
     *   "created_at": "2025-12-09T16:15:00Z",
     *   "user_id": "USxxxxxxxxxxxxx",
     *   "phone_number_id": "PNHXkfrw6N"
     * }
     */
    async receiveIncomingSms(req, res) {
        try {
            logger.info(`📥 Received webhook from QUO: ${JSON.stringify(req.body, null, 2)}`);

            // Manejar si el body es un array (formato de Make.com)
            let bodyData = req.body;
            if (Array.isArray(req.body) && req.body.length > 0) {
                bodyData = req.body[0];
                logger.info(`📥 Detected array format, using first element`);
            }

            // Extraer phone y message del objeto de QUO
            let phone, message;

            // Formato QUO directo: objeto con from y text
            if (bodyData.from && bodyData.text) {
                phone = bodyData.from;
                message = bodyData.text;
            }
            // Formato Make.com/QUO: data.object
            else if (bodyData.data && bodyData.data.object) {
                phone = bodyData.data.object.from;
                message = bodyData.data.object.text || bodyData.data.object.body;
            }
            // Formato simple: phone y message directos
            else if (bodyData.phone && bodyData.message) {
                phone = bodyData.phone;
                message = bodyData.message;
            }

            if (!phone || !message) {
                logger.error('Invalid webhook format - missing from/phone or text/message', {
                    body: req.body,
                    bodyData: bodyData,
                    isArray: Array.isArray(req.body),
                    hasFrom: !!bodyData?.from,
                    hasText: !!bodyData?.text,
                    hasPhone: !!bodyData?.phone,
                    hasMessage: !!bodyData?.message,
                    hasDataObject: !!(bodyData?.data?.object)
                });
                return res.status(400).json({
                    success: false,
                    message: 'from and text are required. Expected format: { from: "+1234567890", text: "message" } or [{ data: { object: { from: "...", text: "..." } } }]'
                });
            }

            // Normalizar el número de teléfono antes de buscar
            const normalizedPhone = normalizePhoneNumber(phone);
            if (!normalizedPhone) {
                logger.warn(`Invalid phone number format received: ${phone}`);
                return res.status(400).json({
                    success: false,
                    message: `Invalid phone number format: ${phone}`
                });
            }

            logger.info(`📥 Processing incoming SMS from ${phone} (normalized: ${normalizedPhone}): ${message.substring(0, 50)}...`);

            // Buscar el estimate por número de teléfono (normalizado y también el original por si acaso)
            const estimate = await Estimate.findOne({
                where: {
                    [Op.or]: [
                        { customer_phone: normalizedPhone },
                        { customer_phone: phone }
                    ]
                },
                attributes: ['id', 'name', 'customer_name', 'customer_phone']
            });

            if (!estimate) {
                logger.warn(`No estimate found for phone number: ${phone}`);
                return res.status(404).json({
                    success: false,
                    message: 'No estimate found for this phone number'
                });
            }

            // Buscar el follow-up ticket del estimate
            const ticket = await FollowUpTicket.findOne({
                where: { estimate_id: estimate.id }
            });

            if (!ticket) {
                logger.warn(`No follow-up ticket found for estimate ${estimate.id}`);
                return res.status(404).json({
                    success: false,
                    message: 'No follow-up ticket found for this estimate'
                });
            }

            // Obtener o crear el chat
            let chatId = ticket.chat_id;
            if (!chatId) {
                const newChat = await Chat.create({});
                chatId = newChat.id;
                await ticket.update({ chat_id: chatId });
            }

            // Agregar el mensaje al chat como mensaje del cliente
            const chatMessage = await ChatMessage.create({
                chat_id: chatId,
                sender_type: 'customer',
                sender_name: estimate.customer_name || estimate.name || 'Customer',
                message_text: message,
                metadata: {
                    type: 'incoming_sms',
                    phone_number: phone,
                    received_via: 'quo_webhook',
                    received_at: new Date().toISOString()
                },
                sent_at: new Date()
            });

            // Actualizar chat's updated_at
            await Chat.update(
                { updated_at: new Date() },
                { where: { id: chatId } }
            );

            // Actualizar last_contact_date del ticket
            await ticket.update({
                last_contact_date: new Date()
            });

            // Emitir evento WebSocket para notificar a los clientes conectados
            emitNewMessage(chatId, chatMessage);

            // Emitir actualización del inbox
            await emitInboxUpdateForChat(chatId);

            logger.info(`✅ Added incoming SMS to chat ${chatId} for estimate ${estimate.id}`);

            res.json({
                success: true,
                message: 'SMS received and added to chat',
                data: {
                    chat_id: chatId,
                    message_id: chatMessage.id,
                    estimate_id: estimate.id
                }
            });

        } catch (error) {
            logger.error('Error receiving incoming SMS:', error);
            res.status(500).json({
                success: false,
                message: 'Error processing incoming SMS',
                error: error.message
            });
        }
    }
    /**
     * Obtener todos los chats con historial (inbox)
     */
    async getAllChats(req, res) {
        try {
            const { limit = 50, offset = 0, branchId, salesPersonId } = req.query;
            const { Op } = require('sequelize');
            const { Branch, SalesPerson } = require('../models');

            // Construir where clause para filtros
            const estimateWhere = {};
            if (branchId) {
                estimateWhere.branch_id = parseInt(branchId);
            }
            if (salesPersonId) {
                estimateWhere.sales_person_id = parseInt(salesPersonId);
            }

            // Obtener todos los tickets que tienen chat con mensajes
            const estimateInclude = {
                model: Estimate,
                as: 'estimate',
                attributes: ['id', 'name', 'customer_name', 'customer_phone', 'branch_id', 'sales_person_id'],
                include: [
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: SalesPerson,
                        as: 'salesperson',
                        attributes: ['id', 'name']
                    }
                ]
            };

            // Solo agregar where si hay filtros
            if (Object.keys(estimateWhere).length > 0) {
                estimateInclude.where = estimateWhere;
            }

            const tickets = await FollowUpTicket.findAll({
                where: {
                    chat_id: { [Op.not]: null }
                },
                include: [
                    {
                        model: Chat,
                        as: 'chat',
                        include: [{
                            model: ChatMessage,
                            as: 'messages',
                            attributes: ['id', 'sender_type', 'sender_name', 'message_text', 'sent_at'],
                            separate: true,
                            order: [['sent_at', 'DESC']],
                            limit: 10 // Obtener los últimos 10 mensajes para encontrar el último del cliente
                        }]
                    },
                    estimateInclude
                ],
                order: [[{ model: Chat, as: 'chat' }, 'updated_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            // Obtener el conteo de mensajes NO LEÍDOS (del cliente con read_at null) para cada chat
            const chatIds = tickets
                .filter(t => t.chat_id)
                .map(t => t.chat_id);

            const unreadCounts = await ChatMessage.findAll({
                attributes: [
                    'chat_id',
                    [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
                ],
                where: {
                    chat_id: { [Op.in]: chatIds },
                    sender_type: 'customer', // Solo mensajes del cliente
                    read_at: { [Op.is]: null } // Que no hayan sido leídos
                },
                group: ['chat_id'],
                raw: true
            });

            const unreadCountMap = {};
            unreadCounts.forEach(item => {
                unreadCountMap[item.chat_id] = parseInt(item.count);
            });

            // Formatear los datos para el frontend
            const formattedChats = tickets
                .filter(ticket => ticket.chat && ticket.chat.messages && ticket.chat.messages.length > 0)
                .map(ticket => {
                    const estimate = ticket.estimate;
                    const unreadCount = unreadCountMap[ticket.chat.id] || 0;
                    
                    // Buscar el último mensaje del cliente primero, si no existe, usar el último mensaje en general
                    const allMessages = ticket.chat.messages || [];
                    const lastCustomerMessage = allMessages.find(msg => msg.sender_type === 'customer');
                    const lastMessage = lastCustomerMessage || allMessages[0]; // Fallback al último mensaje en general

                    return {
                        id: ticket.chat.id,
                        ticketId: ticket.id,
                        estimateId: estimate?.id,
                        customerName: estimate?.customer_name || estimate?.name || 'Unknown',
                        customerPhone: estimate?.customer_phone || '',
                        branchId: estimate?.branch_id,
                        branchName: estimate?.branch?.name,
                        salesPersonId: estimate?.sales_person_id,
                        salesPersonName: estimate?.salesperson?.name,
                        lastMessage: {
                            text: lastMessage.message_text,
                            sender: lastMessage.sender_name,
                            senderType: lastMessage.sender_type,
                            sentAt: lastMessage.sent_at
                        },
                        updatedAt: ticket.chat.updated_at,
                        unreadCount: unreadCount
                    };
                })
                // Ordenar: primero los que tienen mensajes no leídos, luego por fecha de actualización
                .sort((a, b) => {
                    // Si uno tiene no leídos y el otro no, el que tiene no leídos va primero
                    if (a.unreadCount > 0 && b.unreadCount === 0) return -1;
                    if (a.unreadCount === 0 && b.unreadCount > 0) return 1;
                    // Si ambos tienen no leídos o ambos no tienen, ordenar por fecha
                    return new Date(b.updatedAt) - new Date(a.updatedAt);
                });

            res.json({
                success: true,
                data: formattedChats,
                total: formattedChats.length
            });

        } catch (error) {
            logger.error('Error getting all chats:', error);
            res.status(500).json({
                success: false,
                message: 'Error getting chats',
                error: error.message
            });
        }
    }

    /**
     * Marcar mensajes como leídos cuando se abre un chat
     */
    async markMessagesAsRead(req, res) {
        try {
            const { chatId } = req.params;

            // Marcar todos los mensajes del cliente como leídos
            await ChatMessage.update(
                { read_at: new Date() },
                {
                    where: {
                        chat_id: chatId,
                        sender_type: 'customer',
                        read_at: null
                    }
                }
            );

            res.json({
                success: true,
                message: 'Messages marked as read'
            });

        } catch (error) {
            logger.error('Error marking messages as read:', error);
            res.status(500).json({
                success: false,
                message: 'Error marking messages as read',
                error: error.message
            });
        }
    }

    /**
     * Limpiar todos los mensajes de un chat
     */
    async clearChat(req, res) {
        try {
            const { chatId } = req.params;

            // Verificar que el chat existe
            const chat = await Chat.findByPk(chatId);
            if (!chat) {
                return res.status(404).json({
                    success: false,
                    message: 'Chat not found'
                });
            }

            // Eliminar todos los mensajes del chat
            const deletedCount = await ChatMessage.destroy({
                where: { chat_id: chatId }
            });

            // Actualizar updated_at del chat
            await Chat.update(
                { updated_at: new Date() },
                { where: { id: chatId } }
            );

            logger.info(`✅ Cleared ${deletedCount} messages from chat ${chatId}`);

            // Emitir actualización del inbox
            await emitInboxUpdateForChat(chatId);

            res.json({
                success: true,
                message: `Chat cleared successfully. ${deletedCount} messages deleted.`,
                deletedCount: deletedCount
            });

        } catch (error) {
            logger.error('Error clearing chat:', error);
            res.status(500).json({
                success: false,
                message: 'Error clearing chat',
                error: error.message
            });
        }
    }
}

/**
 * Helper: Emitir actualización del inbox para un chat específico
 * Función independiente para evitar problemas de contexto
 */
async function emitInboxUpdateForChat(chatId) {
    try {
        const { Op } = require('sequelize');
        const { Branch, SalesPerson } = require('../models');

        // Obtener el ticket y sus relaciones
        const ticket = await FollowUpTicket.findOne({
            where: { chat_id: chatId },
            include: [
                {
                    model: Chat,
                    as: 'chat',
                    include: [{
                        model: ChatMessage,
                        as: 'messages',
                        attributes: ['id', 'sender_type', 'sender_name', 'message_text', 'sent_at'],
                        separate: true,
                        order: [['sent_at', 'DESC']],
                        limit: 10 // Obtener los últimos 10 mensajes para encontrar el último del cliente
                    }]
                },
                {
                    model: Estimate,
                    as: 'estimate',
                    attributes: ['id', 'name', 'customer_name', 'customer_phone', 'branch_id', 'sales_person_id'],
                    include: [
                        {
                            model: Branch,
                            as: 'branch',
                            attributes: ['id', 'name']
                        },
                        {
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ]
        });

        if (!ticket || !ticket.chat || !ticket.estimate) {
            return;
        }

        // Obtener conteo de mensajes no leídos
        const unreadCounts = await ChatMessage.findAll({
            attributes: [
                'chat_id',
                [require('sequelize').fn('COUNT', require('sequelize').col('id')), 'count']
            ],
            where: {
                chat_id: chatId,
                sender_type: 'customer',
                read_at: { [Op.is]: null }
            },
            group: ['chat_id'],
            raw: true
        });

        const unreadCount = unreadCounts.length > 0 ? parseInt(unreadCounts[0].count) : 0;

        // Buscar el último mensaje del cliente primero, si no existe, usar el último mensaje en general
        const allMessages = ticket.chat.messages || [];
        const lastCustomerMessage = allMessages.find(msg => msg.sender_type === 'customer');
        const lastMessage = lastCustomerMessage || allMessages[0];

        if (!lastMessage) {
            return;
        }

        // Formatear datos del chat para el inbox
        const chatData = {
            id: ticket.chat.id,
            ticketId: ticket.id,
            estimateId: ticket.estimate.id,
            customerName: ticket.estimate.customer_name || ticket.estimate.name || 'Unknown',
            customerPhone: ticket.estimate.customer_phone || '',
            branchId: ticket.estimate.branch_id,
            branchName: ticket.estimate.branch?.name,
            salesPersonId: ticket.estimate.sales_person_id,
            salesPersonName: ticket.estimate.salesperson?.name,
            lastMessage: {
                text: lastMessage.message_text,
                sender: lastMessage.sender_name,
                senderType: lastMessage.sender_type,
                sentAt: lastMessage.sent_at
            },
            updatedAt: ticket.chat.updated_at,
            unreadCount: unreadCount
        };

        // Emitir actualización del inbox
        emitInboxUpdate(chatData);
    } catch (error) {
        logger.error('Error emitting inbox update:', error);
        // No fallar si hay error al emitir actualización
    }
}

module.exports = new FollowUpTicketsController();


