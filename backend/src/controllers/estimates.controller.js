const { Op } = require('sequelize');
const { Estimate, SalesPerson, Branch, EstimateStatus, Job, SalesPersonBranch, PaymentMethod, BranchConfiguration, MultiplierRange, FollowUpTicket, FollowUpStatus } = require('../models');
const https = require('https');
const XLSX = require('xlsx');
const { findOrCreateBranch: branchHelperFindOrCreate } = require('../utils/branchHelper');
const { logger } = require('../utils/logger');
const { calculateWashingtonTaxes } = require('../utils/taxCalculator');

/**
 * Calcula el multiplier correcto basado en el true cost y los multiplier ranges del branch
 * Usa el snapshot del estimate si está disponible, sino consulta la configuración actual
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

        // PRIORIDAD 1: Usar snapshot_multiplier_ranges si existe (datos históricos correctos)
        if (estimate.snapshot_multiplier_ranges && Array.isArray(estimate.snapshot_multiplier_ranges)) {
            const sortedRanges = estimate.snapshot_multiplier_ranges.sort((a, b) => a.minCost - b.minCost);
            
            for (const range of sortedRanges) {
                const minCost = parseFloat(range.minCost);
                const maxCost = range.maxCost ? parseFloat(range.maxCost) : Infinity;
                
                if (trueCost >= minCost && trueCost <= maxCost) {
                    calculatedMultiplier = parseFloat(range.lowestMultiple);
                    logger.info(`✅ Using snapshot multiplier: ${calculatedMultiplier}x for cost $${trueCost} (from ${range.name})`);
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
                            logger.info(`⚠️  Using current multiplier (no snapshot): ${calculatedMultiplier}x for cost $${trueCost}`);
                            break;
                        }
                    }
                }

                // Sub multiplier de la configuración
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

// Función para transformar la estructura de los datos para el frontend
const transformEstimateForFrontend = async (estimate) => {
    const plainEstimate = estimate.get({ plain: true });
    
    // Calcular los factores de pricing
    const pricingFactors = await calculatePricingFactors(plainEstimate);
    
    // Los aliases ya están correctos después de get({ plain: true })
    // Solo necesitamos agregar los factores calculados
    return {
        ...plainEstimate,
        ...pricingFactors
    };
};


class EstimatesController {
    
    // Obtener todos los estimates con filtros y paginación
    async getAllEstimates(req, res) {
        try {
            const { page = 1, limit = 10, status, branch, salesperson, startDate, endDate, sort_by, sort_order, search } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (status) whereClause.status_id = status;
            if (branch) whereClause.branch_id = branch;
            if (salesperson) whereClause.sales_person_id = salesperson;
            
            // Para la búsqueda, usaremos include con where en lugar de whereClause
            const includeClause = [
                { model: SalesPerson, as: 'salesperson', attributes: ['name'] },
                { model: Branch, as: 'branch', attributes: ['name'] },
                { model: EstimateStatus, as: 'status', attributes: ['name'] },
                { model: PaymentMethod, as: 'PaymentMethod', attributes: ['id', 'name'] }
            ];

            // Agregar búsqueda por texto
            if (search && search.trim()) {
                const searchTerm = search.trim();
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${searchTerm}%` } },
                    { customer_name: { [Op.iLike]: `%${searchTerm}%` } },
                    { '$salesperson.name$': { [Op.iLike]: `%${searchTerm}%` } },
                    { '$branch.name$': { [Op.iLike]: `%${searchTerm}%` } }
                ];
            }
            
            // Agregar filtros de fecha (usando AT updated date en lugar de created date)
            if (startDate) {
                whereClause.at_updated_date = {
                    [Op.gte]: new Date(startDate)
                };
            }
            if (endDate) {
                if (whereClause.at_updated_date) {
                    whereClause.at_updated_date[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
                } else {
                    whereClause.at_updated_date = {
                        [Op.lte]: new Date(endDate + 'T23:59:59.999Z')
                    };
                }
            }


            const orderClause = [];
            if (sort_by) {
                orderClause.push([sort_by, sort_order === 'desc' ? 'DESC' : 'ASC']);
            }

            // Log de los filtros aplicados
            console.log('🔍 Estimates Controller - Filtros aplicados:', {
                query: req.query,
                whereClause: whereClause,
                startDate: startDate,
                endDate: endDate
            });

            const estimates = await Estimate.findAndCountAll({
                where: whereClause,
                include: includeClause,
                limit: parseInt(limit),
                offset: offset,
                order: orderClause
            });

            const transformedData = await Promise.all(
                estimates.rows.map(e => transformEstimateForFrontend(e))
            );

            res.json({
                total: estimates.count,
                pages: Math.ceil(estimates.count / limit),
                currentPage: parseInt(page),
                data: transformedData
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching estimates', error: error.message });
        }
    }

    // Obtener detalles de un estimate específico
    async getEstimateDetails(req, res) {
        try {
            const estimate = await Estimate.findByPk(req.params.id, {
                include: [
                    { model: SalesPerson, as: 'SalesPerson' },
                    { model: Branch, as: 'Branch' },
                    { model: EstimateStatus, as: 'EstimateStatus' },
                    { model: PaymentMethod, as: 'PaymentMethod' }
                ]
            });

            if (!estimate) {
                return res.status(404).json({ message: 'Estimate not found' });
            }
            
            const transformedEstimate = await transformEstimateForFrontend(estimate);
            
            // Incluir job relacionado si existe
            const job = await Job.findOne({ where: { estimate_id: estimate.id }, attributes: ['id', 'name', 'branch_id'] });
            if (job) {
                transformedEstimate.job = { id: job.id, name: job.name };
            }
            
            res.json(transformedEstimate);

        } catch (error) {
            logger.error('Error fetching estimate details:', error);
            res.status(500).json({ message: 'Error fetching estimate details', error: error.message });
        }
    }

    /**
     * Obtener lost estimates para el módulo de follow-ups
     * Optimizado para mostrar información relevante para re-engagement
     */
    async getLostEstimates(req, res) {
        try {
            const { page = 1, limit = 10, branch, salesperson, startDate, endDate, search } = req.query;
            const offset = (page - 1) * limit;

            // Buscar el status "Lost"
            const lostStatus = await EstimateStatus.findOne({ where: { name: 'Lost' } });
            if (!lostStatus) {
                return res.status(404).json({ message: 'Status "Lost" not found' });
            }

            const whereClause = {
                status_id: lostStatus.id // Solo lost estimates
            };

            // Filtros adicionales
            if (branch) whereClause.branch_id = branch;
            if (salesperson) whereClause.sales_person_id = salesperson;

            // Incluir relaciones (usando aliases correctos definidos en el modelo)
            const includeClause = [
                { model: SalesPerson, as: 'SalesPerson', attributes: ['name'] }, // SalesPerson no tiene 'email'
                { model: Branch, as: 'Branch', attributes: ['name'] },
                { model: EstimateStatus, as: 'EstimateStatus', attributes: ['name'] },
                { model: PaymentMethod, as: 'PaymentMethod', attributes: ['id', 'name'] }
            ];

            // Búsqueda por texto (actualizar alias en búsqueda)
            if (search && search.trim()) {
                const searchTerm = search.trim();
                whereClause[Op.or] = [
                    { name: { [Op.iLike]: `%${searchTerm}%` } },
                    { customer_name: { [Op.iLike]: `%${searchTerm}%` } },
                    { '$SalesPerson.name$': { [Op.iLike]: `%${searchTerm}%` } },
                    { '$Branch.name$': { [Op.iLike]: `%${searchTerm}%` } }
                ];
            }

            // Filtros de fecha (usando at_updated_date)
            if (startDate) {
                whereClause.at_updated_date = {
                    [Op.gte]: new Date(startDate)
                };
            }
            if (endDate) {
                if (whereClause.at_updated_date) {
                    whereClause.at_updated_date[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
                } else {
                    whereClause.at_updated_date = {
                        [Op.lte]: new Date(endDate + 'T23:59:59.999Z')
                    };
                }
            }

            // Ordenar por fecha de actualización descendente (más recientes primero)
            const orderClause = [['at_updated_date', 'DESC']];

            console.log('🔍 Lost Estimates - Filtros aplicados:', {
                query: req.query,
                whereClause: whereClause
            });

            const estimates = await Estimate.findAndCountAll({
                where: whereClause,
                include: includeClause,
                limit: parseInt(limit),
                offset: offset,
                order: orderClause
            });

            // Debug: Log first estimate to check associations
            if (estimates.rows.length > 0) {
                const firstEstimate = estimates.rows[0].get({ plain: true });
                console.log('🔍 Debug - First estimate structure:', {
                    id: firstEstimate.id,
                    name: firstEstimate.name,
                    hasSalesPerson: !!firstEstimate.SalesPerson,
                    hasBranch: !!firstEstimate.Branch,
                    salesPersonName: firstEstimate.SalesPerson?.name,
                    branchName: firstEstimate.Branch?.name
                });
            }

            const transformedData = await Promise.all(
                estimates.rows.map(e => transformEstimateForFrontend(e))
            );

            res.json({
                total: estimates.count,
                pages: Math.ceil(estimates.count / limit),
                currentPage: parseInt(page),
                data: transformedData
            });

        } catch (error) {
            console.error('Error fetching lost estimates:', error);
            res.status(500).json({ message: 'Error fetching lost estimates', error: error.message });
        }
    }

    async getSoldEstimates(req, res) {
        try {
            const soldStatus = await EstimateStatus.findOne({ where: { name: 'Sold' } });
            if (!soldStatus) {
                return res.status(404).json({ message: 'Status "Sold" not found' });
            }

            // Obtener todos los IDs de los estimates que ya están en uso
            const usedEstimateIds = await Job.findAll({
                attributes: ['estimate_id'],
                where: {
                    estimate_id: { [Op.ne]: null }
                },
                raw: true
            }).then(jobs => jobs.map(job => job.estimate_id));

            const estimates = await Estimate.findAll({
                where: {
                    status_id: soldStatus.id,
                    id: { [Op.notIn]: usedEstimateIds } // Excluir los IDs en uso
                },
                include: [
                    { model: SalesPerson, as: 'salesperson', attributes: ['name'] },
                    { model: Branch, as: 'branch', attributes: ['name'] }
                ],
                order: [['at_created_date', 'DESC']]
            });

            const transformedData = estimates.map(transformEstimateForFrontend);
            res.json(transformedData);
        } catch (error) {
            res.status(500).json({ message: 'Error fetching sold estimates', error: error.message });
        }
    }

    // Nueva función para sync manual desde el frontend
    async syncEstimatesManual(req, res) {
        const logMessages = [];
        
        // Log de los parámetros recibidos
        console.log('🔍 Estimates Controller - Parámetros recibidos:', {
            body: req.body,
            hasBodyParams: Object.keys(req.body || {}).length > 0,
            startDateInBody: req.body?.startDate,
            endDateInBody: req.body?.endDate,
            bodyKeys: Object.keys(req.body || {})
        });
        
        logMessages.push('🚀 Starting manual synchronization...');

        try {
            // Login a Attic Tech
            logMessages.push('🔑 Logging into Attic Tech...');
            const apiKey = await this.loginToAtticTech(logMessages);

            // Usar parámetros del frontend o valores por defecto
            let startDate = new Date();
            startDate.setDate(startDate.getDate() - 45); // Últimos 45 días
            startDate = startDate.toISOString().split('T')[0];
            
            // Fecha de fin por defecto: MAÑANA (+1 día para asegurar que capturamos todo)
            let endDate = new Date();
            endDate.setDate(endDate.getDate() + 1); // Agregar 1 día
            endDate = endDate.toISOString().split('T')[0];
            
            // Si hay parámetros en el body, usarlos
            if (req.body && Object.keys(req.body).length > 0) {
                if (req.body.startDate) {
                    startDate = req.body.startDate;
                    logMessages.push(`📅 Usando fecha de inicio del frontend: ${startDate}`);
                }
                if (req.body.endDate) {
                    endDate = req.body.endDate;
                    logMessages.push(`📅 Usando fecha de fin del frontend: ${endDate}`);
                }
            }

            logMessages.push(`🔍 Fetching estimates updated between ${startDate} and ${endDate}...`);
            console.log('🔍 Estimates Controller - Fechas que se pasan a fetchAllEstimatesFromAtticTech:', {
                startDate: startDate,
                endDate: endDate,
                startDateType: typeof startDate,
                endDateType: typeof endDate
            });

            const allLeads = await this.fetchAllEstimatesFromAtticTech(apiKey, startDate, endDate, logMessages);

            if (allLeads.length === 0) {
                logMessages.push('✅ No new or updated estimates to process.');
                return res.status(200).json({ 
                    success: true, 
                    message: 'Synchronization finished. No new data.', 
                    log: logMessages 
                });
            }

            logMessages.push('🗺️ Mapping Attic Tech data...');
            const estimatesData = this.mapAtticTechDataToEstimates(allLeads);
            
            logMessages.push('💾 Saving estimates to the database...');
            const { newCount, updatedCount } = await this.saveEstimatesToDb(estimatesData, logMessages);
            
            const summary = `✅ Manual synchronization finished. New: ${newCount}, Updated: ${updatedCount}.`;
            logMessages.push(summary);

            res.status(200).json({ 
                success: true, 
                message: summary, 
                new: newCount, 
                updated: updatedCount, 
                log: logMessages 
            });

        } catch (error) {
            logMessages.push(`❌ Error during synchronization: ${error.message}`);
            console.error('Synchronization failed:', { error: error.message, log: logMessages });
            res.status(500).json({ 
                success: false, 
                message: 'Synchronization failed.', 
                log: logMessages 
            });
        }
    }

    // Funciones helper necesarias para el sync
    async loginToAtticTech(logMessages = []) {
        const email = process.env.ATTIC_TECH_EMAIL;
        const password = process.env.ATTIC_TECH_PASSWORD;
        
        if (!email || !password) {
            throw new Error('ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in environment variables');
        }

        try {
            const loginData = JSON.stringify({ email, password });
            const options = {
                hostname: 'www.attic-tech.com',
                path: '/api/users/login',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(loginData),
                    'User-Agent': 'BotZilla API v2.0'
                }
            };

            const apiKey = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                const json = JSON.parse(data);
                                resolve(json.token);
                            } catch (e) {
                                reject(new Error('Error parsing login response'));
                            }
                        } else {
                            reject(new Error(`Login failed: ${res.statusCode}`));
                        }
                    });
                });
                req.on('error', reject);
                req.write(loginData);
                req.end();
            });

            logMessages.push('✅ Successfully logged in to Attic Tech');
            return apiKey;
        } catch (error) {
            logMessages.push(`❌ Login failed: ${error.message}`);
            throw error;
        }
    }

    async fetchAllEstimatesFromAtticTech(apiKey, fechaInicio, fechaFin, logMessages = []) {
        let allLeads = [];
        let page = 1;
        let hasMore = true;
        const pageSize = 100;

        logMessages.push(`📊 Starting to fetch estimates from ${fechaInicio} to ${fechaFin}`);

        while (hasMore) {
            let queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-createdAt`;
            if (fechaInicio) {
                queryString += `&where[createdAt][greater_than_equal]=${encodeURIComponent(fechaInicio)}`;
            }
            if (fechaFin) {
                queryString += `&where[createdAt][less_than_equal]=${encodeURIComponent(fechaFin + 'T23:59:59.999Z')}`;
            }

            // Log de la query que se está construyendo
            if (page === 1) {
                console.log('🔍 Estimates Controller - Query string construida para Attic Tech API:', {
                    queryString: queryString,
                    fechaInicio: fechaInicio,
                    fechaFin: fechaFin,
                    fechaFinWithTime: fechaFin + 'T23:59:59.999Z',
                    fullUrl: `https://www.attic-tech.com/api/job-estimates?${queryString}`
                });
            }

            const options = {
                hostname: 'www.attic-tech.com',
                path: `/api/job-estimates?${queryString}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${apiKey}`,
                    'Accept': 'application/json',
                    'User-Agent': 'BotZilla API v2.0'
                }
            };

            try {
                const leads = await new Promise((resolve, reject) => {
                    const req = https.request({ ...options, timeout: 300000 }, (resApi) => {
                        let data = '';
                        resApi.on('data', chunk => { data += chunk; });
                        resApi.on('end', () => {
                            if (resApi.statusCode === 200) {
                                try {
                                    const json = JSON.parse(data);
                                    resolve(json.docs || []);
                                    hasMore = page < (json.totalPages || 1);
                                } catch (e) {
                                    reject(new Error('Error parsing Attic Tech API response'));
                                }
                            } else {
                                reject(new Error(`Attic Tech API error: ${resApi.statusCode}`));
                            }
                        });
                    });
                    req.on('error', reject);
                    req.on('timeout', () => {
                        req.destroy();
                        reject(new Error('Request to Attic Tech API timed out (5 minutes)'));
                    });
                    req.end();
                });

                allLeads = allLeads.concat(leads);
                logMessages.push(`📄 Fetched page ${page}: ${leads.length} estimates`);
                
                // Log de las fechas de los primeros estimates para verificar el filtro
                if (page === 1 && leads.length > 0) {
                    console.log('🔍 Estimates Controller - Primeros estimates recibidos de Attic Tech:', {
                        totalEstimates: leads.length,
                        firstEstimate: {
                            id: leads[0].id,
                            name: leads[0].name,
                            createdAt: leads[0].createdAt,
                            updatedAt: leads[0].updatedAt
                        },
                        lastEstimate: {
                            id: leads[leads.length - 1].id,
                            name: leads[leads.length - 1].name,
                            createdAt: leads[leads.length - 1].createdAt,
                            updatedAt: leads[leads.length - 1].updatedAt
                        }
                    });
                }
                
                if (leads.length < pageSize) {
                    hasMore = false;
                } else {
                    page++;
                }
            } catch (error) {
                logMessages.push(`❌ Error fetching page ${page}: ${error.message}`);
                throw error;
            }
        }

        logMessages.push(`✅ Total estimates fetched: ${allLeads.length}`);
        return allLeads;
    }

    mapAtticTechDataToEstimates(leads) {
        return leads.map(lead => {
            const customerName = lead.property?.client?.fullName || lead.client?.fullName || null;
            const customerEmail = lead.property?.client?.email || lead.client?.email || lead.email || lead.contact?.email || null;
            const customerPhone = lead.property?.client?.phone || lead.client?.phone || lead.phone || lead.contact?.phone || lead.property?.client?.phoneNumber || lead.client?.phoneNumber || null;
            
            // Determine the final price based on the branch name
            const branchName = lead.branch?.name?.toLowerCase() || '';
            let finalPrice = lead.final_price;
            if ((branchName.includes('kent') || branchName.includes('everett')) && lead.tax_details?.final_price_after_taxes) {
                finalPrice = lead.tax_details.final_price_after_taxes;
            }

            // Extraer multiplier ranges del snapshot (si existe)
            const snapshotMultiplierRanges = lead.estimateSnapshot?.snapshotData?.multiplierRanges || null;

            return {
                attic_tech_estimate_id: lead.id,
                name: lead.name || 'Unnamed Estimate',
                branchName: lead.branch?.name || null,
                atCreatedDate: lead.createdAt ? new Date(lead.createdAt) : null,
                atUpdatedDate: lead.updatedAt ? new Date(lead.updatedAt) : null,
                status: lead.status || 'pending',
                salespersonName: lead.user?.name || null,
                price: lead.true_cost,
                retail_cost: lead.retail_cost,
                final_price: finalPrice,
                sub_service_retail_cost: lead.sub_services_retail_cost,
                discount: lead.discount_provided,
                attic_tech_hours: lead.labor_hours,
                customer_name: customerName,
                customer_address: lead.property?.address || null,
                customer_email: typeof customerEmail === 'string' ? customerEmail.slice(0, 200).trim() : null,
                customer_phone: typeof customerPhone === 'string' ? customerPhone.replace(/[^0-9+()\-\s]/g, '').slice(0, 50).trim() : null,
                crew_notes: lead.crew_notes,
                payment_method: lead.payment_method || null,
                snapshot_multiplier_ranges: snapshotMultiplierRanges
            };
        });
    }

    async saveEstimatesToDb(estimatesData, logMessages = []) {
        let newCount = 0;
        let updatedCount = 0;

        for (const estimateData of estimatesData) {
            try {
                if (!estimateData.attic_tech_estimate_id) {
                    logMessages.push(`⚠️ Skipped: Estimate without Attic Tech ID (${estimateData.name})`);
                    continue;
                }

                const branch = await this.findOrCreateBranch(estimateData.branchName, logMessages);
                const salesPerson = await this.findOrCreateSalesPerson(estimateData.salespersonName, branch ? branch.id : null, logMessages);
                const status = await this.findOrCreateEstimateStatus(estimateData.status, logMessages);
                const paymentMethod = await this.findOrCreatePaymentMethod(estimateData.payment_method, logMessages);

                const estimatePayload = {
                    attic_tech_estimate_id: estimateData.attic_tech_estimate_id,
                    name: estimateData.name,
                    at_created_date: estimateData.atCreatedDate,
                    at_updated_date: estimateData.atUpdatedDate,
                    customer_name: estimateData.customer_name,
                    customer_address: estimateData.customer_address,
                    customer_email: typeof estimateData.customer_email === 'string' ? estimateData.customer_email.slice(0, 200).trim() : null,
                    customer_phone: typeof estimateData.customer_phone === 'string' ? estimateData.customer_phone.replace(/[^0-9+()\-\s]/g, '').slice(0, 50).trim() : null,
                    crew_notes: estimateData.crew_notes,
                    price: estimateData.price ? parseFloat(estimateData.price).toFixed(2) : null,
                    retail_cost: estimateData.retail_cost ? parseFloat(estimateData.retail_cost).toFixed(2) : null,
                    final_price: estimateData.final_price ? parseFloat(estimateData.final_price).toFixed(2) : null,
                    sub_service_retail_cost: estimateData.sub_service_retail_cost ? parseFloat(estimateData.sub_service_retail_cost).toFixed(2) : null,
                    discount: estimateData.discount ? parseFloat(estimateData.discount).toFixed(2) : null,
                    attic_tech_hours: estimateData.attic_tech_hours ? Math.round(estimateData.attic_tech_hours) : null,
                    branch_id: branch ? branch.id : null,
                    sales_person_id: salesPerson ? salesPerson.id : null,
                    status_id: status ? status.id : null,
                    payment_method_id: paymentMethod ? paymentMethod.id : null,
                    snapshot_multiplier_ranges: estimateData.snapshot_multiplier_ranges || null
                };

                const [estimate, created] = await Estimate.findOrCreate({
                    where: { attic_tech_estimate_id: estimateData.attic_tech_estimate_id },
                    defaults: estimatePayload
                });

                if (created) {
                    newCount++;
                    logMessages.push(`✅ Created new estimate: ${estimateData.name}`);
                } else {
                    // Update existing estimate
                    await estimate.update(estimatePayload);
                    updatedCount++;
                    logMessages.push(`🔄 Updated existing estimate: ${estimateData.name}`);
                }

                // Calcular taxes para Washington State
                if (estimate.customer_address && estimate.final_price) {
                    try {
                        const taxData = await calculateWashingtonTaxes(
                            parseFloat(estimate.final_price),
                            estimate.customer_address
                        );
                        
                        // Solo actualizar si se calcularon taxes (es de WA)
                        if (taxData.total_tax_amount !== null) {
                            await estimate.update(taxData);
                            logMessages.push(`💰 Taxes calculated for estimate: ${estimateData.name} (${taxData.city_tax_rate ? (taxData.city_tax_rate * 100).toFixed(2) : '0'}% city + ${(taxData.state_tax_rate * 100).toFixed(2)}% state = $${taxData.total_tax_amount})`);
                        }
                    } catch (taxError) {
                        logMessages.push(`⚠️  Tax calculation failed for ${estimateData.name}: ${taxError.message}`);
                    }
                }

                // Auto-crear Follow-Up Ticket para estimates "Lost"
                const estimateStatus = await EstimateStatus.findByPk(estimate.status_id);
                if (estimateStatus && estimateStatus.name === 'Lost') {
                    try {
                        // Verificar si ya tiene un ticket
                        const existingTicket = await FollowUpTicket.findOne({
                            where: { estimate_id: estimate.id }
                        });

                        if (!existingTicket) {
                            // Buscar el status "Negotiating" por defecto
                            const negotiatingStatus = await FollowUpStatus.findOne({
                                where: { name: 'Negotiating' }
                            });

                            // Crear el ticket
                            await FollowUpTicket.create({
                                estimate_id: estimate.id,
                                followed_up: false,
                                status_id: negotiatingStatus ? negotiatingStatus.id : null,
                                label_id: null,
                                chat_id: null,
                                notes: 'Auto-created during estimate sync',
                                follow_up_date: null,
                                last_contact_date: null
                            });

                            logMessages.push(`🎫 Created follow-up ticket for Lost estimate: ${estimateData.name}`);
                        }
                    } catch (ticketError) {
                        logMessages.push(`⚠️  Failed to create follow-up ticket for ${estimateData.name}: ${ticketError.message}`);
                    }
                }

            } catch (error) {
                logMessages.push(`❌ Error processing estimate ${estimateData.name}: ${error.message}`);
            }
        }

        return { newCount, updatedCount };
    }

    async findOrCreateBranch(name, logMessages = []) {
        // Usar helper centralizado para evitar duplicados
        return await branchHelperFindOrCreate(name, logMessages);
    }

    async findOrCreateSalesPerson(name, branchId, logMessages = []) {
        if (!name || !branchId) return null;
        const trimmedName = name.trim();

        // Función helper para normalizar nombres (igual que en el script de limpieza)
        const normalizeName = (name) => {
            return name.toLowerCase()
                .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
                .replace(/[^\w\s]/g, '') // Remover puntuación
                .trim();
        };

        // Función helper para calcular similitud entre nombres (versión mejorada - igual que en el script de limpieza)
        const calculateNameSimilarity = (name1, name2) => {
            const normalized1 = normalizeName(name1);
            const normalized2 = normalizeName(name2);
            
            // Si son exactamente iguales después de normalizar
            if (normalized1 === normalized2) return 1.0;
            
            // Si uno contiene al otro (ej: "Eben W" vs "Eben Woodbell")
            if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
                return 0.9;
            }
            
            // Calcular similitud por palabras
            const words1 = normalized1.split(' ');
            const words2 = normalized2.split(' ');
            
            let commonWords = 0;
            let totalWords = Math.max(words1.length, words2.length);
            
            for (const word1 of words1) {
                for (const word2 of words2) {
                    if (word1 === word2 || 
                        word1.startsWith(word2) || 
                        word2.startsWith(word1)) {
                        commonWords++;
                        break;
                    }
                }
            }
            
            const wordSimilarity = commonWords / totalWords;
            
            // Calcular similitud de caracteres para casos como "Woodall" vs "Woodbell"
            const calculateCharacterSimilarity = (str1, str2) => {
                const longer = str1.length > str2.length ? str1 : str2;
                const shorter = str1.length > str2.length ? str2 : str1;
                
                if (longer.length === 0) return 1.0;
                
                // Calcular distancia de Levenshtein simplificada
                let distance = 0;
                for (let i = 0; i < shorter.length; i++) {
                    if (longer[i] !== shorter[i]) {
                        distance++;
                    }
                }
                distance += longer.length - shorter.length;
                
                return 1 - (distance / longer.length);
            };
            
            // Calcular similitud de caracteres para cada palabra
            let maxCharSimilarity = 0;
            for (const word1 of words1) {
                for (const word2 of words2) {
                    if (word1.length >= 3 && word2.length >= 3) { // Solo palabras de 3+ caracteres
                        const charSimilarity = calculateCharacterSimilarity(word1, word2);
                        if (charSimilarity > maxCharSimilarity) {
                            maxCharSimilarity = charSimilarity;
                        }
                    }
                }
            }
            
            // Combinar similitud de palabras y caracteres
            const combinedSimilarity = (wordSimilarity * 0.6) + (maxCharSimilarity * 0.4);
            
            return combinedSimilarity;
        };

        // 1. Buscar match exacto (case-insensitive) - SOLO activos
        let salesPerson = await SalesPerson.findOne({ 
            where: { 
                name: { [Op.iLike]: trimmedName },
                is_active: true
            } 
        });
        
        if (salesPerson) {
            logMessages.push(`✅ Exact match found: "${salesPerson.name}" for "${trimmedName}"`);
            
            // Verificar si el salesperson encontrado tiene branches asignadas
            const existingBranches = await SalesPersonBranch.count({
                where: { sales_person_id: salesPerson.id }
            });
            
            if (existingBranches === 0) {
                // Si no tiene branches, asignar la primera
                await SalesPersonBranch.create({
                    sales_person_id: salesPerson.id,
                    branch_id: branchId
                });
                logMessages.push(`   📍 Assigned first branch to existing salesperson without branches`);
            } else {
                logMessages.push(`   ✅ Salesperson already has ${existingBranches} branches - NO additional assignment`);
            }
            
            return salesPerson;
        }

        // 2. NO reactivar salespersons inactivos automáticamente
        // Si hay un match exacto inactivo, NO lo reactivamos - crear nuevo en su lugar
        let inactiveSalesPerson = await SalesPerson.findOne({ 
            where: { 
                name: { [Op.iLike]: trimmedName },
                is_active: false
            } 
        });
        
        if (inactiveSalesPerson) {
            logMessages.push(`⚠️ Found inactive salesperson: "${inactiveSalesPerson.name}" for "${trimmedName}" - NOT reactivating (creating new instead)`);
            // NO reactivar - continuar con la lógica de similitud
        }

        // 3. Buscar matches similares - SOLO entre activos
        const allActiveSalesPersons = await SalesPerson.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });

        let bestMatch = null;
        let bestSimilarity = 0.7; // Umbral mínimo de similitud

        for (const sp of allActiveSalesPersons) {
            const similarity = calculateNameSimilarity(trimmedName, sp.name);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = sp;
            }
        }

        if (bestMatch) {
            logMessages.push(`🤝 Similarity match: "${trimmedName}" → "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(2)})`);
            
            // Verificar si el salesperson encontrado tiene branches asignadas
            const existingBranches = await SalesPersonBranch.count({
                where: { sales_person_id: bestMatch.id }
            });
            
            if (existingBranches === 0) {
                // Si no tiene branches, asignar la primera
                await SalesPersonBranch.create({
                    sales_person_id: bestMatch.id,
                    branch_id: branchId
                });
                logMessages.push(`   📍 Assigned first branch to existing salesperson without branches`);
            } else {
                logMessages.push(`   ✅ Salesperson already has ${existingBranches} branches - NO additional assignment`);
            }
            
            return bestMatch;
        }

        // 4. NO reactivar salespersons inactivos por similitud
        // Si hay matches similares inactivos, NO los reactivamos - crear nuevo en su lugar
        const allInactiveSalesPersons = await SalesPerson.findAll({
            where: { is_active: false },
            order: [['name', 'ASC']]
        });

        bestMatch = null;
        bestSimilarity = 0.7;

        for (const sp of allInactiveSalesPersons) {
            const similarity = calculateNameSimilarity(trimmedName, sp.name);
            if (similarity > bestSimilarity) {
                bestSimilarity = similarity;
                bestMatch = sp;
            }
        }

        if (bestMatch) {
            logMessages.push(`⚠️ Found similar inactive: "${trimmedName}" → "${bestMatch.name}" (similarity: ${bestSimilarity.toFixed(2)}) - NOT reactivating (creating new instead)`);
            // NO reactivar - continuar para crear nuevo
        }

        // 5. Crear nuevo salesperson (no reactivar inactivos)
        // Primero verificar si ya existe un salesperson inactivo con el mismo nombre
        const existingInactive = await SalesPerson.findOne({
            where: { 
                name: { [Op.iLike]: trimmedName },
                is_active: false
            }
        });

        if (existingInactive) {
            logMessages.push(`⚠️ Found existing inactive salesperson: ${trimmedName} - NOT reactivating (keeping inactive)`);
            // NO reactivar - mantener inactivo
            return null; // Retornar null para indicar que no se debe usar este salesperson
        }

        // Crear nuevo salesperson solo si no existe uno inactivo
        const [finalSalesPerson, created] = await SalesPerson.findOrCreate({
            where: { name: { [Op.iLike]: trimmedName } },
            defaults: { name: trimmedName, warning_count: 0 }
        });

        if (created) {
            logMessages.push(`🌱 Created new salesperson: ${trimmedName}`);
            // Asignar la primera branch al nuevo salesperson
            await SalesPersonBranch.create({
                sales_person_id: finalSalesPerson.id,
                branch_id: branchId
            });
            logMessages.push(`   📍 Assigned first branch to new salesperson`);
        } else {
            // Si ya existe y está activo, NO asignar branch adicional
            if (finalSalesPerson.is_active) {
                logMessages.push(`✅ Found existing active salesperson: ${trimmedName} - NO additional branch assignment`);
                // NO asignar branch adicional - mantener configuración original
            }
        }

        return finalSalesPerson;
    }

    async findOrCreateEstimateStatus(name, logMessages = []) {
        if (!name || typeof name !== 'string') return null;

        const normalizedName = name.trim();
        if (normalizedName === '') return null;

        // Find case-insensitively using iLike (for PostgreSQL)
        let status = await EstimateStatus.findOne({
            where: {
                name: {
                    [Op.iLike]: normalizedName
                }
            }
        });

        if (status) {
            return status; // Return the existing status.
        }

        // If not found, create it using the normalized name to ensure consistency.
        const [newStatus, created] = await EstimateStatus.findOrCreate({
            where: { name: normalizedName },
            defaults: { name: normalizedName }
        });

        if (created) {
            logMessages.push(`🔖 Created new status: ${normalizedName}`);
        }

        return newStatus;
    }

    async findOrCreatePaymentMethod(name, logMessages = []) {
        if (!name || typeof name !== 'string') return null;

        const normalizedName = name.trim().toLowerCase();
        if (normalizedName === '') return null;

        // Find case-insensitively using iLike (for PostgreSQL)
        let paymentMethod = await PaymentMethod.findOne({
            where: {
                name: {
                    [Op.iLike]: normalizedName
                }
            }
        });

        if (paymentMethod) {
            return paymentMethod; // Return the existing payment method.
        }

        // If not found, create it using the normalized name to ensure consistency.
        const [newPaymentMethod, created] = await PaymentMethod.findOrCreate({
            where: { name: normalizedName },
            defaults: { name: normalizedName }
        });

        if (created) {
            logMessages.push(`💳 Created new payment method: ${normalizedName}`);
        }

        return newPaymentMethod;
    }

    // Actualizar un estimate
    async updateEstimate(req, res) {
        try {
            const { id } = req.params;
            const updateData = req.body;
            
            console.log(`🔄 Actualizando estimate ID: ${id}`, updateData);
            
            // Verificar si el estimate existe
            const estimate = await Estimate.findByPk(id);
            if (!estimate) {
                return res.status(404).json({ message: 'Estimate not found' });
            }

            // Campos permitidos para actualizar
            const allowedFields = [
                'name',
                'customer_name', 
                'customer_address',
                'customer_email',
                'customer_phone',
                'crew_notes',
                'price',
                'retail_cost',
                'final_price',
                'sub_service_retail_cost',
                'discount',
                'attic_tech_hours',
                'sales_person_id',
                'branch_id',
                'status_id'
            ];

            // Filtrar solo los campos permitidos
            const filteredData = {};
            Object.keys(updateData).forEach(key => {
                if (allowedFields.includes(key) && updateData[key] !== undefined) {
                    filteredData[key] = updateData[key];
                }
            });

            // Actualizar el estimate
            await estimate.update(filteredData);

            // Obtener el estimate actualizado con relaciones
            const updatedEstimate = await Estimate.findByPk(id, {
                include: [
                    { model: SalesPerson, as: 'salesperson', attributes: ['id', 'name'] },
                    { model: Branch, as: 'branch', attributes: ['id', 'name'] },
                    { model: EstimateStatus, as: 'status', attributes: ['id', 'name'] }
                ]
            });

            console.log(`✅ Estimate ${id} actualizado exitosamente`);
            
            res.json({
                message: 'Estimate updated successfully',
                estimate: transformEstimateForFrontend(updatedEstimate)
            });
        } catch (error) {
            console.error('❌ Error updating estimate:', error);
            res.status(500).json({ 
                message: 'Error updating estimate', 
                error: error.message 
            });
        }
    }

    // Eliminar un estimate
    async deleteEstimate(req, res) {
        try {
            const { id } = req.params;
            
            // Verificar si el estimate existe
            const estimate = await Estimate.findByPk(id);
            if (!estimate) {
                return res.status(404).json({ message: 'Estimate not found' });
            }

            // Eliminar el estimate
            await estimate.destroy();

            res.json({ message: 'Estimate deleted successfully' });
        } catch (error) {
            console.error('Error deleting estimate:', error);
            res.status(500).json({ message: 'Error deleting estimate', error: error.message });
        }
    }

    /**
     * Exportar lista de clientes para Mailchimp
     * Query params:
     * - branchIds: array de IDs de branches (ej: ?branchIds=1,2,3)
     * - statusIds: array de IDs de statuses (ej: ?statusIds=5) - REQUERIDO
     * - startDate: fecha inicio (YYYY-MM-DD)
     * - endDate: fecha fin (YYYY-MM-DD)
     */
    async exportMailchimpList(req, res) {
        try {
            const { branchIds, statusIds, startDate, endDate } = req.query;

            logger.info('📧 Mailchimp export request:', { branchIds, statusIds, startDate, endDate });

            // Construir filtros
            const whereClause = {};

            // Filtrar por statuses (requerido)
            if (statusIds) {
                const statusIdsArray = statusIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (statusIdsArray.length > 0) {
                    whereClause.status_id = { [Op.in]: statusIdsArray };
                } else {
                    return res.status(400).json({ 
                        success: false,
                        message: 'Please select at least one estimate status' 
                    });
                }
            } else {
                return res.status(400).json({ 
                    success: false,
                    message: 'Please select at least one estimate status' 
                });
            }

            // Filtrar por branches si se especifican
            if (branchIds) {
                const branchIdsArray = branchIds.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id));
                if (branchIdsArray.length > 0) {
                    whereClause.branch_id = { [Op.in]: branchIdsArray };
                }
            }

            // Filtrar por rango de fechas (usando at_updated_date)
            if (startDate || endDate) {
                whereClause.at_updated_date = {};
                if (startDate) {
                    whereClause.at_updated_date[Op.gte] = new Date(startDate);
                }
                if (endDate) {
                    const endDateTime = new Date(endDate);
                    endDateTime.setHours(23, 59, 59, 999); // Incluir todo el día
                    whereClause.at_updated_date[Op.lte] = endDateTime;
                }
            }

            logger.info('🔍 Fetching estimates with filters:', whereClause);

            // Obtener estimates con los filtros (filtra por statuses seleccionados)
            const estimates = await Estimate.findAll({
                where: whereClause,
                include: [
                    {
                        model: Branch,
                        as: 'Branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: EstimateStatus,
                        as: 'EstimateStatus',
                        attributes: ['id', 'name']
                    }
                ],
                attributes: ['id', 'customer_name', 'customer_address', 'customer_phone', 'customer_email', 'branch_id', 'status_id', 'at_updated_date'],
                order: [['at_updated_date', 'DESC']],
                raw: false
            });

            logger.info(`✅ Found ${estimates.length} estimates for export`);

            if (estimates.length === 0) {
                return res.status(404).json({ 
                    success: false,
                    message: 'No estimates found with the specified filters' 
                });
            }

            // Preparar datos para el Excel
            const excelData = estimates.map(estimate => {
                const plainEstimate = estimate.get({ plain: true });
                
                // Formatear fecha de actualización
                let updatedAt = 'N/A';
                if (plainEstimate.at_updated_date) {
                    const date = new Date(plainEstimate.at_updated_date);
                    updatedAt = date.toLocaleDateString('en-US', { 
                        month: '2-digit', 
                        day: '2-digit', 
                        year: 'numeric' 
                    });
                }
                
                // Dividir nombre en First Name y Last Name
                let firstName = 'N/A';
                let lastName = '';
                
                if (plainEstimate.customer_name) {
                    const nameParts = plainEstimate.customer_name.trim().split(/\s+/);
                    if (nameParts.length > 0) {
                        firstName = nameParts[0];
                        lastName = nameParts.slice(1).join(' ');
                    }
                }
                
                return {
                    'First Name': firstName,
                    'Last Name': lastName || '',
                    'Address': plainEstimate.customer_address || 'N/A',
                    'Phone': plainEstimate.customer_phone || 'N/A',
                    'Email': plainEstimate.customer_email || 'N/A',
                    'Branch': plainEstimate.Branch?.name || 'N/A',
                    'Status': plainEstimate.EstimateStatus?.name || 'N/A',
                    'Updated At': updatedAt
                };
            });

            // Crear workbook y worksheet
            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);

            // Ajustar ancho de columnas
            worksheet['!cols'] = [
                { wch: 20 }, // First Name
                { wch: 20 }, // Last Name
                { wch: 40 }, // Address
                { wch: 15 }, // Phone
                { wch: 30 }, // Email
                { wch: 20 }, // Branch
                { wch: 12 }  // Updated At
            ];

            XLSX.utils.book_append_sheet(workbook, worksheet, 'Mailchimp Contacts');

            // Generar el archivo Excel
            const excelBuffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

            // Generar nombre del archivo
            const dateStr = new Date().toISOString().split('T')[0];
            const branchesStr = branchIds ? `_branches-${branchIds.replace(/,/g, '-')}` : '_all-branches';
            const filename = `mailchimp_contacts${branchesStr}_${dateStr}.xlsx`;

            // Enviar el archivo
            res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            res.send(excelBuffer);

            logger.info(`✅ Mailchimp list exported: ${filename} (${estimates.length} contacts)`);

        } catch (error) {
            logger.error('❌ Error exporting Mailchimp list:', error);
            res.status(500).json({ 
                success: false,
                message: 'Error exporting Mailchimp list', 
                error: error.message 
            });
        }
    }
}

module.exports = new EstimatesController();

 