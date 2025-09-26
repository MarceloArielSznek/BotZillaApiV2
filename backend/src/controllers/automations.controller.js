const https = require('https');
const { loginToAtticTech } = require('../utils/atticTechAuth');
const {
    Op
} = require('sequelize');
const {
    SalesPerson,
    Branch,
    Estimate,
    EstimateStatus,
    SalesPersonBranch,
    SheetColumnMap,
    CrewMember,
    Job,
    Shift,
    SpecialShift,
    JobSpecialShift,
    AutomationErrorLog,
    CrewMemberBranch,
    Notification,
    NotificationTemplate,
    InspectionReport
} = require('../models');
const {
    logger
} = require('../utils/logger');
const { caches } = require('../utils/cache');
require('dotenv').config();
const sequelize = require('../config/database');
const { calculateJobPerformance } = require('../services/performance.service');

/**
 * Helper function to transform row data array into a structured object based on the column map.
 * @param {string[]} rowData - The array of data from the spreadsheet row.
 * @param {object[]} columnMap - The column mapping from the database.
 * @returns {object} - The structured data object.
 */
// Función helper para limpiar emojis de nombres
const cleanEmojisFromName = (name) => {
    if (!name || typeof name !== 'string') return name;
    return name.replace(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '').trim();
};

const transformRowData = (rowData, columnMap) => {
    const processedData = {};
    const effectiveRowData = Array.isArray(rowData) ? rowData : String(rowData).split(',');

    console.log('🔍 [transformRowData] Procesando datos:', {
        originalRowDataLength: rowData ? rowData.length : 0,
        effectiveRowDataLength: effectiveRowData.length,
        columnMapLength: columnMap.length
    });

    columnMap.forEach(mapItem => {
        const { field_name, column_index } = mapItem;
        if (column_index < effectiveRowData.length) {
            const value = effectiveRowData[column_index];
            if (value !== null && value !== undefined && String(value).trim() !== '') {
                processedData[field_name] = String(value).trim();
                
                // Log especial para la columna Crew Lead
                if (field_name === 'Crew Lead') {
                    console.log('👑 [transformRowData] Encontrada columna Crew Lead:', {
                        columnIndex: column_index,
                        originalValue: value,
                        trimmedValue: String(value).trim(),
                        fieldName: field_name
                    });
                }
            }
        }
    });
    
    console.log('📋 [transformRowData] Datos procesados finales:', {
        totalFields: Object.keys(processedData).length,
        hasCrewLead: 'Crew Lead' in processedData,
        crewLeadValue: processedData['Crew Lead'] || 'NO ENCONTRADO'
    });
    
    return processedData;
};

/**
 * Helper function to safely parse a date string.
 * @param {string} dateString - The string to parse.
 * @returns {Date} - A valid Date object, or the current date as a fallback.
 */
const parseValidDate = (dateString) => {
    if (!dateString) {
        return new Date();
    }
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        logger.warn(`Invalid date format encountered: "${dateString}". Defaulting to current date.`);
        return new Date();
    }
    return date;
};

/**
 * Parsea de forma segura un valor a booleano.
 * @param {*} value - El valor a parsear (puede ser booleano, string, null, o undefined).
 * @returns {boolean} - El valor booleano resultante.
 */
const parseBoolean = (value) => {
    if (typeof value === 'boolean') {
        return value;
    }
    if (typeof value === 'string') {
        return value.toLowerCase() === 'true';
    }
    // Devuelve false para null, undefined, 0, etc.
    return !!value;
};

// --- Lógica de Sincronización (se ejecutará en segundo plano) ---

async function runSync() {
    const logMessages = [];
    try {
        logMessages.push('🚀 Starting external estimates synchronization...');
        console.log('🚀 Starting external estimates synchronization...');

        const apiKey = await loginToAtticTech(logMessages);

        // Fecha de inicio fija, como se requirió.
        const startDate = '2025-06-15'; 
        // Fecha de fin: fecha actual + 2 días para capturar estimates que se actualicen durante el día
        const endDateObj = new Date();
        endDateObj.setDate(endDateObj.getDate() + 2);
        const endDate = endDateObj.toISOString().split('T')[0];

        const allLeads = await fetchAllEstimatesFromAtticTech(apiKey, startDate, endDate, logMessages);
        const mappedEstimates = mapAtticTechDataToEstimates(allLeads);
        const { newCount, updatedCount } = await saveEstimatesToDb(mappedEstimates, logMessages);

        const summary = {
            message: `✅ Background synchronization finished. New: ${newCount}, Updated: ${updatedCount}.`,
            newEstimatesCount: newCount,
            updatedEstimatesCount: updatedCount,
            logs: logMessages
        };

        console.log(summary.message);
        return summary;

    } catch (error) {
        const errorSummary = {
            message: `❌ A critical error occurred during sync: ${error.message}`,
            error: error.message,
            logs: logMessages
        };
        console.error('Sync Error:', errorSummary);
        // Re-throw the error so the controller can catch it and send a 500 response
        throw error;
    }
}


// --- Funciones auxiliares para la sincronización con Attic Tech ---

