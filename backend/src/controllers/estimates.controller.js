const { Op } = require('sequelize');
const { Estimate, SalesPerson, Branch, EstimateStatus, Job, SalesPersonBranch } = require('../models');
const https = require('https');

// Función para transformar la estructura de los datos para el frontend
const transformEstimateForFrontend = (estimate) => {
    const plainEstimate = estimate.get({ plain: true });
    return {
        ...plainEstimate,
        SalesPerson: plainEstimate.salesperson,
        Branch: plainEstimate.branch,
        EstimateStatus: plainEstimate.status,
        salesperson: undefined, // Limpiar para no enviar datos duplicados
        branch: undefined,
        status: undefined
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
                { model: EstimateStatus, as: 'status', attributes: ['name'] }
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
            
            // Agregar filtros de fecha
            if (startDate) {
                whereClause.at_created_date = {
                    [Op.gte]: new Date(startDate)
                };
            }
            if (endDate) {
                if (whereClause.at_created_date) {
                    whereClause.at_created_date[Op.lte] = new Date(endDate + 'T23:59:59.999Z');
                } else {
                    whereClause.at_created_date = {
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

            const transformedData = estimates.rows.map(e => {
                return transformEstimateForFrontend(e);
            });

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
                    { model: SalesPerson, as: 'salesperson' },
                    { model: Branch, as: 'branch' },
                    { model: EstimateStatus, as: 'status' }
                ]
            });

            if (!estimate) {
                return res.status(404).json({ message: 'Estimate not found' });
            }
            
            const transformedEstimate = transformEstimateForFrontend(estimate);
            // Incluir job relacionado si existe
            const job = await Job.findOne({ where: { estimate_id: estimate.id }, attributes: ['id', 'name', 'branch_id'] });
            if (job) {
                transformedEstimate.job = { id: job.id, name: job.name };
            }
            res.json(transformedEstimate);

    } catch (error) {
            res.status(500).json({ message: 'Error fetching estimate details', error: error.message });
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
            
            // Fecha de fin por defecto: fecha actual (día de ejecución)
            let endDate = new Date().toISOString().split('T')[0];
            
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
                crew_notes: lead.crew_notes
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
                    status_id: status ? status.id : null
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

            } catch (error) {
                logMessages.push(`❌ Error processing estimate ${estimateData.name}: ${error.message}`);
            }
        }

        return { newCount, updatedCount };
    }

    async findOrCreateBranch(name, logMessages = []) {
        if (!name) return null;
        
        const [branch, created] = await Branch.findOrCreate({
            where: { name },
            defaults: { name }
        });

        if (created) {
            logMessages.push(`🏢 Created new branch: ${name}`);
        }

        return branch;
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
}

module.exports = new EstimatesController();

 