'use strict';

const { Server } = require('socket.io');
const { logger } = require('../utils/logger');

let io = null;

/**
 * Inicializar servidor de Socket.io
 */
function initializeSocket(server) {
    // Configuración de CORS para Socket.io
    const corsConfig = {
        origin: function (origin, callback) {
            // En desarrollo, permitir cualquier origen (incluyendo el proxy de Vite)
            if (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV) {
                callback(null, true);
            } else {
                // En producción, usar lista de orígenes permitidos
                const allowedOrigins = [
                    process.env.FRONTEND_URL,
                    'https://yallaprojects.com'
                ].filter(Boolean);
                
                if (!origin || allowedOrigins.includes(origin)) {
                    callback(null, true);
                } else {
                    callback(new Error('Not allowed by CORS'));
                }
            }
        },
        methods: ['GET', 'POST'],
        credentials: true,
        allowedHeaders: ['Content-Type', 'Authorization']
    };

    io = new Server(server, {
        cors: corsConfig,
        transports: ['websocket', 'polling'],
        allowEIO3: true // Compatibilidad con versiones anteriores
    });

    io.on('connection', (socket) => {
        logger.info(`🔌 Socket connected: ${socket.id}`);

        // Unirse a una sala específica para un chat
        socket.on('join-chat', (chatId) => {
            // Asegurar que chatId sea un número
            const numericChatId = Number(chatId);
            if (isNaN(numericChatId)) {
                logger.warn(`⚠️ Invalid chatId received: ${chatId} (type: ${typeof chatId})`);
                return;
            }
            
            const room = `chat-${numericChatId}`;
            socket.join(room);
            
            // Verificar cuántos clientes hay ahora en la sala
            const roomSockets = io.sockets.adapter.rooms.get(room);
            const clientCount = roomSockets ? roomSockets.size : 0;
            
            logger.info(`👤 Socket ${socket.id} joined room: ${room} (${clientCount} client(s) in room)`);
            
            // Enviar confirmación al cliente
            socket.emit('joined-room', { room, chatId: numericChatId });
        });

        // Salir de una sala
        socket.on('leave-chat', (chatId) => {
            const room = `chat-${chatId}`;
            socket.leave(room);
            logger.info(`👤 Socket ${socket.id} left room: ${room}`);
        });

        socket.on('disconnect', () => {
            logger.info(`🔌 Socket disconnected: ${socket.id}`);
        });
    });

    logger.info('✅ Socket.io server initialized');
    return io;
}

/**
 * Emitir nuevo mensaje a todos los clientes en una sala de chat
 */
function emitNewMessage(chatId, message) {
    if (!io) {
        logger.warn('⚠️ Socket.io not initialized, cannot emit message');
        return;
    }

    const room = `chat-${chatId}`;
    
    // Obtener el número de clientes en la sala
    const roomSockets = io.sockets.adapter.rooms.get(room);
    const clientCount = roomSockets ? roomSockets.size : 0;
    
    logger.info(`📤 Emitting new message to room: ${room}`, { 
        messageId: message.id, 
        clientsInRoom: clientCount,
        sender: message.sender_name,
        textPreview: message.message_text?.substring(0, 50) + '...'
    });
    
    io.to(room).emit('new-message', message);
    
    if (clientCount === 0) {
        logger.warn(`⚠️ No clients in room ${room}, message emitted but may not be received`);
    } else {
        logger.info(`✅ Message emitted to ${clientCount} client(s) in room ${room}`);
    }
}

/**
 * Emitir actualización del inbox a todos los clientes conectados
 * Esto actualiza la lista de chats cuando hay un nuevo mensaje
 */
function emitInboxUpdate(chatData) {
    if (!io) {
        logger.warn('⚠️ Socket.io not initialized, cannot emit inbox update');
        return;
    }

    const connectedClients = io.sockets.sockets.size;
    
    logger.info(`📬 Emitting inbox update for chat ${chatData.id}`, { 
        chatId: chatData.id,
        connectedClients: connectedClients,
        lastMessagePreview: chatData.lastMessage?.text?.substring(0, 50) + '...'
    });
    
    // Emitir a todos los clientes conectados (no solo a una sala específica)
    io.emit('inbox-update', chatData);
    
    logger.info(`✅ Inbox update emitted to ${connectedClients} connected client(s)`);
}

/**
 * Obtener instancia de io
 */
function getIO() {
    if (!io) {
        throw new Error('Socket.io not initialized. Call initializeSocket first.');
    }
    return io;
}

module.exports = {
    initializeSocket,
    emitNewMessage,
    emitInboxUpdate,
    getIO
};

