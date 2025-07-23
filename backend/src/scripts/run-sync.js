require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');
const sequelize = require('../config/database');
const { SalesPerson, Branch, EstimateStatus, Estimate, SalesPersonBranch } = require('../models');

// --- Configuración de la Sincronización ---
const config = {
    fechaInicio: '2025-07-16',
    fechaFin: '2025-07-18',
    sucursalObjetivo: 'San Diego', 
    limiteResultados: 1
};
// -----------------------------------------

// --- Lógica de Attic Tech ---
async function loginToAtticTech(logMessages) {
    logMessages.push('🔑 Iniciando sesión en Attic Tech...');
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    if (!API_USER_EMAIL || !API_USER_PASSWORD) throw new Error('ATTIC_TECH_EMAIL y ATTIC_TECH_PASSWORD deben estar en las variables de entorno');
    
    const loginData = JSON.stringify({ email: API_USER_EMAIL, password: API_USER_PASSWORD });
    const options = { hostname: 'www.attic-tech.com', path: '/api/users/login', method: 'POST', headers: { 'Content-Type': 'application/json', 'Accept': 'application/json', 'Content-Length': Buffer.byteLength(loginData), 'User-Agent': 'BotZilla Sync Script' } };

    return new Promise((resolve, reject) => {
        const req = https.request(options, res => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const response = JSON.parse(data);
                    logMessages.push('✅ Sesión iniciada correctamente.');
                    resolve(response.token);
                } else {
                    reject(new Error(`Fallo en el inicio de sesión: ${res.statusCode}`));
                }
            });
        });
        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

async function fetchAllEstimatesFromAtticTech(apiKey, fechaInicio, fechaFin, logMessages) {
    let allLeads = [], page = 1, hasMore = true;
    logMessages.push(`📊 Obteniendo estimates desde ${fechaInicio} hasta ${fechaFin}`);

    while (hasMore) {
        let queryString = `limit=100&page=${page}&depth=2&sort=-updatedAt&where[createdAt][greater_than_equal]=${encodeURIComponent(fechaInicio)}&where[createdAt][less_than_equal]=${encodeURIComponent(fechaFin)}`;
        const options = { hostname: 'www.attic-tech.com', path: `/api/job-estimates?${queryString}`, method: 'GET', headers: { 'Authorization': `Bearer ${apiKey}`, 'Accept': 'application/json' } };

        try {
            const result = await new Promise((resolve, reject) => {
                https.get(options, res => {
                    let data = '';
                    res.on('data', chunk => data += chunk);
                    res.on('end', () => res.statusCode === 200 ? resolve(JSON.parse(data)) : reject(new Error(`Error API: ${res.statusCode}`)));
                }).on('error', reject);
            });
            if (result.docs && result.docs.length > 0) {
                allLeads = allLeads.concat(result.docs);
                logMessages.push(`📄 Página ${page} obtenida: ${result.docs.length} estimates.`);
            }
            hasMore = result.hasNextPage && result.docs.length > 0;
            page++;
        } catch (error) {
            logMessages.push(`❌ Error obteniendo la página ${page}: ${error.message}`);
            hasMore = false;
        }
    }
    logMessages.push(`✅ Total de estimates obtenidos: ${allLeads.length}`);
    return allLeads;
}

// --- Lógica de Procesamiento ---
function mapAtticTechDataToEstimates(leads) {
    return leads.map(lead => {
        const customerName = (lead.customer_info?.firstName || lead.customer_info?.lastName)
            ? `${lead.customer_info.firstName || ''} ${lead.customer_info.lastName || ''}`.trim()
            : null;

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
            final_price: lead.final_price,
            sub_service_retail_cost: lead.sub_services_retail_cost,
            discount: lead.discount_provided,
            attic_tech_hours: lead.labor_hours,
            customer_name: customerName,
            customer_address: lead.address,
            crew_notes: lead.crew_notes
        };
    });
}

async function findOrCreateBranch(name, logMessages) {
    const [branch, created] = await Branch.findOrCreate({
        where: { name: name },
        defaults: { name: name }
    });
    if (created) {
        logMessages.push(`➕ CREADO: Sucursal ${name}`);
    } else {
        logMessages.push(`🔄 EXISTENTE: Sucursal ${name}`);
    }
    return branch;
}

