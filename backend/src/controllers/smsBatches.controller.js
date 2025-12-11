'use strict';

const { SmsBatch, SmsBatchEstimate, Estimate, User, SalesPerson, Branch, EstimateStatus, PaymentMethod, BranchConfiguration, MultiplierRange, FollowUpTicket, Chat, ChatMessage } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');
const axios = require('axios');

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

/**
 * Calcula los pricing factors para un estimate
 */
const calculatePricingFactors = async (estimate) => {
    try {
        if (!estimate.price) {
            return {
                calculated_multiplier: null,
                payment_method_factor: null,
                sub_multiplier: null
            };
        }

        const trueCost = parseFloat(estimate.price);
        let calculatedMultiplier = null;
        let subMultiplier = null;

        // PRIORIDAD 1: Usar snapshot_multiplier_ranges si existe
        if (estimate.snapshot_multiplier_ranges && Array.isArray(estimate.snapshot_multiplier_ranges)) {
            const sortedRanges = estimate.snapshot_multiplier_ranges.sort((a, b) => a.minCost - b.minCost);
            
            for (const range of sortedRanges) {
                const minCost = parseFloat(range.minCost);
                const maxCost = range.maxCost ? parseFloat(range.maxCost) : Infinity;
                
                if (trueCost >= minCost && trueCost <= maxCost) {
                    calculatedMultiplier = parseFloat(range.lowestMultiple);
                    break;
                }
            }
        }

        // PRIORIDAD 2: Si no hay snapshot, usar la configuración actual del branch
        if (calculatedMultiplier === null && estimate.branch_id) {
            const branch = await Branch.findByPk(estimate.branch_id, {
                include: [{
                    model: BranchConfiguration,
                    as: 'configuration',
                    include: [{
                        model: MultiplierRange,
                        as: 'multiplierRanges'
                    }]
                }]
            });

            if (branch && branch.configuration) {
                const config = branch.configuration;
                
                if (config.multiplierRanges && config.multiplierRanges.length > 0) {
                    const sortedRanges = config.multiplierRanges.sort((a, b) => a.min_cost - b.min_cost);
                    
                    for (const range of sortedRanges) {
                        const minCost = parseFloat(range.min_cost);
                        const maxCost = range.max_cost ? parseFloat(range.max_cost) : Infinity;
                        
                        if (trueCost >= minCost && trueCost <= maxCost) {
                            calculatedMultiplier = parseFloat(range.lowest_multiple);
                            break;
                        }
                    }
                }

                subMultiplier = config.sub_multiplier || null;
            }
        }

        // PM factor siempre es 1.065 por ahora
        const paymentMethodFactor = 1.065;

        return {
            calculated_multiplier: calculatedMultiplier,
            payment_method_factor: paymentMethodFactor,
            sub_multiplier: subMultiplier
        };
    } catch (error) {
        logger.error('Error calculating pricing factors:', error);
        return {
            calculated_multiplier: null,
            payment_method_factor: null,
            sub_multiplier: null
        };
    }
};

class SmsBatchesController {
    