async function fetchAllEstimatesFromAtticTech(apiKey, fechaInicio, fechaFin, logMessages = []) {
    let allLeads = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    logMessages.push(`📊 Starting to fetch estimates from ${fechaInicio} to ${fechaFin}`);

    while (hasMore) {
        let queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-updatedAt`;
        if (fechaInicio) {
            queryString += `&where[updatedAt][greater_than]=${encodeURIComponent(fechaInicio)}`;
        }
        if (fechaFin) {
            queryString += `&where[updatedAt][less_than]=${encodeURIComponent(fechaFin)}`;
        }

        // Log de la query que se está construyendo
        if (page === 1) {
            console.log('🔍 Backend - Query string construida para Attic Tech API:', {
                queryString: queryString,
                fechaInicio: fechaInicio,
                fechaFin: fechaFin
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

function mapAtticTechDataToEstimates(leads) {
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
            customer_email: customerEmail,
            customer_phone: customerPhone,
            crew_notes: lead.crew_notes || null
        };
    });
}

// Sanitizadores
function sanitizePhone(raw) {
    if (!raw) return null;
    const allowed = String(raw).replace(/[^0-9+()\-\s]/g, '');
    return allowed.slice(0, 50).trim() || null;
}

function sanitizeEmail(raw) {
    if (!raw) return null;
    return String(raw).trim().slice(0, 200) || null;
}

async function findOrCreateSalesPerson(name, branchId, logMessages = []) {
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
        defaults: { name: trimmedName, warning_count: 0, is_active: true }
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

// Exportar la función para testing
module.exports = { findOrCreateSalesPerson };

async function findOrCreateBranch(name, logMessages = []) {
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

async function findOrCreateEstimateStatus(name, logMessages = []) {
    if (!name || typeof name !== 'string') return null;

    const normalizedName = name.trim().slice(0, 50);
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

async function saveEstimatesToDb(estimatesData, logMessages = []) {
    let newCount = 0;
    let updatedCount = 0;

    for (const data of estimatesData) {
        const branch = await findOrCreateBranch(data.branchName, logMessages);
        const salesPerson = await findOrCreateSalesPerson(data.salespersonName, branch ? branch.id : null, logMessages);
        const status = await findOrCreateEstimateStatus(data.status, logMessages);

        logMessages.push(`Processing estimate: ${data.name} (AT ID: ${data.attic_tech_estimate_id}) with status: ${data.status}`);

        const estimatePayload = {
            name: data.name,
            attic_tech_estimate_id: data.attic_tech_estimate_id,
            at_created_date: data.atCreatedDate,
            at_updated_date: data.atUpdatedDate,
            price: data.price,
            retail_cost: data.retail_cost,
            final_price: data.final_price,
            sub_service_retail_cost: data.sub_service_retail_cost,
            discount: data.discount,
            attic_tech_hours: data.attic_tech_hours,
            customer_name: data.customer_name,
            customer_address: data.customer_address,
            customer_email: sanitizeEmail(data.customer_email),
            customer_phone: sanitizePhone(data.customer_phone),
            crew_notes: data.crew_notes,
            sales_person_id: salesPerson ? salesPerson.id : null,
            branch_id: branch ? branch.id : null,
            status_id: status ? status.id : null,
            updated_at: new Date()
        };

        // Find the definitive record using the unique ID.
        const recordById = await Estimate.findOne({
            where: { attic_tech_estimate_id: data.attic_tech_estimate_id }
        });

        // Find any potential legacy records that match by name but are missing the ID.
        const legacyRecords = await Estimate.findAll({
            where: {
                name: data.name,
                attic_tech_estimate_id: { [Op.is]: null }
            }
        });

        if (recordById && legacyRecords.length > 0) {
            // Duplicate scenario: Update the correct record and delete the legacy ones.
            await recordById.update(estimatePayload);
            updatedCount++;
            logMessages.push(`🔄 Updated primary estimate and merging duplicates for: ${recordById.name}`);

            const legacyIdsToDelete = legacyRecords.map(r => r.id);
            await Estimate.destroy({ where: { id: { [Op.in]: legacyIdsToDelete } } });
            logMessages.push(`🗑️ Removed ${legacyRecords.length} legacy duplicate(s). IDs: ${legacyIdsToDelete.join(', ')}`);

        } else if (recordById) {
            // Standard update, no legacy records found.
            await recordById.update(estimatePayload);
            updatedCount++;
            logMessages.push(`🔄 Updated estimate by ID: ${recordById.name}`);

        } else if (legacyRecords.length > 0) {
            // No record with the ID exists yet, but we found a legacy one to update.
            // Update the first legacy record and delete any others.
            const masterLegacy = legacyRecords[0];
            await masterLegacy.update(estimatePayload);
            updatedCount++;
            logMessages.push(`🛠️ Fixed and updated legacy estimate: ${masterLegacy.name}`);

            if (legacyRecords.length > 1) {
                const legacyIdsToDelete = legacyRecords.slice(1).map(r => r.id);
                await Estimate.destroy({ where: { id: { [Op.in]: legacyIdsToDelete } } });
                logMessages.push(`🗑️ Removed ${legacyIdsToDelete.length} extra legacy duplicate(s).`);
            }
        } else {
            // This is a completely new estimate. Only create if it's not a legacy record.
            const creationDateCutoff = new Date('2025-06-15');
            if (data.atCreatedDate && new Date(data.atCreatedDate) >= creationDateCutoff) {
                await Estimate.create(estimatePayload);
                newCount++;
                logMessages.push(`✨ Created new estimate: ${data.name}`);
            } else {
                logMessages.push(`🚫 Skipped creating old estimate (created before ${creationDateCutoff.toISOString().split('T')[0]}): ${data.name}`);
            }
        }
    }
    
    logMessages.push(`💾 Database persistence complete. New: ${newCount}, Updated: ${updatedCount}.`);
    return { newCount, updatedCount };
}

// --- Controlador Principal (ahora asíncrono) ---

class AutomationsController {

    async syncExternalEstimates(req, res) {
        const logMessages = [];
        const background = req.query.background === 'true';
        
        // Log de los parámetros recibidos
        console.log('🔍 Backend - Parámetros recibidos:', {
            body: req.body,
            query: req.query,
            hasBodyParams: Object.keys(req.body || {}).length > 0,
            hasQueryParams: Object.keys(req.query || {}).length > 0,
            startDateInBody: req.body?.startDate,
            endDateInBody: req.body?.endDate,
            bodyKeys: Object.keys(req.body || {})
        });
        
        logMessages.push('🚀 Starting synchronization...');

        const processSync = async () => {
            try {
                logMessages.push('🔑 Logging into Attic Tech...');
                const apiKey = await loginToAtticTech(logMessages);

                // Usar parámetros del frontend si están disponibles, sino usar valores por defecto
                let startDate = '2025-06-15'; // Fecha por defecto
                // Fecha de fin por defecto: fecha actual + 2 días para capturar estimates que se actualicen durante el día
                const endDateObj = new Date();
                endDateObj.setDate(endDateObj.getDate() + 2);
                let endDate = endDateObj.toISOString().split('T')[0];
                
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
                console.log('🔍 Backend - Fechas que se pasan a fetchAllEstimatesFromAtticTech:', {
                    startDate: startDate,
                    endDate: endDate,
                    startDateType: typeof startDate,
                    endDateType: typeof endDate
                });
                const allLeads = await fetchAllEstimatesFromAtticTech(apiKey, startDate, endDate, logMessages);

                if (allLeads.length === 0) {
                    logMessages.push('✅ No new or updated estimates to process.');
                    if (!background) {
                        res.status(200).json({ success: true, message: 'Synchronization finished. No new data.', log: logMessages });
                    }
                    return;
                }

                logMessages.push('🗺️ Mapping Attic Tech data...');
                const estimatesData = mapAtticTechDataToEstimates(allLeads);
                
                logMessages.push('💾 Saving estimates to the database...');
                const { newCount, updatedCount } = await saveEstimatesToDb(estimatesData, logMessages);
                
                const summary = `✅ Background synchronization finished. New: ${newCount}, Updated: ${updatedCount}.`;
                logMessages.push(summary);
                logger.info(summary);

                if (!background) {
                    res.status(200).json({ success: true, message: summary, new: newCount, updated: updatedCount, log: logMessages });
                }
            } catch (error) {
                logMessages.push(`❌ Error during synchronization: ${error.message}`);
                logger.error('Synchronization failed:', { error: error.message, log: logMessages });
                if (!background && !res.headersSent) {
                    res.status(500).json({ success: false, message: 'Synchronization failed.', log: logMessages });
                }
            }
        };

        if (background) {
            res.status(202).json({ success: true, message: 'Background synchronization started.' });
            processSync();
        } else {
            await processSync();
        }
    }

    /**
     * @description Syncs the column mapping from a spreadsheet header.
     * Accepts two formats:
     * 1. { sheet_name: string, header_row: string[] } (Legacy)
     * 2. { name: string, columns: object } (Preferred for Make.com)
     */
    async syncColumnMap(req, res) {
      const { sheet_name, header_row, name, columns } = req.body;
      const { dryRun } = req.query;

      let effectiveSheetName;
      let effectiveHeaderRow;

      // Handle the new, preferred format (columns as a direct JSON object)
      if (name && columns && typeof columns === 'object' && !Array.isArray(columns)) {
        effectiveSheetName = name;
        effectiveHeaderRow = Object.values(columns);
      } 
      // Handle the original format
      else if (sheet_name && header_row && Array.isArray(header_row)) {
        effectiveSheetName = sheet_name;
        effectiveHeaderRow = header_row;
      } 
      // If neither format is valid
      else {
        return res.status(400).json({
          success: false,
          message: 'Request body must match one of the supported formats.'
        });
      }

      // Validation on the processed data
      if (!effectiveSheetName || !effectiveHeaderRow || !Array.isArray(effectiveHeaderRow)) {
        return res.status(400).json({
          success: false,
          message: 'Processed data is invalid. `sheet_name` must be a string and `header_row` must be an array.'
        });
      }

      try {
        const recordsToSync = [];
        const seenFieldNames = new Set();
 
        effectiveHeaderRow.forEach((fieldName, index) => {
            if (!fieldName || typeof fieldName !== 'string' || fieldName.trim() === '') {
                return;
            }
            const trimmedFieldName = fieldName.trim();
            if (trimmedFieldName.startsWith('__') || seenFieldNames.has(trimmedFieldName)) {
                return;
            }
            seenFieldNames.add(trimmedFieldName);
 
            const techHoursIndex = effectiveHeaderRow.findIndex(h => h && h.trim() === 'Techs hours');
            const unbillableHoursIndex = effectiveHeaderRow.findIndex(h => h && h.trim() === 'Unbillable Job Hours');
 
            let fieldType = 'field'; // Default to 'field'
 
            // Check if markers were found and the current index is between them
            if (techHoursIndex !== -1 && unbillableHoursIndex !== -1 && index > techHoursIndex && index < unbillableHoursIndex) {
                fieldType = 'crew_member';
            }
 
            recordsToSync.push({
                sheet_name: effectiveSheetName.trim(),
                field_name: trimmedFieldName,
                column_index: index,
                type: fieldType
            });
        });
 
        if (recordsToSync.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'No valid columns to sync.',
              created: 0,
              updated: 0
            });
        }

        logger.info(`[syncColumnMap] Preparing to sync ${recordsToSync.length} records for sheet: ${effectiveSheetName}`, {
          sheet_name: effectiveSheetName,
          records: JSON.stringify(recordsToSync, null, 2)
        });

        if (dryRun === 'true') {
          return res.status(200).json({
            success: true,
            message: `[DRY RUN] Successfully processed ${recordsToSync.length} columns for sheet "${effectiveSheetName}". No data was saved.`,
            syncedRecords: 0,
            processedRecords: recordsToSync.length,
            dataThatWouldBeSaved: recordsToSync
          });
        }

        // Usar transacción para garantizar consistencia: DELETE + INSERT
        const sequelize = require('../config/database');
        const transaction = await sequelize.transaction();

        try {
          // 1. Eliminar todos los registros existentes para esta sheet
          const deletedCount = await SheetColumnMap.destroy({
            where: { sheet_name: effectiveSheetName },
            transaction
          });

          // 2. Insertar los nuevos registros
          const result = await SheetColumnMap.bulkCreate(recordsToSync, {
            transaction
          });

          // 3. Confirmar la transacción
          await transaction.commit();

          console.log(`✅ Column map for sheet "${effectiveSheetName}" synced successfully.`);
          console.log(`   - Deleted ${deletedCount} old records`);
          console.log(`   - Created ${result.length} new records`);

          res.status(200).json({
            success: true,
            message: `Successfully synced ${result.length} columns for sheet "${effectiveSheetName}". Replaced ${deletedCount} old records.`,
            syncedRecords: result.length,
            deletedRecords: deletedCount
          });

        } catch (transactionError) {
          // Rollback en caso de error
          await transaction.rollback();
          throw transactionError;
        }

      } catch (error) {
        console.error(`❌ Error syncing column map for sheet "${effectiveSheetName}":`, error);
        res.status(500).json({
          success: false,
          message: 'An internal server error occurred during the sync.',
          error: error.message
        });
      }
    }

    /**
     * Process a single row of data from a spreadsheet.
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    async processRow(req, res) {
        const { sheet_name, row_data, row_number } = req.body;
        const { dryRun } = req.query;
        const isDryRun = dryRun === 'true';

        // Debug especial para las filas 5 y 6 (Melanie Patterson)
        if (row_number === 5 || row_number === 6) {
            console.log(`🔍 [processRow] DEBUG ESPECIAL PARA FILA ${row_number}:`, {
                row_data: row_data,
                row_data_type: typeof row_data,
                row_data_length: row_data ? row_data.length : 0,
                sheet_name: sheet_name,
                row_number: row_number,
                row_data_array: Array.isArray(row_data) ? row_data : null,
                row_data_string: typeof row_data === 'string' ? row_data : null,
                row_data_indices: Array.isArray(row_data) ? row_data.map((item, index) => `${index}: "${item}"`).slice(0, 15) : null
            });
        }

        // Log de inicio del procesamiento
        console.log('🚀 [processRow] Iniciando procesamiento:', {
            sheet_name,
            row_number,
            isDryRun,
            hasRowData: !!row_data,
            rowDataLength: Array.isArray(row_data) ? row_data.length : 'string',
            rowDataType: typeof row_data,
            rowDataPreview: Array.isArray(row_data) ? row_data.slice(0, 5) : 
                           typeof row_data === 'string' ? row_data.substring(0, 100) : 
                           typeof row_data === 'object' ? JSON.stringify(row_data).substring(0, 100) : 
                           String(row_data).substring(0, 100)
        });

        // 1. Validation mejorada
        if (!sheet_name || !row_data || !row_number) {
            const missingFields = [];
            if (!sheet_name) missingFields.push('sheet_name');
            if (!row_data) missingFields.push('row_data');
            if (!row_number) missingFields.push('row_number');
            
            console.log('❌ [processRow] Validation failed:', { missingFields });
            return res.status(400).json({
                success: false,
                message: `Missing required fields: ${missingFields.join(', ')}`,
                missingFields
            });
        }

        let effectiveRowData;
        if (typeof row_data === 'string') {
            effectiveRowData = row_data.split(',').map(item => item.trim());
            console.log('📝 [processRow] Convirtiendo string a array:', { 
                originalLength: row_data.length,
                convertedLength: effectiveRowData.length 
            });
        } else if (Array.isArray(row_data)) {
            effectiveRowData = row_data.map(item => typeof item === 'string' ? item.trim() : item);
            console.log('📝 [processRow] Usando array existente:', { 
                length: effectiveRowData.length 
            });
        } else if (typeof row_data === 'object' && row_data !== null) {
            // Manejar objetos con keys numéricas (formato de Make.com)
            const numericKeys = Object.keys(row_data)
                .filter(key => !key.startsWith('__')) // Excluir metadatos de Make.com
                .filter(key => !isNaN(parseInt(key))) // Solo keys numéricas
                .sort((a, b) => parseInt(a) - parseInt(b)); // Ordenar numéricamente
            
            effectiveRowData = numericKeys.map(key => {
                const value = row_data[key];
                return typeof value === 'string' ? value.trim() : value;
            });
            
            console.log('📝 [processRow] Convirtiendo objeto a array:', { 
                originalKeys: Object.keys(row_data).length,
                numericKeys: numericKeys.length,
                convertedLength: effectiveRowData.length,
                firstFewValues: effectiveRowData.slice(0, 5)
            });
        } else {
            console.log('❌ [processRow] Invalid row_data type:', { 
                type: typeof row_data,
                value: row_data 
            });
            return res.status(400).json({
                success: false,
                message: '`row_data` must be an array, object with numeric keys, or a comma-separated string.',
                receivedType: typeof row_data
            });
        }

        try {
            // Variables para rastrear sugerencias y crew members faltantes
            const suggestions = {
                missingCrewMembers: [],
                suggestedShifts: [],
                requiresApproval: false
            };
            
            console.log('🔍 [processRow] Buscando column map para sheet:', sheet_name);
            
            const columnMap = await SheetColumnMap.findAll({
                where: { sheet_name },
                order: [['column_index', 'ASC']]
            });

            console.log('📋 [processRow] Column map encontrado:', {
                sheetName: sheet_name,
                columnCount: columnMap.length,
                columns: columnMap.map(col => ({
                    index: col.column_index,
                    fieldName: col.field_name,
                    headerName: col.header_name
                }))
            });

            // Debug especial para la columna Crew Lead
            const crewLeadColumn = columnMap.find(col => col.field_name === 'Crew Lead');
            console.log('👑 [processRow] Columna Crew Lead encontrada:', {
                found: !!crewLeadColumn,
                columnIndex: crewLeadColumn?.column_index,
                fieldName: crewLeadColumn?.field_name,
                headerName: crewLeadColumn?.header_name
            });

            // Debug para ver todas las columnas mapeadas
            console.log('🗺️ [processRow] Mapeo completo de columnas para sheet:', sheet_name, {
                totalColumns: columnMap.length,
                allColumns: columnMap.map(col => ({
                    index: col.column_index,
                    fieldName: col.field_name,
                    headerName: col.header_name
                }))
            });

            // Buscar cualquier columna que contenga "crew" o "lead"
            const crewRelatedColumns = columnMap.filter(col => 
                col.field_name.toLowerCase().includes('crew') || 
                col.field_name.toLowerCase().includes('lead') ||
                (col.header_name && col.header_name.toLowerCase().includes('crew')) ||
                (col.header_name && col.header_name.toLowerCase().includes('lead'))
            );
            console.log('🔍 [processRow] Columnas relacionadas con crew/lead:', {
                found: crewRelatedColumns.length,
                columns: crewRelatedColumns.map(col => ({
                    index: col.column_index,
                    fieldName: col.field_name,
                    headerName: col.header_name
                }))
            });

            // Debug especial para verificar el valor en la columna L (índice 11)
            if ((row_number === 6 || row_number === 8) && effectiveRowData && effectiveRowData.length > 11) {
                console.log(`🔍 [processRow] Verificando columna L (índice 11) para fila ${row_number}:`, {
                    columnIndex11: effectiveRowData[11],
                    columnIndex11Type: typeof effectiveRowData[11],
                    columnIndex11Length: effectiveRowData[11] ? effectiveRowData[11].length : 0,
                    containsUlises: effectiveRowData[11] ? effectiveRowData[11].includes('Ulises') : false,
                    containsSolorio: effectiveRowData[11] ? effectiveRowData[11].includes('Solorio') : false,
                    containsAnthony: effectiveRowData[11] ? effectiveRowData[11].includes('Anthony') : false,
                    containsLehto: effectiveRowData[11] ? effectiveRowData[11].includes('Lehto') : false
                });

                // Mostrar todas las columnas para debug
                console.log(`📋 [processRow] Todas las columnas de la fila ${row_number}:`, 
                    effectiveRowData.map((value, index) => `${index}: "${value}"`).join(', ')
                );

                // Debug específico para columnas de crew members
                console.log(`👥 [processRow] Columnas de crew members en fila ${row_number}:`, {
                    romelWatts: effectiveRowData[23] || 'N/A',
                    anthonyLehto: effectiveRowData[26] || 'N/A',
                    joshiaWatts: effectiveRowData[24] || 'N/A',
                    joshuaVina: effectiveRowData[24] || 'N/A',
                    malikRichardson: effectiveRowData[40] || 'N/A'
                });
            }

            if (columnMap.length === 0) {
                console.log('❌ [processRow] No column map found:', { sheet_name, row_number });
                logger.warn(`[processRow] No column map found for sheet: ${sheet_name}. Cannot process row ${row_number}.`);
                return res.status(404).json({
                    success: false,
                    message: `Column map not found for sheet "${sheet_name}". Please sync the header row first.`,
                    sheet_name,
                    row_number
                });
            }

            // Paso 2: Usar el mapa para transformar los datos de la fila
            const processedData = transformRowData(effectiveRowData, columnMap);
            
                            console.log('🔄 [processRow] Datos procesados:', {
                    rowNumber: row_number,
                    processedDataKeys: Object.keys(processedData),
                    jobName: processedData['Job Name'],
                    crewLead: processedData['Crew Lead'],
                    hasJobName: !!processedData['Job Name'],
                    crewLeadValue: processedData['Crew Lead'],
                    crewLeadType: typeof processedData['Crew Lead'],
                    crewLeadLength: processedData['Crew Lead'] ? processedData['Crew Lead'].length : 0
                });

            // Si es un dryRun, solo devolvemos los datos procesados
            if (isDryRun) {
                console.log('🔍 [processRow] Ejecutando en modo dry run');
                return res.status(200).json({
                    success: true,
                    message: `Fila ${row_number} de la hoja "${sheet_name}" procesada en modo dry run.`,
                    processedData,
                    sheet_name,
                    row_number
                });
            }
            
                            console.log('💾 [processRow] Iniciando transacción de base de datos');
            const transaction = await sequelize.transaction();
            try {
                const jobName = processedData['Job Name'];
                const clPlanHours = processedData['CL Estimated Plan Hours'] || processedData['crew_leader_hours'];
                const clEstimatedPlanHours = processedData['CL Estimated Plan Hours'];
                const crewLeadName = processedData['Crew Lead'];

                console.log('📋 [processRow] Datos extraídos:', {
                    jobName,
                    clPlanHours,
                    clEstimatedPlanHours,
                    crewLeadName,
                    hasJobName: !!jobName
                });

                if (!jobName) {
                    console.log('❌ [processRow] Job Name not found in processed data');
                    await transaction.rollback();
                    return res.status(400).json({ 
                        success: false, 
                        message: 'Column "Job Name" not found in processed data.',
                        availableColumns: Object.keys(processedData)
                    });
                }

                console.log('🔍 [processRow] Buscando estimate:', jobName);
                let estimate = await Estimate.findOne({ where: { name: jobName }, transaction });

                if (estimate) {
                    console.log('✅ [processRow] Estimate encontrado:', {
                        estimateId: estimate.id,
                        estimateName: estimate.name,
                        branchId: estimate.branch_id
                    });
                } else {
                    console.log('⚠️ [processRow] Estimate no encontrado, creando estimate de respaldo');
                }

                // --- INICIO: Lógica de respaldo si no se encuentra el estimate ---
                if (!estimate) {
                    const estimatorName = processedData['Estimator'];
                    const atHours = processedData['AT Estimated Hours'];
                    const branchName = sheet_name; 

                    if (estimatorName && branchName) {
                        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '');
                        const normalizedBranchName = normalize(branchName);

                        const matchingBranches = await Branch.findAll({
                            where: sequelize.where(
                                sequelize.fn('regexp_replace', sequelize.fn('LOWER', sequelize.col('name')), '[^a-z0-9]', '', 'g'),
                                { [Op.like]: `%${normalizedBranchName}%` }
                            ),
                            transaction
                        });

                        let branch;
                        if (matchingBranches.length === 1) {
                            branch = matchingBranches[0];
                        } else if (matchingBranches.length > 1) {
                            // Si hay múltiples coincidencias, es ambiguo. Detenemos el proceso.
                            const message = `Ambiguous branch match for sheet_name "${branchName}". Found ${matchingBranches.length} possible branches: ${matchingBranches.map(b => b.name).join(', ')}. Please make the sheet name more specific.`;
                            logger.warn(`[processRow] ${message}`, { sheet_name, row_number, jobName });
                            
                            await transaction.rollback();
                            return res.status(409).json({ // 409 Conflict
                                success: false,
                                message: message
                            });
                        } else {
                            // Si no se encuentra ninguna sucursal, detenemos el proceso para esta fila.
                            const message = `Branch not found for sheet_name "${branchName}" and no estimate exists for job "${jobName}". Job processing stopped.`;
                            logger.warn(`[processRow] ${message}`, { sheet_name, row_number, jobName });
                            
                            await transaction.rollback();
                            return res.status(404).json({
                                success: false,
                                message: `Branch like "${branchName}" not found. Please create it manually before processing this job.`
                            });
                        }
                        
                        // Si la sucursal fue encontrada, procedemos a crear el estimate de respaldo.
                        const [salesPerson] = await SalesPerson.findOrCreate({
                            where: { name: estimatorName },
                            defaults: { name: estimatorName },
                            transaction
                        });
                        
                        const [soldStatus] = await EstimateStatus.findOrCreate({
                            where: { name: 'Sold' },
                            defaults: { name: 'Sold' },
                            transaction
                        });

                        estimate = await Estimate.create({
                            name: jobName,
                            branch_id: branch.id,
                            sales_person_id: salesPerson.id,
                            status_id: soldStatus.id,
                            attic_tech_hours: parseFloat(atHours) || null,
                            at_created_date: new Date(),
                            at_updated_date: new Date(),
                        }, { transaction });
                    }
                }
                // --- FIN: Lógica de respaldo ---

                console.log('👥 [processRow] Procesando crew leader:', {
                    crewLeadName: crewLeadName,
                    crewLeadNameType: typeof crewLeadName,
                    crewLeadNameLength: crewLeadName ? crewLeadName.length : 0,
                    hasCrewLeadName: !!crewLeadName,
                    crewLeadNameTrimmed: crewLeadName ? crewLeadName.trim() : null,
                    isEmpty: crewLeadName ? crewLeadName.trim() === '' : true,
                    isWhitespace: crewLeadName ? crewLeadName.trim().length === 0 : true
                });
                let crewLeader = null;
                let cleanCrewLeadName = null;
                
                if (crewLeadName && crewLeadName.trim()) {
                    // Limpiar emojis del nombre del crew leader
                    cleanCrewLeadName = cleanEmojisFromName(crewLeadName);
                    
                    console.log('🧹 [processRow] Nombre del crew leader limpiado:', {
                        original: crewLeadName,
                        cleaned: cleanCrewLeadName,
                        hasEmojis: cleanCrewLeadName !== crewLeadName
                    });

                    // Buscar crew leader existente, NO crear automáticamente
                    crewLeader = await CrewMember.findOne({
                        where: { name: cleanCrewLeadName },
                        transaction
                    });
                    
                    let crewLeaderWasCreated = false;
                    if (!crewLeader) {
                        console.log('⚠️ [processRow] Crew Leader no encontrado - se requiere aprobación manual:', {
                            suggestedName: cleanCrewLeadName,
                            action: 'CREATE_CREW_LEADER'
                        });
                        
                        // Agregar a sugerencias
                        suggestions.missingCrewMembers.push({
                            name: cleanCrewLeadName,
                            type: 'crew_leader',
                            suggestedHours: crewLeaderHours || 0,
                            action: 'CREATE_CREW_LEADER'
                        });
                        suggestions.requiresApproval = true;
                        // NO crear automáticamente - será manejado en el frontend
                    }
                    
                    // Si el crew leader ya existía pero no estaba marcado como leader, actualizarlo
                    if (!crewLeaderWasCreated && !crewLeader.is_leader) {
                        console.log('👑 [processRow] Actualizando crew leader existente:', {
                            crewLeaderName: cleanCrewLeadName,
                            crewLeaderId: crewLeader.id,
                            action: 'Marcando como leader'
                        });
                        await crewLeader.update({ is_leader: true }, { transaction });
                    }
                    
                    // La asignación de branch al crew leader se hará después de crear el job
                    
                                    console.log('✅ [processRow] Crew leader procesado:', {
                    crewLeaderId: crewLeader.id,
                    crewLeaderName: crewLeader.name,
                    wasCreated: crewLeaderWasCreated,
                    isLeader: crewLeader.is_leader,
                    crewLeaderObject: crewLeader ? 'EXISTS' : 'NULL'
                });
                } else {
                    console.log('⚠️ [processRow] No se especificó crew leader:', {
                        crewLeadName: crewLeadName,
                        crewLeadNameType: typeof crewLeadName,
                        crewLeadNameLength: crewLeadName ? crewLeadName.length : 0,
                        reason: !crewLeadName ? 'crewLeadName is null/undefined' : 'crewLeadName is empty after trim'
                    });
                }

                console.log('🔍 [processRow] Buscando job existente:', jobName);
                let job = await Job.findOne({ where: { name: jobName }, transaction });

                // Obtener las horas reales del crew leader desde el spreadsheet
                let crewLeaderHours = 0;
                if (crewLeader && processedData[crewLeader.name]) {
                    crewLeaderHours = parseFloat(processedData[crewLeader.name]) || 0;
                    console.log('👑 [processRow] Horas del crew leader encontradas:', {
                        crewLeaderName: crewLeader.name,
                        crewLeaderHours: crewLeaderHours,
                        rawValue: processedData[crewLeader.name]
                    });
                } else {
                    // Fallback a las horas planificadas del estimate
                    crewLeaderHours = parseFloat(clPlanHours) || 0;
                    console.log('👑 [processRow] Usando horas planificadas del estimate:', {
                        crewLeaderName: crewLeader?.name || 'N/A',
                        crewLeaderHours: crewLeaderHours,
                        clPlanHours: clPlanHours
                    });
                }

                const jobData = {
                    name: jobName,
                    crew_leader_hours: crewLeaderHours,
                    crew_leader_id: crewLeader ? crewLeader.id : null,
                    estimate_id: estimate ? estimate.id : null,
                    branch_id: estimate ? estimate.branch_id : null,
                    attic_tech_hours: estimate ? estimate.attic_tech_hours : null,
                    cl_estimated_plan_hours: parseFloat(clEstimatedPlanHours) || null,
                    closing_date: parseValidDate(processedData['Finish Date'])
                };

                console.log('🔍 [processRow] Asignando crew leader al job:', {
                    crewLeader: crewLeader ? 'EXISTS' : 'NULL',
                    crewLeaderId: crewLeader ? crewLeader.id : 'NULL',
                    crewLeaderName: crewLeader ? crewLeader.name : 'NULL',
                    jobDataCrewLeaderId: jobData.crew_leader_id,
                    crewLeaderVariable: typeof crewLeader,
                    crewLeaderExists: !!crewLeader
                });

                console.log('📋 [processRow] Datos del job:', {
                    jobName,
                    crewLeaderId: jobData.crew_leader_id,
                    estimateId: jobData.estimate_id,
                    branchId: jobData.branch_id,
                    crewLeaderHours: jobData.crew_leader_hours,
                    clEstimatedPlanHours: jobData.cl_estimated_plan_hours,
                    closingDate: jobData.closing_date
                });

                if (job) {
                    console.log('🔄 [processRow] Actualizando job existente:', job.id);
                    await job.update(jobData, { transaction });
                } else {
                    console.log('🆕 [processRow] Creando nuevo job');
                    job = await Job.create(jobData, { transaction });
                }

                console.log('✅ [processRow] Job procesado:', {
                    jobId: job.id,
                    jobName: job.name,
                    action: job ? 'updated' : 'created'
                });
                
                // Asignar branch al crew leader después de crear el job
                if (crewLeader && job.branch_id) {
                    const existingBranchAssignment = await CrewMemberBranch.findOne({
                        where: {
                            crew_member_id: crewLeader.id,
                            branch_id: job.branch_id
                        },
                        transaction
                    });
                    
                    if (!existingBranchAssignment) {
                        console.log('🏢 [processRow] Asignando branch al crew leader:', {
                            crewLeaderName: crewLeader.name,
                            crewLeaderId: crewLeader.id,
                            branchId: job.branch_id
                        });
                        
                        await CrewMemberBranch.create({
                            crew_member_id: crewLeader.id,
                            branch_id: job.branch_id
                        }, { transaction });
                    }
                }

                // --- Lógica de Shifts Basada en Posición ---
                await Shift.destroy({ where: { job_id: job.id }, transaction });
                await JobSpecialShift.destroy({ where: { job_id: job.id }, transaction });

                const getIndex = (namePart) => {
                    const col = columnMap.find(c => c.field_name.toLowerCase().includes(namePart.toLowerCase()));
                    return col ? col.column_index : -1;
                };

                const techHoursIndex = getIndex('Techs hours');
                const unbillableJobHoursIndex = getIndex('Unbillable Job Hours');
                const jobTotalsIndex = getIndex('Job Totals');

                console.log('🔍 [processRow] Índices de delimitadores:', {
                    techHoursIndex: techHoursIndex,
                    unbillableJobHoursIndex: unbillableJobHoursIndex,
                    jobTotalsIndex: jobTotalsIndex,
                    problemDetected: unbillableJobHoursIndex > jobTotalsIndex,
                    availableColumns: columnMap.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name
                    })).filter(col => col.fieldName.toLowerCase().includes('unbillable') || col.fieldName.toLowerCase().includes('job totals'))
                });

                // Procesar Shifts Regulares
                const regularShiftCols = columnMap.filter(c => c.column_index > techHoursIndex && c.column_index < unbillableJobHoursIndex);
                
                // Eliminar duplicados por índice de columna
                const uniqueRegularShiftCols = [];
                const seenIndices = new Set();
                
                for (const col of regularShiftCols) {
                    if (!seenIndices.has(col.column_index)) {
                        seenIndices.add(col.column_index);
                        uniqueRegularShiftCols.push(col);
                    } else {
                        console.log(`⚠️ [processRow] Columna duplicada ignorada:`, {
                            index: col.column_index,
                            fieldName: col.field_name,
                            reason: 'Índice duplicado'
                        });
                    }
                }
                
                // Debug: Mostrar qué columnas se están procesando
                console.log('🔍 [processRow] Columnas que se procesarán como crew members:', {
                    techHoursIndex: techHoursIndex,
                    unbillableJobHoursIndex: unbillableJobHoursIndex,
                    totalColumns: uniqueRegularShiftCols.length,
                    originalTotalColumns: regularShiftCols.length,
                    columns: uniqueRegularShiftCols.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name,
                        value: processedData[col.field_name] || 'N/A'
                    }))
                });
                const regularShifts = [];
                console.log('👥 [processRow] Procesando crew members regulares:', {
                    totalColumns: uniqueRegularShiftCols.length,
                    techHoursIndex: techHoursIndex,
                    unbillableJobHoursIndex: unbillableJobHoursIndex,
                    columns: uniqueRegularShiftCols.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name
                    }))
                });
                
                for (const col of uniqueRegularShiftCols) {
                    const hours = parseFloat(processedData[col.field_name]);
                    const rawValue = processedData[col.field_name];
                    
                    console.log(`🔍 [processRow] Procesando columna ${col.field_name}:`, {
                        columnIndex: col.column_index,
                        fieldName: col.field_name,
                        rawValue: rawValue,
                        parsedHours: hours,
                        isValidHours: !isNaN(hours) && hours > 0
                    });
                    
                    if (!isNaN(hours) && hours > 0) {
                        // Limpiar emojis del nombre del crew member
                        const cleanCrewMemberName = cleanEmojisFromName(col.field_name);
                        
                        // EXCLUIR al crew leader de la lista de crew members regulares
                        if (cleanCrewMemberName === cleanCrewLeadName) {
                            console.log('🚫 [processRow] Excluyendo crew leader de crew members regulares:', {
                                crewMemberName: cleanCrewMemberName,
                                reason: 'Ya procesado como crew leader'
                            });
                            continue; // Saltar este crew member
                        }
                        
                        console.log('🧹 [processRow] Crew member procesado:', {
                            original: col.field_name,
                            cleaned: cleanCrewMemberName,
                            hours: hours,
                            hasEmojis: cleanCrewMemberName !== col.field_name
                        });

                        // Verificar si esta columna es la columna "Crew Lead"
                        const fieldNameLower = col.field_name.toLowerCase();
                        const isCrewLeadColumn = fieldNameLower.includes('crew lead') || 
                                                fieldNameLower.includes('crew_lead') ||
                                                fieldNameLower.includes('crewleader') ||
                                                fieldNameLower.includes('crew leader') ||
                                                fieldNameLower.includes('leader') ||
                                                fieldNameLower.includes('supervisor');
                        
                        console.log('👑 [processRow] Verificando si es crew lead:', {
                            fieldName: col.field_name,
                            isCrewLeadColumn: isCrewLeadColumn,
                            crewLeadName: cleanCrewLeadName
                        });

                        // Buscar crew member existente, NO crear automáticamente
                        const crewMember = await CrewMember.findOne({ 
                            where: { name: cleanCrewMemberName }, 
                            transaction 
                        });
                        
                        let wasCreated = false;
                        if (!crewMember) {
                            console.log('⚠️ [processRow] Crew Member no encontrado - se requiere aprobación manual:', {
                                suggestedName: cleanCrewMemberName,
                                suggestedHours: hours,
                                action: 'CREATE_CREW_MEMBER'
                            });
                            
                            // Agregar a sugerencias
                            suggestions.missingCrewMembers.push({
                                name: cleanCrewMemberName,
                                type: 'crew_member',
                                suggestedHours: hours,
                                columnIndex: col.column_index,
                                action: 'CREATE_CREW_MEMBER'
                            });
                            suggestions.requiresApproval = true;
                            // Saltar este crew member - será manejado en el frontend
                            continue;
                        }
                        
                        // Asignar branch al crew member (nuevo o existente)
                        if (job.branch_id) {
                            // Verificar si ya tiene esta branch asignada
                            const existingBranchAssignment = await CrewMemberBranch.findOne({
                                where: {
                                    crew_member_id: crewMember.id,
                                    branch_id: job.branch_id
                                },
                                transaction
                            });
                            
                            if (!existingBranchAssignment) {
                                console.log('🏢 [processRow] Asignando branch a crew member:', {
                                    crewMemberName: cleanCrewMemberName,
                                    crewMemberId: crewMember.id,
                                    branchId: job.branch_id,
                                    wasCreated: wasCreated
                                });
                                
                                // Asignar branch al crew member
                                await CrewMemberBranch.create({
                                    crew_member_id: crewMember.id,
                                    branch_id: job.branch_id
                                }, { transaction });
                            } else {
                                console.log('🏢 [processRow] Crew member ya tiene esta branch:', {
                                    crewMemberName: cleanCrewMemberName,
                                    crewMemberId: crewMember.id,
                                    branchId: job.branch_id
                                });
                            }
                        }
                        
                        regularShifts.push({ 
                            job_id: job.id, 
                            crew_member_id: crewMember.id, 
                            hours, 
                            is_leader: isCrewLeadColumn || cleanCrewMemberName === cleanCrewLeadName
                        });
                        
                        console.log('✅ [processRow] Shift creado:', {
                            crewMemberName: cleanCrewMemberName,
                            hours: hours,
                            isLeader: isCrewLeadColumn || cleanCrewMemberName === cleanCrewLeadName,
                            wasCreated: wasCreated
                        });
                    }
                }
                
                if(regularShifts.length > 0) {
                    console.log('✅ [processRow] Creando shifts regulares SUGERIDOS (pendientes de aprobación):', regularShifts.length);
                    
                    // Marcar todos los shifts como NO aprobados (sugeridos)
                    const suggestedShifts = regularShifts.map(shift => ({
                        ...shift,
                        approved_shift: false // Marcar como sugerido, no aprobado
                    }));
                    
                    await Shift.bulkCreate(suggestedShifts, { transaction });
                    
                    // Agregar shifts sugeridos a la respuesta
                    suggestions.suggestedShifts = suggestedShifts.map(shift => ({
                        crewMemberId: shift.crew_member_id,
                        hours: shift.hours,
                        isLeader: shift.is_leader || false,
                        approved: false
                    }));
                    suggestions.requiresApproval = true;
                    
                    // Log detallado de todos los crew members procesados
                    console.log('📋 [processRow] Resumen de crew members procesados:');
                    regularShifts.forEach((shift, index) => {
                        console.log(`  ${index + 1}. Crew Member ID: ${shift.crew_member_id}, Hours: ${shift.hours}, Is Leader: ${shift.is_leader}`);
                    });
                    
                    // Verificar asignaciones de branch para todos los crew members
                    console.log('🏢 [processRow] Verificando asignaciones de branch:');
                    for (const shift of regularShifts) {
                        const branchAssignments = await CrewMemberBranch.findAll({
                            where: { crew_member_id: shift.crew_member_id },
                            include: [{ model: Branch, as: 'branch' }],
                            transaction
                        });
                        
                        console.log(`  Crew Member ID ${shift.crew_member_id}: ${branchAssignments.length} branches asignadas`);
                        branchAssignments.forEach(assignment => {
                            console.log(`    - Branch ID: ${assignment.branch_id}, Name: ${assignment.branch?.name || 'N/A'}`);
                        });
                    }
                } else {
                    console.log('⚠️ [processRow] No se encontraron shifts regulares para procesar');
                }

                // Crear shift para el crew leader si tiene horas
                if (crewLeader && crewLeaderHours > 0) {
                    console.log('👑 [processRow] Creando shift para crew leader:', {
                        crewLeaderName: crewLeader.name,
                        crewLeaderId: crewLeader.id,
                        hours: crewLeaderHours
                    });
                    
                    await Shift.create({
                        job_id: job.id,
                        crew_member_id: crewLeader.id,
                        hours: crewLeaderHours,
                        is_leader: true,
                        approved_shift: false, // Marcar como sugerido, no aprobado
                        date: new Date()
                    }, { transaction });
                    
                    console.log('✅ [processRow] Shift del crew leader creado exitosamente');
                } else if (crewLeader) {
                    console.log('⚠️ [processRow] Crew leader no tiene horas asignadas:', {
                        crewLeaderName: crewLeader.name,
                        crewLeaderHours: crewLeaderHours
                    });
                }

                // Procesar Shifts Especiales
                // Si unbillableJobHoursIndex > jobTotalsIndex, hay un problema en el mapeo
                // En este caso, buscaremos columnas específicas que sabemos que son Special Shifts
                let specialShiftCols = [];
                
                if (unbillableJobHoursIndex > jobTotalsIndex || unbillableJobHoursIndex === -1) {
                    console.log('⚠️ [processRow] Problema detectado con índices de delimitadores, usando búsqueda específica');
                    // Buscar columnas específicas que sabemos que son Special Shifts
                    const specialShiftNames = ['QC', 'Visit 1', 'Visit 2', 'Visit 3', 'Complaint / warranty calls hours', 'Job Delivery'];
                    specialShiftCols = columnMap.filter(c => 
                        specialShiftNames.some(name => 
                            c.field_name.toLowerCase().includes(name.toLowerCase()) ||
                            c.field_name.toLowerCase() === name.toLowerCase()
                        )
                    );
                } else {
                    // Lógica original
                    specialShiftCols = columnMap.filter(c => c.column_index > unbillableJobHoursIndex && c.column_index < jobTotalsIndex);
                }
                
                console.log('🔍 [processRow] Procesando Special Shifts:', {
                    unbillableJobHoursIndex: unbillableJobHoursIndex,
                    jobTotalsIndex: jobTotalsIndex,
                    totalSpecialColumns: specialShiftCols.length,
                    specialColumns: specialShiftCols.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name,
                        value: processedData[col.field_name] || 'N/A'
                    }))
                });
                
                const specialShifts = [];
                for (const col of specialShiftCols) {
                    const rawValue = processedData[col.field_name];
                    const hours = parseFloat(rawValue);
                    
                    console.log('🔍 [processRow] Procesando Special Shift:', {
                        columnIndex: col.column_index,
                        fieldName: col.field_name,
                        rawValue: rawValue,
                        parsedHours: hours,
                        isValidHours: !isNaN(hours) && hours > 0
                    });
                    
                    if (!isNaN(hours) && hours > 0) {
                        console.log('✅ [processRow] Creando Special Shift:', {
                            fieldName: col.field_name,
                            hours: hours
                        });
                        
                        const [specialShift] = await SpecialShift.findOrCreate({ where: { name: col.field_name }, defaults: { name: col.field_name }, transaction });
                        specialShifts.push({ job_id: job.id, special_shift_id: specialShift.id, hours, date: new Date() });
                    }
                }
                
                if(specialShifts.length > 0) {
                    console.log('✅ [processRow] Creando Special Shifts:', specialShifts.length);
                    await JobSpecialShift.bulkCreate(specialShifts, { transaction });
                } else {
                    console.log('⚠️ [processRow] No se encontraron Special Shifts válidos para procesar');
                }

                // --- INICIO: Lógica de Notificación al Crew Leader ---
                if (crewLeader && crewLeader.telegram_id) {
                    const performanceData = await calculateJobPerformance(job.id);
                    const template = await NotificationTemplate.findOne({ where: { name: 'job_closed_summary' }, transaction });

                    if (template) {
                        let message = template.template_text
                            .replace('{{job_name}}', job.name)
                            .replace('{{crew_leader_name}}', crewLeader.name)
                            .replace('{{cl_plan_hours}}', performanceData.clPlanHours.toFixed(2))
                            .replace('{{actual_saved_percent}}', `${(performanceData.actualSavedPercent * 100).toFixed(2)}%`)
                            .replace('{{potential_bonus_pool}}', performanceData.potentialBonusPool.toFixed(2))
                            .replace('{{actual_bonus_pool}}', performanceData.jobBonusPool.toFixed(2));

                        await Notification.create({
                            message: message,
                            recipient_type: 'crew_leader',
                            recipient_id: crewLeader.id,
                            // Asumiendo que el notification_type_id para 'manager_alert' es 3
                            notification_type_id: template.notification_type_id 
                        }, { transaction });

                        logger.info(`Notification created for Crew Leader ${crewLeader.name} for job ${job.name}`);
                    } else {
                        logger.warn('Notification template "job_closed_summary" not found.');
                    }
                }
                // --- FIN: Lógica de Notificación ---

                console.log('💾 [processRow] Commit de transacción exitoso');
                await transaction.commit();
                
                // --- Lógica de Notificación Inmediata ---
                let notificationPayload = null;
                try {
                    const finalJob = await Job.findByPk(job.id, {
                        include: [
                            { model: Branch, as: 'branch' },
                            { model: CrewMember, as: 'crewLeader' }
                        ]
                    });

                    if (finalJob) {
                        const performance = await calculateJobPerformance(finalJob.id);
                        // Solo notificar jobs con % Actual Saved negativo (menor a 0%)
                        const lowPerformanceThreshold = 0.0;

                        if (performance.actualSavedPercent < lowPerformanceThreshold) {
                            const crewLeaderName = finalJob.crewLeader?.name || 'Unknown Leader';
                            const jobString = `${crewLeaderName}: planned to save ${(performance.plannedToSavePercent * 100).toFixed(0)}% | Actual saved ${(performance.actualSavedPercent * 100).toFixed(0)}%`;
                            
                            // Si el % Actual Saved es extremadamente negativo (< -100%), es un error de datos
                            // Enviar notificación al ID especial para errores de sistema
                            const isUnrealisticValue = performance.actualSavedPercent < -1.0; // Menor a -100%
                            
                            if (isUnrealisticValue) {
                                notificationPayload = {
                                    branch_telegram_id: "1940630658", // ID especial para errores de sistema
                                    job_string: `⚠️ ERROR DE DATOS - ${jobString}`,
                                    actual_saved_percent: performance.actualSavedPercent,
                                    error_type: "unrealistic_performance",
                                    branch_name: finalJob.branch?.name || 'Unknown Branch'
                                };
                                logger.warn(`[processRow] Unrealistic performance value detected for job ${finalJob.name}. Routing to system admin.`);
                            } else if (finalJob.branch && finalJob.branch.telegram_group_id) {
                                notificationPayload = {
                                    branch_telegram_id: finalJob.branch.telegram_group_id,
                                    job_string: jobString,
                                    actual_saved_percent: performance.actualSavedPercent
                                };
                                logger.info(`[processRow] Low performance detected for job ${finalJob.name}. Payload generated.`);
                            }
                        }
                    }
                } catch (perfError) {
                    logger.error(`[processRow] Error generating notification payload for job ${job.id}: ${perfError.message}`);
                    // No detenemos la respuesta principal por un error en la notificación
                }

                // Invalidar cache de crew members para refrescar los datos en el frontend
                console.log('🔄 [processRow] Invalidando cache de crew members');
                caches.lists.invalidateEntity('crew_member', crewLeader?.id);
                regularShifts.forEach(shift => {
                    caches.lists.invalidateEntity('crew_member', shift.crew_member_id);
                });
                caches.lists.deletePattern('.*crew.*member.*');
                caches.lists.deletePattern('.*crew.*members.*');

                // Obtener el telegram_group_id del branch para notificaciones en vivo
                let branchTelegramId = null;
                if (job.branch_id) {
                    const jobWithBranch = await Job.findByPk(job.id, {
                        include: [{ model: Branch, as: 'branch', attributes: ['telegram_group_id'] }]
                    });
                    branchTelegramId = jobWithBranch?.branch?.telegram_group_id || null;
                    
                    console.log('📱 [processRow] Branch Telegram ID obtenido:', {
                        branchId: job.branch_id,
                        branchTelegramId: branchTelegramId,
                        jobName: jobName
                    });
                }

                const response = {
                    success: true,
                    message: suggestions.requiresApproval 
                        ? `Fila ${row_number} procesada con sugerencias pendientes de aprobación. Job "${jobName}" ha sido ${job ? 'actualizado' : 'creado'}.`
                        : `Fila ${row_number} procesada exitosamente. Job "${jobName}" ha sido ${job ? 'actualizado' : 'creado'}.`,
                    jobId: job.id,
                    jobName: job.name,
                    branchTelegramId: branchTelegramId, // Nuevo campo para notificaciones en vivo
                    notificationPayload, // Se añade el payload aquí
                    sheet_name,
                    row_number,
                    // Información de sugerencias y aprobaciones pendientes
                    suggestions: suggestions,
                    requiresApproval: suggestions.requiresApproval,
                    crewLeader: crewLeader ? {
                        id: crewLeader.id,
                        name: crewLeader.name
                    } : null,
                    estimate: estimate ? {
                        id: estimate.id,
                        name: estimate.name
                    } : null,
                    crewMembers: regularShifts.map(shift => ({
                        id: shift.crew_member_id,
                        hours: shift.hours,
                        isLeader: shift.is_leader
                    })),
                    totalCrewMembers: regularShifts.length,
                    crewLeadersCount: regularShifts.filter(shift => shift.is_leader).length
                };

                console.log('✅ [processRow] Respuesta exitosa:', response);
                res.status(200).json(response);

            } catch (error) {
                console.log('❌ [processRow] Error en transacción:', {
                    error: error.message,
                    stack: error.stack
                });
                await transaction.rollback();
                logger.error('Error in processRow transaction', {
                    sheet_name,
                    row_number,
                    error: error.message,
                    stack: error.stack
                });
                res.status(500).json({
                    success: false,
                    message: 'Internal server error during database transaction.',
                    error: error.message,
                    sheet_name,
                    row_number
                });
            }

        } catch (error) {
            console.log('❌ [processRow] Error general:', {
                error: error.message,
                stack: error.stack
            });
            logger.error('Error in processRow', { 
                sheet_name,
                row_number,
                error: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: error.message,
                sheet_name,
                row_number
            });
        }
    }

    async processJobNotifications(req, res) {
        const { dryRun } = req.query;
        const isDryRun = dryRun === 'true'; // Convertir a booleano una sola vez

        const transaction = await sequelize.transaction();
        let processedCount = 0;
        const lowPerformingJobsByBranch = {}; // Objeto para agrupar trabajos

        try {
            const pendingJobs = await Job.findAll({
                where: { notification_sent: false },
                include: [{ 
                    model: CrewMember, 
                    as: 'crewLeader',
                    required: false 
                },
                {
                    model: Branch,
                    as: 'branch',
                    required: true // Solo procesar jobs que pertenezcan a una branch
                }
                ],
                transaction
            });

            if (pendingJobs.length === 0) {
                await transaction.commit();
                return res.status(200).json({ success: true, message: 'No pending jobs to process.', data: [] });
            }
            
            // Solo procesar jobs con % Actual Saved negativo (menor a 0%)
            const lowPerformanceThreshold = 0.0;

            for (const job of pendingJobs) {
                const performance = await calculateJobPerformance(job.id);
                const { actualSavedPercent, plannedToSavePercent } = performance;

                // Solo procesar trabajos con mal rendimiento (% Actual Saved negativo)
                if (actualSavedPercent < lowPerformanceThreshold) {
                    const branch = job.branch;
                    const crewLeaderName = job.crewLeader?.name || 'Unknown Leader';
                    const jobString = `${crewLeaderName}: planned to save ${(plannedToSavePercent * 100).toFixed(0)}% | Actual saved ${(actualSavedPercent * 100).toFixed(0)}%`;
                    
                    // Si el % Actual Saved es extremadamente negativo (< -100%), es un error de datos
                    const isUnrealisticValue = actualSavedPercent < -1.0; // Menor a -100%
                    
                    if (isUnrealisticValue) {
                        // Enviar al ID especial para errores de sistema
                        const systemErrorKey = 'system_error';
                        if (!lowPerformingJobsByBranch[systemErrorKey]) {
                            lowPerformingJobsByBranch[systemErrorKey] = {
                                branch_telegram_id: "1940630658",
                                jobs: []
                            };
                        }
                        lowPerformingJobsByBranch[systemErrorKey].jobs.push(`⚠️ ERROR DE DATOS - ${jobString} (Branch: ${branch?.name || 'Unknown'})`);
                    } else if (branch && branch.telegram_group_id) {
                        // Procesamiento normal para valores realistas
                        if (!lowPerformingJobsByBranch[branch.id]) {
                            lowPerformingJobsByBranch[branch.id] = {
                                branch_telegram_id: branch.telegram_group_id,
                                jobs: []
                            };
                        }
                        lowPerformingJobsByBranch[branch.id].jobs.push(jobString);
                    }
                }

                // Marcar el trabajo como procesado para no volver a tomarlo
                if (!isDryRun) {
                    job.notification_sent = true;
                    await job.save({ transaction });
                }
                    processedCount++;
            }

            await transaction.commit();
            
            // Convertir el objeto a un array como se solicitó
            const finalPayload = Object.values(lowPerformingJobsByBranch);

            const message = `Processed ${processedCount} jobs. Found ${finalPayload.length} branches with low-performing jobs.`;
            logger.info(message);
            
            res.status(200).json({ success: true, message, data: finalPayload });

        } catch (error) {
            await transaction.rollback();
            logger.error('Error processing job notifications:', error);
            res.status(500).json({ success: false, message: 'Server error while processing notifications.' });
        }
    }

    async sendDailySummary(req, res) {
        const { dryRun } = req.query;
        const isDryRun = dryRun === 'true';
        const transaction = await sequelize.transaction();
        const notificationPayloads = [];

        try {
            // Solo procesar jobs con % Actual Saved negativo (menor a 0%)
            const lowPerformanceThreshold = 0.0;

            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);

            const recentJobs = await Job.findAll({
                where: {
                    closing_date: { [Op.gte]: yesterday }
                },
                include: [{ model: Branch, as: 'branch', required: true, where: { telegram_group_id: { [Op.ne]: null } } }],
                transaction
            });

            const lowPerformingJobs = [];
            for (const job of recentJobs) {
                const performance = await calculateJobPerformance(job.id);
                if (performance.actualSavedPercent < lowPerformanceThreshold) {
                    lowPerformingJobs.push({ job, performance });
                }
            }

            if (lowPerformingJobs.length === 0) {
                await transaction.commit();
                return res.status(200).json({ success: true, message: 'No low-performing jobs in the last 24 hours for branches with configured Telegram groups.', notifications: [] });
            }

            // Agrupar por sucursal
            const jobsByBranch = lowPerformingJobs.reduce((acc, { job, performance }) => {
                const branchName = job.branch.name || 'Sin Sucursal';
                if (!acc[branchName]) {
                    acc[branchName] = {
                        telegram_group_id: job.branch.telegram_group_id,
                        jobs: []
                    };
                }
                acc[branchName].jobs.push({ job, performance });
                return acc;
            }, {});

            const [summaryTemplate] = await NotificationTemplate.findOrCreate({
                where: { name: 'manager_daily_summary' },
                defaults: {
                    name: 'manager_daily_summary',
                    template_text: "**Resumen Diario de Trabajos con Bajo Rendimiento**\n\n{{branch_summary}}"
                },
                transaction
            });
            
            // Crear y enviar un resumen para cada sucursal
            for (const branchName in jobsByBranch) {
                const branchData = jobsByBranch[branchName];
                if (!branchData.telegram_group_id && !isDryRun) continue;

                let branchSummary = `**📍 Sucursal: ${branchName}**\n`;
                branchData.jobs.forEach(({ job, performance }) => {
                    branchSummary += `- *${job.name}*: ${ (performance.actualSavedPercent * 100).toFixed(2)}% horas ahorradas\n`;
                });

                const finalMessage = summaryTemplate.template_text.replace('{{branch_summary}}', branchSummary);

                notificationPayloads.push({
                    telegram_id: branchData.telegram_group_id || `DRY_RUN_ID_FOR_${branchName}`,
                    message: finalMessage,
                    jobs_data: branchData.jobs.map(({ job, performance }) => ({ id: job.id, name: job.name, ...performance }))
                });
            }

            await transaction.commit();
            
            res.status(200).json({
                success: true,
                message: `Daily summary generated for ${Object.keys(jobsByBranch).length} branches.`,
                notifications: notificationPayloads
            });

        } catch (error) {
            await transaction.rollback();
            logger.error('Error sending daily summary:', error);
            res.status(500).json({ success: false, message: 'Server error while generating daily summary.' });
        }
    }


    async debugColumnMapping(req, res) {
        try {
            const { sheet_name } = req.query;
            
            if (!sheet_name) {
                return res.status(400).json({
                    success: false,
                    message: 'sheet_name parameter is required'
                });
            }

            console.log(`🔍 [debugColumnMapping] Verificando mapeo para sheet: ${sheet_name}`);
            
            const columnMap = await SheetColumnMap.findAll({
                where: { sheet_name },
                order: [['column_index', 'ASC']]
            });

            console.log(`📋 [debugColumnMapping] Mapeo encontrado:`, {
                sheetName: sheet_name,
                totalColumns: columnMap.length,
                lastUpdated: columnMap.length > 0 ? columnMap[0].updatedAt : 'N/A'
            });

            // Buscar columnas relacionadas con crew/lead
            const crewRelatedColumns = columnMap.filter(col => 
                col.field_name.toLowerCase().includes('crew') || 
                col.field_name.toLowerCase().includes('lead') ||
                col.header_name.toLowerCase().includes('crew') ||
                col.header_name.toLowerCase().includes('lead')
            );

            res.status(200).json({
                success: true,
                message: `Column mapping for sheet "${sheet_name}"`,
                data: {
                    sheetName: sheet_name,
                    totalColumns: columnMap.length,
                    lastUpdated: columnMap.length > 0 ? columnMap[0].updatedAt : null,
                    allColumns: columnMap.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name,
                        headerName: col.header_name
                    })),
                    crewRelatedColumns: crewRelatedColumns.map(col => ({
                        index: col.column_index,
                        fieldName: col.field_name,
                        headerName: col.header_name
                    }))
                }
            });

        } catch (error) {
            logger.error('Error debugging column mapping:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error while checking column mapping.' 
            });
        }
    }

    async fixDuplicateColumnMapping(req, res) {
        try {
            const { sheet_name } = req.query;
            
            if (!sheet_name) {
                return res.status(400).json({
                    success: false,
                    message: 'sheet_name parameter is required'
                });
            }

            console.log(`🔧 [fixDuplicateColumnMapping] Arreglando duplicados para sheet: ${sheet_name}`);
            
            const transaction = await sequelize.transaction();
            
            try {
                // Obtener todas las columnas del sheet
                const columnMap = await SheetColumnMap.findAll({
                    where: { sheet_name },
                    order: [['column_index', 'ASC'], ['id', 'ASC']],
                    transaction
                });

                console.log(`📋 [fixDuplicateColumnMapping] Columnas encontradas: ${columnMap.length}`);

                // Encontrar duplicados por índice
                const seenIndices = new Set();
                const duplicatesToDelete = [];

                for (const col of columnMap) {
                    if (seenIndices.has(col.column_index)) {
                        duplicatesToDelete.push(col);
                        console.log(`🗑️ [fixDuplicateColumnMapping] Marcando para eliminar:`, {
                            id: col.id,
                            index: col.column_index,
                            fieldName: col.field_name
                        });
                    } else {
                        seenIndices.add(col.column_index);
                    }
                }

                // Eliminar duplicados
                let deletedCount = 0;
                for (const duplicate of duplicatesToDelete) {
                    await duplicate.destroy({ transaction });
                    deletedCount++;
                }

                await transaction.commit();

                console.log(`✅ [fixDuplicateColumnMapping] Deleted ${deletedCount} duplicates`);

                res.status(200).json({
                    success: true,
                    message: `Duplicates removed for sheet "${sheet_name}"`,
                    data: {
                        sheetName: sheet_name,
                        totalColumnsBefore: columnMap.length,
                        totalColumnsAfter: columnMap.length - deletedCount,
                        deletedCount: deletedCount,
                        deletedColumns: duplicatesToDelete.map(col => ({
                            id: col.id,
                            index: col.column_index,
                            fieldName: col.field_name
                        }))
                    }
                });

            } catch (error) {
                await transaction.rollback();
                throw error;
            }

        } catch (error) {
            logger.error('Error fixing duplicate column mapping:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Internal server error while fixing column mapping.' 
            });
        }
    }

    /**
     * Sincroniza los reportes de inspección desde Attic Tech
     * @param {Object} req - Express request object
     * @param {Object} res - Express response object
     */
    async syncInspectionReports(req, res) {
        try {
            logger.info('Iniciando sincronización de reportes de inspección');

            // 1. Obtener token de AT
            const token = await loginToAtticTech();
            if (!token) {
                throw new Error('No se pudo obtener el token de Attic Tech');
            }

            // Obtener la fecha de inicio de HOY (00:00:00) para buscar solo los de hoy.
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const todayISO = today.toISOString();
        
            logger.info('Buscando reportes creados después de:', {
                date: todayISO,
                humanReadable: today.toString()
            });

            // 3. Hacer la petición a AT para obtener los reportes del día
            const options = {
                hostname: 'www.attic-tech.com',
                path: `/api/inspection-reports?depth=2&limit=100&where[createdAt][greater_than]=${encodeURIComponent(todayISO)}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'User-Agent': 'BotZilla Sync Script'
                }
            };

            const reports = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(new Error(`Error parseando la respuesta JSON: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`La solicitud falló: ${res.statusCode} - ${data}`));
                        }
                    });
                });
                req.on('error', (e) => reject(e));
                req.end();
            });

            // Log detallado de la estructura de los reportes
            logger.info('Estructura de reportes:', {
                isArray: Array.isArray(reports),
                hasData: !!reports?.data,
                responseType: typeof reports,
                responseKeys: reports ? Object.keys(reports) : [],
                firstReport: reports?.docs?.[0] ? {
                    id: reports.docs[0].id,
                    fields: Object.keys(reports.docs[0]),
                    jobEstimate: reports.docs[0].jobEstimate ? {
                        id: reports.docs[0].jobEstimate.id,
                        fields: Object.keys(reports.docs[0].jobEstimate)
                    } : null,
                    inspectionData: reports.docs[0].inspectionData ? {
                        fields: Object.keys(reports.docs[0].inspectionData)
                    } : null
                } : null
            });

            // Asegurarnos de que reports sea un array
            const reportsArray = Array.isArray(reports) ? reports : reports.docs || [];
            
            logger.info(`Encontrados ${reportsArray.length} reportes en la API de Attic Tech.`);

            const notificationResults = [];

            for (const report of reportsArray) {
                // DEBUGGING ESPECÍFICO PARA KYLE CIEPLY
                if (report.jobEstimate?.name === 'Kyle Cieply - LA') {
                    logger.warn('--- DEBUGGING Kyle Cieply - LA ---');
                    logger.warn('Raw Report Object from AT API:', {
                        fullReportObject: JSON.stringify(report, null, 2) // Convertido a JSON para ver todo
                    });
                    logger.warn('------------------------------------');
                }

                try {
                    // Paso 1: Guardar o encontrar el reporte en nuestra BD
                    const [dbReport, created] = await InspectionReport.findOrCreate({
                        where: { attic_tech_report_id: report.id },
                        defaults: {
                            attic_tech_report_id: report.id,
                            attic_tech_estimate_id: report.jobEstimate?.id,
                            estimate_name: report.jobEstimate?.name,
                            salesperson_name: report.jobEstimate?.user?.name,
                            salesperson_email: report.jobEstimate?.user?.email,
                            client_name: report.jobEstimate?.client?.fullName,
                            client_phone: report.jobEstimate?.client?.phone,
                            client_email: report.jobEstimate?.client?.email,
                            client_address: report.jobEstimate?.property?.address,
                            branch_name: report.jobEstimate?.branch?.name,
                            estimate_link: `https://www.attic-tech.com/calculator?jobId=${report.jobEstimate?.id}&page=viewInspectionReport`,
                            roof_material: report.roofMaterial,
                            decking_type: report.roofDeckingType,
                            roof_age: report.roofAge,
                            walkable_roof: report.roofWalkable,
                            roof_condition: report.roofCondition,
                            full_roof_inspection_interest: parseBoolean(report.roofInspectionInterest), // Usar valor parseado
                            
                            customer_comfort: report.hvacComfortLevel,
                            hvac_age: report.hvacAge,
                            system_condition: report.hvacSystemCondition,
                            air_ducts_condition: report.airDuctCondition,
                            full_hvac_furnace_inspection_interest: parseBoolean(report.hvacInspectionInterest), // Usar valor parseado
                            
                            attic_tech_created_at: report.createdAt
                        }
                    });

                    if(created) {
                        logger.info(`Nuevo reporte [ID: ${report.id}] guardado en la base de datos.`);
                    }

                    // Paso 2: Evaluar y generar notificaciones
                    const baseNotificationPayload = {
                        job_name: dbReport.estimate_name,
                        cx_name: dbReport.client_name,
                        cx_phone: dbReport.client_phone,
                        job_address: dbReport.client_address,
                        branch: dbReport.branch_name,
                        salesperson_name: dbReport.salesperson_name,
                        client_email: dbReport.client_email,
                        estimate_link: dbReport.estimate_link,
                    };
        
                    let changesMade = false;
                    
                    // --- Evaluar ROOFING de forma independiente ---
                    let roofNotificationType = null;
                    const hasRoofInterest = parseBoolean(report.roofInspectionInterest);
                    if (hasRoofInterest) {
                        roofNotificationType = 'New Roofing Inspection Request';
                    } else if (report.roofCondition && ['needs_replacement'].includes(report.roofCondition)) {
                        roofNotificationType = 'New Roofing Potential Lead';
                    }

                    if (roofNotificationType && !dbReport.roof_notification_sent) {
                        notificationResults.push({
                            ...baseNotificationPayload,
                            service_type: 'Roofing',
                            notification_type: roofNotificationType
                        });
                        dbReport.roof_notification_sent = true;
                        changesMade = true;
                        logger.info(`Reporte [ID: ${report.id}] marcado para notificación de ROOFING. Tipo: ${roofNotificationType}`);
                    }

                    // --- Evaluar HVAC de forma independiente ---
                    let hvacNotificationType = null;
                    const hasHvacInterest = parseBoolean(report.hvacInspectionInterest);
                    if (hasHvacInterest) {
                        hvacNotificationType = 'New HVAC Inspection Request';
                    } else if (report.hvacSystemCondition && ['needs_replacement'].includes(report.hvacSystemCondition)) {
                        hvacNotificationType = 'New HVAC Potential Lead';
                    }
                    
                    if (hvacNotificationType && !dbReport.hvac_notification_sent) {
                        notificationResults.push({
                            ...baseNotificationPayload,
                            service_type: 'HVAC',
                            notification_type: hvacNotificationType
                        });
                        dbReport.hvac_notification_sent = true;
                        changesMade = true;
                        logger.info(`Reporte [ID: ${report.id}] marcado para notificación de HVAC. Tipo: ${hvacNotificationType}`);
                    }
                    
                    // --- Guardar si se hizo algún cambio ---
                    if (changesMade) {
                        await dbReport.save();
                    }
        
                } catch (error) {
                    logger.error('Error procesando reporte individual:', {
                        report_id: report.id,
                        error: error.message,
                        stack: error.stack
                    });
                }
            }
            
            // 6. Enviar respuesta y registrar la finalización
            const responseMessage = `Sincronización completada. ${notificationResults.length} notificaciones pendientes.`;
            logger.info(responseMessage, { notificationCount: notificationResults.length });

            res.status(200).json({
                success: true,
                message: responseMessage,
                notifications: notificationResults
            });
        
        } catch (error) {
            logger.error('Error en sincronización de reportes', {
                error: error.message,
                stack: error.stack
            });
            res.status(500).json({
                success: false,
                message: 'Error durante la sincronización de reportes',
                error: error.message
            });
        }
    }
}

// Exportar tanto la clase como la función helper
module.exports = {
    AutomationsController: new AutomationsController(),
    findOrCreateSalesPerson
};
