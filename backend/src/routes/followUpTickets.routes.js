const express = require('express');
const router = express.Router();
const followUpTicketsController = require('../controllers/followUpTickets.controller');
const { verifyToken } = require('../middleware/auth.middleware');

// Webhook público para recibir mensajes entrantes de QUO (sin autenticación)
router.post('/webhook/incoming-sms', followUpTicketsController.receiveIncomingSms);

// Todas las demás rutas requieren autenticación
router.use(verifyToken);

// GET /api/follow-up-tickets/statuses - Obtener todos los statuses
router.get('/statuses', followUpTicketsController.getAllStatuses);

// GET /api/follow-up-tickets/labels - Obtener todos los labels
router.get('/labels', followUpTicketsController.getAllLabels);

// GET /api/follow-up-tickets/chats - Obtener todos los chats con historial (inbox)
router.get('/chats', followUpTicketsController.getAllChats);

// PUT /api/follow-up-tickets/chat/:chatId/read - Marcar mensajes como leídos
router.put('/chat/:chatId/read', followUpTicketsController.markMessagesAsRead);

// DELETE /api/follow-up-tickets/chat/:chatId/messages - Limpiar todos los mensajes del chat
router.delete('/chat/:chatId/messages', followUpTicketsController.clearChat);

// GET /api/follow-up-tickets/by-estimate/:estimateId - Obtener ticket por estimate_id
router.get('/by-estimate/:estimateId', followUpTicketsController.getTicketByEstimateId);

// PUT /api/follow-up-tickets/:id - Actualizar ticket
router.put('/:id', followUpTicketsController.updateTicket);

// GET /api/follow-up-tickets/:ticketId/chat - Obtener o crear chat
router.get('/:ticketId/chat', followUpTicketsController.getOrCreateChat);

// POST /api/follow-up-tickets/chat/:chatId/messages - Agregar mensaje al chat
router.post('/chat/:chatId/messages', followUpTicketsController.addMessageToChat);

module.exports = router;