    /**
     * Listar todos los batches
     */
    async getAllBatches(req, res) {
        try {
            const { page = 1, limit = 10, status, search } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (status) whereClause.status = status;
            if (search) {
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${search}%` } },
                    { description: { [Op.iLike]: `%${search}%` } }
                ];
            }

            const batches = await SmsBatch.findAndCountAll({
                where: whereClause,
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'email'] }
                ],
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });

            res.json({
                success: true,
                data: batches.rows,
                total: batches.count,
                pages: Math.ceil(batches.count / limit),
                currentPage: parseInt(page)
            });

        } catch (error) {
            logger.error('Error fetching SMS batches:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching SMS batches',
                error: error.message
            });
        }
    }

    /**
     * Obtener un batch por ID con sus estimates
     */
    async getBatchById(req, res) {
        try {
            const { id } = req.params;

            const batch = await SmsBatch.findByPk(id, {
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'email'] },
                    {
                        model: Estimate,
                        as: 'estimates',
                        attributes: ['id', 'name', 'customer_name', 'final_price', 'discount', 'price', 'retail_cost', 'sub_service_retail_cost', 'total_tax_amount', 'total_tax_rate', 'price_after_taxes', 'attic_tech_hours', 'at_created_date', 'at_updated_date', 'payment_method_id', 'branch_id', 'snapshot_multiplier_ranges'],
                        include: [
                            { model: SalesPerson, as: 'SalesPerson', attributes: ['name'] },
                            { 
                                model: Branch, 
                                as: 'Branch', 
                                attributes: ['name', 'id'],
                                include: [{
                                    model: BranchConfiguration,
                                    as: 'configuration',
                                    include: [{
                                        model: MultiplierRange,
                                        as: 'multiplierRanges'
                                    }]
                                }]
                            },
                            { model: EstimateStatus, as: 'EstimateStatus', attributes: ['name'] },
                            { model: PaymentMethod, as: 'PaymentMethod', attributes: ['name'] }
                        ],
                        through: {
                            attributes: ['status', 'added_at', 'sent_at', 'error_message']
                        }
                    }
                ]
            });

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'SMS batch not found'
                });
            }

            // Calcular pricing factors para cada estimate
            if (batch.estimates && batch.estimates.length > 0) {
                const estimatesWithFactors = await Promise.all(
                    batch.estimates.map(async (estimate) => {
                        const plainEstimate = estimate.get ? estimate.get({ plain: true }) : estimate;
                        const pricingFactors = await calculatePricingFactors(plainEstimate);
                        return {
                            ...plainEstimate,
                            ...pricingFactors
                        };
                    })
                );
                batch.estimates = estimatesWithFactors;
            }

            res.json({
                success: true,
                data: batch
            });

        } catch (error) {
            logger.error('Error fetching SMS batch:', error);
            res.status(500).json({
                success: false,
                message: 'Error fetching SMS batch',
                error: error.message
            });
        }
    }

    /**
     * Crear batch desde filtros
     */
    async createBatchFromFilters(req, res) {
        try {
            const { name, description, filters } = req.body;
            const userId = req.user?.id;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Batch name is required'
                });
            }

            // Buscar estimates según filtros
            const whereClause = {};
            
            // Filtro por status "Lost"
            const lostStatus = await EstimateStatus.findOne({ where: { name: 'Lost' } });
            if (lostStatus) {
                whereClause.status_id = lostStatus.id;
            }

            // Aplicar filtros
            if (filters) {
                if (filters.priceMin || filters.priceMax) {
                    whereClause.price = {};
                    if (filters.priceMin) whereClause.price[Op.gte] = parseFloat(filters.priceMin);
                    if (filters.priceMax) whereClause.price[Op.lte] = parseFloat(filters.priceMax);
                }
                if (filters.startDate) {
                    whereClause.at_updated_date = {
                        [Op.gte]: new Date(filters.startDate)
                    };
                }
                if (filters.endDate) {
                    if (whereClause.at_updated_date) {
                        whereClause.at_updated_date[Op.lte] = new Date(filters.endDate + 'T23:59:59.999Z');
                    } else {
                        whereClause.at_updated_date = {
                            [Op.lte]: new Date(filters.endDate + 'T23:59:59.999Z')
                        };
                    }
                }
                if (filters.branch) whereClause.branch_id = parseInt(filters.branch);
                if (filters.salesperson) whereClause.sales_person_id = parseInt(filters.salesperson);
            }

            // Buscar estimates
            const estimates = await Estimate.findAll({
                where: whereClause,
                attributes: ['id']
            });

            if (estimates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No estimates found matching the filters'
                });
            }

            // Crear batch
            const batch = await SmsBatch.create({
                name,
                description,
                created_by: userId,
                status: 'draft',
                metadata: filters || {}
            });

            // Agregar estimates al batch
            const batchEstimates = estimates.map(est => ({
                batch_id: batch.id,
                estimate_id: est.id,
                status: 'pending'
            }));

            await SmsBatchEstimate.bulkCreate(batchEstimates);

            // Reload con includes
            const createdBatch = await SmsBatch.findByPk(batch.id, {
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'email'] }
                ]
            });

            logger.info(`✅ Created SMS batch: ${name} with ${estimates.length} estimates`);

            res.json({
                success: true,
                data: createdBatch,
                message: `Batch created with ${estimates.length} estimates`
            });

        } catch (error) {
            logger.error('Error creating SMS batch from filters:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating SMS batch',
                error: error.message
            });
        }
    }

    /**
     * Crear batch desde selección manual de estimates
     */
    async createBatchFromSelection(req, res) {
        try {
            const { name, description, estimateIds } = req.body;
            const userId = req.user?.id;

            if (!name) {
                return res.status(400).json({
                    success: false,
                    message: 'Batch name is required'
                });
            }

            if (!estimateIds || !Array.isArray(estimateIds) || estimateIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one estimate ID is required'
                });
            }

            // Verificar que los estimates existen
            const estimates = await Estimate.findAll({
                where: { id: { [Op.in]: estimateIds } },
                attributes: ['id']
            });

            if (estimates.length !== estimateIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Some estimate IDs are invalid'
                });
            }

            // Crear batch
            const batch = await SmsBatch.create({
                name,
                description,
                created_by: userId,
                status: 'draft',
                metadata: { selectionType: 'manual', estimateIds }
            });

            // Agregar estimates al batch
            const batchEstimates = estimateIds.map(estId => ({
                batch_id: batch.id,
                estimate_id: estId,
                status: 'pending'
            }));

            await SmsBatchEstimate.bulkCreate(batchEstimates);

            // Reload con includes
            const createdBatch = await SmsBatch.findByPk(batch.id, {
                include: [
                    { model: User, as: 'creator', attributes: ['id', 'email'] }
                ]
            });

            logger.info(`✅ Created SMS batch: ${name} with ${estimateIds.length} estimates`);

            res.json({
                success: true,
                data: createdBatch,
                message: `Batch created with ${estimateIds.length} estimates`
            });

        } catch (error) {
            logger.error('Error creating SMS batch from selection:', error);
            res.status(500).json({
                success: false,
                message: 'Error creating SMS batch',
                error: error.message
            });
        }
    }

    /**
     * Actualizar batch
     */
    async updateBatch(req, res) {
        try {
            const { id } = req.params;
            const { name, description, status } = req.body;

            const batch = await SmsBatch.findByPk(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'SMS batch not found'
                });
            }

            const updates = {};
            if (name !== undefined) updates.name = name;
            if (description !== undefined) updates.description = description;
            if (status !== undefined) updates.status = status;

            await batch.update(updates);

            logger.info(`✅ Updated SMS batch: ${id}`);

            res.json({
                success: true,
                data: batch,
                message: 'Batch updated successfully'
            });

        } catch (error) {
            logger.error('Error updating SMS batch:', error);
            res.status(500).json({
                success: false,
                message: 'Error updating SMS batch',
                error: error.message
            });
        }
    }

    /**
     * Eliminar batch
     */
    async deleteBatch(req, res) {
        try {
            const { id } = req.params;

            const batch = await SmsBatch.findByPk(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'SMS batch not found'
                });
            }

            await batch.destroy();

            logger.info(`✅ Deleted SMS batch: ${id}`);

            res.json({
                success: true,
                message: 'Batch deleted successfully'
            });

        } catch (error) {
            logger.error('Error deleting SMS batch:', error);
            res.status(500).json({
                success: false,
                message: 'Error deleting SMS batch',
                error: error.message
            });
        }
    }

    /**
     * Agregar estimates a un batch existente
     */
    async addEstimatesToBatch(req, res) {
        try {
            const { id } = req.params;
            const { estimateIds } = req.body;

            if (!estimateIds || !Array.isArray(estimateIds) || estimateIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'At least one estimate ID is required'
                });
            }

            const batch = await SmsBatch.findByPk(id);

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'SMS batch not found'
                });
            }

            // Verificar que los estimates existen y no están ya en el batch
            const existing = await SmsBatchEstimate.findAll({
                where: {
                    batch_id: id,
                    estimate_id: { [Op.in]: estimateIds }
                },
                attributes: ['estimate_id']
            });

            const existingIds = existing.map(e => e.estimate_id);
            const newIds = estimateIds.filter(id => !existingIds.includes(id));

            if (newIds.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'All estimates are already in the batch'
                });
            }

            // Agregar nuevos estimates
            const batchEstimates = newIds.map(estId => ({
                batch_id: id,
                estimate_id: estId,
                status: 'pending'
            }));

            await SmsBatchEstimate.bulkCreate(batchEstimates);

            logger.info(`✅ Added ${newIds.length} estimates to batch: ${id}`);

            res.json({
                success: true,
                message: `Added ${newIds.length} estimates to batch`,
                added: newIds.length,
                skipped: existingIds.length
            });

        } catch (error) {
            logger.error('Error adding estimates to batch:', error);
            res.status(500).json({
                success: false,
                message: 'Error adding estimates to batch',
                error: error.message
            });
        }
    }

    /**
     * Remover estimate de un batch
     */
    async removeEstimateFromBatch(req, res) {
        try {
            const { id, estimateId } = req.params;

            const result = await SmsBatchEstimate.destroy({
                where: {
                    batch_id: id,
                    estimate_id: estimateId
                }
            });

            if (result === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'Estimate not found in batch'
                });
            }

            logger.info(`✅ Removed estimate ${estimateId} from batch ${id}`);

            res.json({
                success: true,
                message: 'Estimate removed from batch'
            });

        } catch (error) {
            logger.error('Error removing estimate from batch:', error);
            res.status(500).json({
                success: false,
                message: 'Error removing estimate from batch',
                error: error.message
            });
        }
    }

    /**
     * Enviar batch de SMS a QUO vía webhook
     */
    async sendBatchToQuo(req, res) {
        try {
            const { id } = req.params;
            const { message } = req.body;

            if (!message || !message.trim()) {
                return res.status(400).json({
                    success: false,
                    message: 'Message content is required'
                });
            }

            // Obtener el batch con sus estimates
            const batch = await SmsBatch.findByPk(id, {
                include: [
                    {
                        model: Estimate,
                        as: 'estimates',
                        attributes: ['id', 'name', 'customer_name', 'customer_phone', 'final_price', 'discount', 'price', 'retail_cost', 'sub_service_retail_cost', 'branch_id', 'snapshot_multiplier_ranges'],
                        include: [
                            { model: SalesPerson, as: 'SalesPerson', attributes: ['name'] },
                            { 
                                model: Branch, 
                                as: 'Branch', 
                                attributes: ['name', 'id'],
                                include: [{
                                    model: BranchConfiguration,
                                    as: 'configuration',
                                    include: [{
                                        model: MultiplierRange,
                                        as: 'multiplierRanges'
                                    }]
                                }]
                            },
                            { model: EstimateStatus, as: 'EstimateStatus', attributes: ['name'] },
                            { model: PaymentMethod, as: 'PaymentMethod', attributes: ['name'] }
                        ],
                        through: {
                            attributes: ['status', 'added_at', 'sent_at', 'error_message']
                        }
                    }
                ]
            });

            if (!batch) {
                return res.status(404).json({
                    success: false,
                    message: 'SMS batch not found'
                });
            }

            if (!batch.estimates || batch.estimates.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Batch has no estimates'
                });
            }

            // Obtener URL del webhook desde variables de entorno
            const webhookUrl = process.env.QUO_SMS_WEBHOOK_URL;
            
            if (!webhookUrl) {
                return res.status(500).json({
                    success: false,
                    message: 'QUO SMS webhook URL not configured. Please set QUO_SMS_WEBHOOK_URL in .env file.'
                });
            }

            // Calcular pricing factors para cada estimate
            const estimatesWithFactors = await Promise.all(
                batch.estimates.map(async (estimate) => {
                    const plainEstimate = estimate.get ? estimate.get({ plain: true }) : estimate;
                    const pricingFactors = await calculatePricingFactors(plainEstimate);
                    return {
                        ...plainEstimate,
                        ...pricingFactors
                    };
                })
            );

            // Renderizar mensajes para cada estimate
            const messages = estimatesWithFactors.map((estimate) => {
                // Extraer nombre del cliente
                const estimateName = estimate.name || '';
                let customerName = estimate.customer_name;
                if (!customerName || customerName.trim() === '') {
                    customerName = estimateName.split(' - ')[0] || estimateName;
                }

                // Dividir en first_name y last_name
                const trimmedName = customerName.trim();
                const firstSpaceIndex = trimmedName.indexOf(' ');
                const firstName = firstSpaceIndex > 0 
                    ? trimmedName.substring(0, firstSpaceIndex) 
                    : trimmedName || 'Customer';
                const lastName = firstSpaceIndex > 0 
                    ? trimmedName.substring(firstSpaceIndex + 1).trim() 
                    : '';

                // Renderizar template
                let renderedMessage = message;
                renderedMessage = renderedMessage.replace(/\{\{first_name\}\}/g, firstName);
                renderedMessage = renderedMessage.replace(/\{\{last_name\}\}/g, lastName);
                renderedMessage = renderedMessage.replace(/\{\{customer_name\}\}/g, customerName);
                renderedMessage = renderedMessage.replace(/\{\{estimate_name\}\}/g, estimateName);
                renderedMessage = renderedMessage.replace(/\{\{final_price\}\}/g, estimate.final_price ? `$${Number(estimate.final_price).toFixed(2)}` : 'N/A');
                renderedMessage = renderedMessage.replace(/\{\{branch_name\}\}/g, estimate.Branch?.name || 'N/A');
                renderedMessage = renderedMessage.replace(/\{\{salesperson_name\}\}/g, estimate.SalesPerson?.name || 'N/A');
                renderedMessage = renderedMessage.replace(/\{\{discount\}\}/g, estimate.discount ? `${estimate.discount}%` : '0%');

                // Normalizar número de teléfono al formato +1xxxxxxxxxx
                const normalizedPhone = normalizePhoneNumber(estimate.customer_phone);
                
                if (!normalizedPhone) {
                    logger.warn(`⚠️ Skipping estimate ${estimate.id} - invalid phone number: ${estimate.customer_phone}`);
                    return null;
                }

                return {
                    estimate_id: estimate.id,
                    phone_number: normalizedPhone,
                    message: renderedMessage,
                    customer_name: customerName,
                    first_name: firstName,
                    last_name: lastName
                };
            }).filter(msg => msg !== null && msg.phone_number && msg.phone_number.trim() !== ''); // Filtrar estimates sin teléfono válido

            if (messages.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No estimates with valid phone numbers found'
                });
            }

            // Preparar payload para Make.com/QUO
            // Make.com necesita el array envuelto en un objeto para evitar que el iterator lo procese uno por uno
            // Formato: { messages: [{phone, message}, ...] }
            const messagesArray = messages.map(msg => ({
                phone: msg.phone_number,
                message: msg.message
            }));
            
            // Asegurar que es un array con todos los mensajes
            if (!Array.isArray(messagesArray) || messagesArray.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No valid messages to send'
                });
            }
            
            // Envolver en un objeto para que Make.com reciba todos los mensajes juntos
            // Si el webhook está configurado con iterator, esto evitará que procese uno por uno
            const payload = {
                messages: messagesArray
            };

            // Headers para el webhook
            const headers = {
                'Content-Type': 'application/json'
            };

            // Enviar webhook a Make.com (que luego lo pasa a QUO)
            logger.info(`📤 Sending SMS batch ${batch.id} to Make.com webhook`);
            logger.info(`📤 Webhook URL: ${webhookUrl}`);
            logger.info(`📤 Payload (${messagesArray.length} messages): ${JSON.stringify(payload, null, 2)}`);
            
            let webhookResponse;
            try {
                webhookResponse = await axios.post(
                    webhookUrl,
                    payload,
                    {
                        headers,
                        timeout: 30000 // 30 segundos
                    }
                );
                
                logger.info(`✅ Webhook response status: ${webhookResponse.status}`);
                logger.info(`✅ Webhook response data: ${JSON.stringify(webhookResponse.data, null, 2)}`);
            } catch (webhookError) {
                logger.error(`❌ Webhook request failed:`, {
                    message: webhookError.message,
                    status: webhookError.response?.status,
                    statusText: webhookError.response?.statusText,
                    data: webhookError.response?.data,
                    url: webhookUrl,
                    payloadLength: payload.length
                });
                throw webhookError;
            }

            // Actualizar batch status
            await batch.update({
                status: 'sent',
                sent_count: messages.length,
                updated_at: new Date()
            });

            // Actualizar status de cada estimate en el batch
            await SmsBatchEstimate.update(
                {
                    status: 'sent',
                    sent_at: new Date()
                },
                {
                    where: {
                        batch_id: batch.id,
                        estimate_id: { [Op.in]: messages.map(m => m.estimate_id) }
                    }
                }
            );

            // Agregar mensajes al chat de cada follow-up ticket
            for (const msg of messages) {
                try {
                    // Buscar el follow-up ticket del estimate
                    const followUpTicket = await FollowUpTicket.findOne({
                        where: { estimate_id: msg.estimate_id }
                    });

                    if (followUpTicket) {
                        // Obtener o crear el chat
                        let chatId = followUpTicket.chat_id;
                        if (!chatId) {
                            const newChat = await Chat.create({});
                            chatId = newChat.id;
                            await followUpTicket.update({ chat_id: chatId });
                        }

                        // Agregar el mensaje SMS al chat
                        await ChatMessage.create({
                            chat_id: chatId,
                            sender_type: 'agent',
                            sender_name: 'SMS Campaign',
                            message_text: `📱 SMS Sent: ${msg.message}`,
                            metadata: {
                                type: 'sms',
                                phone_number: msg.phone_number,
                                batch_id: batch.id,
                                sent_via: 'batch'
                            },
                            sent_at: new Date()
                        });

                        // Actualizar last_contact_date del ticket
                        await followUpTicket.update({
                            last_contact_date: new Date()
                        });

                        logger.info(`✅ Added SMS message to chat for estimate ${msg.estimate_id}`);
                    }
                } catch (chatError) {
                    // No fallar el proceso si hay error al agregar al chat
                    logger.error(`Error adding SMS to chat for estimate ${msg.estimate_id}:`, chatError);
                }
            }

            logger.info(`✅ Successfully sent batch ${batch.id} to Make.com webhook`);

            res.json({
                success: true,
                message: `Successfully sent ${messages.length} messages to Make.com webhook`,
                data: {
                    batch_id: batch.id,
                    total_sent: messages.length,
                    webhook_response: webhookResponse.data
                }
            });

        } catch (error) {
            logger.error('Error sending batch to QUO:', error);
            
            // Si es error de axios, incluir más detalles
            if (error.response) {
                return res.status(error.response.status || 500).json({
                    success: false,
                    message: 'Error sending to webhook',
                    error: error.response.data || error.message,
                    status: error.response.status
                });
            }

            res.status(500).json({
                success: false,
                message: 'Error sending batch to QUO',
                error: error.message
            });
        }
    }
}

module.exports = new SmsBatchesController();