async function findOrCreateSalesPerson(name, branchName, logMessages) {
    const [salesPerson, created] = await SalesPerson.findOrCreate({
        where: { name: name },
        defaults: { name: name, branch_id: (await findOrCreateBranch(branchName, logMessages)).id }
    });
    if (created) {
        logMessages.push(`➕ CREADO: Vendedor ${name}`);
    } else {
        logMessages.push(`🔄 EXISTENTE: Vendedor ${name}`);
    }
    return salesPerson;
}

async function findOrCreateEstimateStatus(name, logMessages) {
    const [status, created] = await EstimateStatus.findOrCreate({
        where: { name: name },
        defaults: { name: name }
    });
    if (created) {
        logMessages.push(`➕ CREADO: Estado de Estimación ${name}`);
    } else {
        logMessages.push(`🔄 EXISTENTE: Estado de Estimación ${name}`);
    }
    return status;
}

// --- Script Principal ---
async function runSync() {
    const logMessages = [];
    const stats = { inserted: 0, updated: 0, errors: 0, skipped: 0 };

    console.log("--- Iniciando Script de Sincronización de Estimates ---");

    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida.');

        const apiKey = await loginToAtticTech(logMessages);
        
        const rawLeads = await fetchAllEstimatesFromAtticTech(apiKey, config.fechaInicio, config.fechaFin, logMessages);
        
        let estimatesToProcess = mapAtticTechDataToEstimates(rawLeads);
        
        if (config.sucursalObjetivo) {
            estimatesToProcess = estimatesToProcess.filter(e => e.branchName === config.sucursalObjetivo);
        }
        if (config.limiteResultados) {
            estimatesToProcess = estimatesToProcess.slice(0, config.limiteResultados);
        }
        
        logMessages.push(`🔄 Procesando ${estimatesToProcess.length} estimates...`);

        for (const estimateData of estimatesToProcess) {
             try {
                if (!estimateData.attic_tech_estimate_id) {
                    logMessages.push(`⚠️ Saltado: Estimate sin ID de Attic Tech (${estimateData.name})`);
                    stats.skipped++;
                    continue;
                }

                const branch = await findOrCreateBranch(estimateData.branchName, logMessages);
                const salesPerson = await findOrCreateSalesPerson(estimateData.salespersonName, estimateData.branchName, logMessages);
                const status = await findOrCreateEstimateStatus(estimateData.status, logMessages);

                const estimatePayload = {
                    attic_tech_estimate_id: estimateData.attic_tech_estimate_id,
                    name: estimateData.name,
                    atCreatedDate: estimateData.atCreatedDate,
                    atUpdatedDate: estimateData.atUpdatedDate,
                    customer_name: estimateData.customer_name,
                    customer_address: estimateData.customer_address,
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
                };
                
                const [_, created] = await Estimate.findOrCreate({
                    where: { attic_tech_estimate_id: estimatePayload.attic_tech_estimate_id },
                    defaults: estimatePayload
                });

                if (created) {
                    stats.inserted++;
                    logMessages.push(`➕ CREADO: ${estimatePayload.name}`);
                } else {
                    await Estimate.update(estimatePayload, { where: { attic_tech_estimate_id: estimatePayload.attic_tech_estimate_id } });
                    stats.updated++;
                    logMessages.push(`🔄 ACTUALIZADO: ${estimatePayload.name}`);
                }

            } catch (dbError) {
                stats.errors++;
                logMessages.push(`❌ ERROR procesando ${estimateData.name}: ${dbError.message}`);
            }
        }
        
        const summary = `Resultados: ${stats.inserted} creados, ${stats.updated} actualizados, ${stats.errors} errores, ${stats.skipped} saltados.`;
        console.log(`\n--- Sincronización Finalizada ---`);
        console.log(summary);
        
    } catch (error) {
        console.error(`\n🔥 ERROR CRÍTICO: ${error.message}`);
    } finally {
        await sequelize.close();
        console.log('🔌 Conexión a la base de datos cerrada.');
        
        console.log('\n--- Logs Detallados ---');
        logMessages.forEach(log => console.log(log));
        console.log('---------------------');
    }
}

runSync(); 