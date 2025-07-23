const https = require('https');
const { Op } = require('sequelize');
const { SalesPerson, Branch, EstimateStatus, Estimate, SalesPersonBranch } = require('../models');
require('dotenv').config();

// --- Lógica de Sincronización (se ejecutará en segundo plano) ---

async function runSync() {
    const logMessages = [];
    try {
        logMessages.push('🚀 Starting external estimates synchronization...');
        console.log('🚀 Starting external estimates synchronization...');

        const apiKey = await loginToAtticTech(logMessages);

        // Fecha de inicio fija, como se requirió.
        const startDate = '2025-06-15'; 
        const endDate = new Date().toISOString().split('T')[0];

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

async function loginToAtticTech(logMessages = []) {
    logMessages.push('🔑 Starting dynamic API login to Attic Tech...');
    
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    
    if (!API_USER_EMAIL || !API_USER_PASSWORD) {
        const errorMsg = `ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in environment variables`;
        logMessages.push(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const loginData = JSON.stringify({
        email: API_USER_EMAIL,
        password: API_USER_PASSWORD
    });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla API v2.0'
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try { 
                            resolve(JSON.parse(data)); 
                        } catch (e) { 
                            logMessages.push(`❌ Login JSON Parse Error: ${e.message}`);
                            reject(e); 
                        }
                    } else {
                        logMessages.push(`❌ Login API Error. Status: ${res.statusCode}, Data: ${data.substring(0, 200)}`);
                        reject(new Error(`Login request failed: ${res.statusCode} - ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => { 
                logMessages.push(`❌ Login Request Error: ${e.message}`);
                reject(e); 
            });
            
            req.write(loginData);
            req.end();
        });

        if (response.token) {
            logMessages.push('✅ Successfully logged in to Attic Tech');
            logMessages.push(`👤 Logged in as: ${response.user?.email || 'Unknown'}`);
            return response.token;
        } else {
            throw new Error('No token received in login response');
        }
    } catch (error) {
        logMessages.push(`❌ Login to Attic Tech failed: ${error.message}`);
        throw error;
    }
}

async function fetchAllEstimatesFromAtticTech(apiKey, fechaInicio, fechaFin, logMessages = []) {
    let allLeads = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    logMessages.push(`📊 Starting to fetch estimates from ${fechaInicio} to ${fechaFin}`);

    while (hasMore) {
        let queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-updatedAt`;
        if (fechaInicio) {
            queryString += `&where[createdAt][greater_than]=${encodeURIComponent(fechaInicio)}`;
        }
        if (fechaFin) {
            queryString += `&where[createdAt][less_than]=${encodeURIComponent(fechaFin)}`;
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

async function findOrCreateSalesPerson(name, branchName = null, logMessages = []) {
    if (!name) return null;
    
    let [salesPerson, created] = await SalesPerson.findOrCreate({
        where: { name },
        defaults: { name, warning_count: 0 }
    });

    if (created) {
        logMessages.push(`🌱 Created new salesperson: ${name}`);
    }

    if (branchName && salesPerson) {
        const [branch, branchCreated] = await Branch.findOrCreate({
            where: { name: branchName },
            defaults: { name: branchName }
        });

        if (branchCreated) {
            logMessages.push(`🏢 Created new branch: ${branchName}`);
        }
        
        const existingRelation = await SalesPersonBranch.findOne({
            where: {
                sales_person_id: salesPerson.id,
                branch_id: branch.id
            }
        });
        
        if (!existingRelation) {
            await SalesPersonBranch.create({
                sales_person_id: salesPerson.id,
                branch_id: branch.id
            });
        }
    }

    return salesPerson;
}

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
    if (!name) return null;
    
    const [status, created] = await EstimateStatus.findOrCreate({
        where: { name },
        defaults: { name }
    });

    if (created) {
        logMessages.push(`🔖 Created new status: ${name}`);
    }

    return status;
}

async function saveEstimatesToDb(estimatesData, logMessages = []) {
    let newCount = 0;
    let updatedCount = 0;

    for (const data of estimatesData) {
        const salesPerson = await findOrCreateSalesPerson(data.salespersonName, data.branchName, logMessages);
        const branch = await findOrCreateBranch(data.branchName, logMessages);
        const status = await findOrCreateEstimateStatus(data.status, logMessages);

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
            attic_tech_hours: data.attic_tech_hours ? Math.round(data.attic_tech_hours) : null, // <-- Cambio aquí
            customer_name: data.customer_name,
            customer_address: data.customer_address,
            crew_notes: data.crew_notes,
            sales_person_id: salesPerson ? salesPerson.id : null,
            branch_id: branch ? branch.id : null,
            status_id: status ? status.id : null
        };

        const [estimate, created] = await Estimate.findOrCreate({
            where: { attic_tech_estimate_id: data.attic_tech_estimate_id },
            defaults: estimatePayload
        });

        if (created) {
            newCount++;
            logMessages.push(`✨ Created new estimate: ${estimate.name} (#${estimate.attic_tech_estimate_id})`);
        } else {
            await estimate.update(estimatePayload);
            updatedCount++;
            logMessages.push(`🔄 Updated estimate: ${estimate.name} (#${estimate.attic_tech_estimate_id})`);
        }
    }
    
    logMessages.push(`💾 Database persistence complete. New: ${newCount}, Updated: ${updatedCount}.`);
    return { newCount, updatedCount };
}

// --- Controlador Principal (ahora asíncrono) ---

class AutomationsController {

    async syncExternalEstimates(req, res) {
        console.log('[AUTOMATION] Received request to sync external estimates.');
        
        try {
            // Execute the sync process and wait for it to complete.
            const syncResult = await runSync();

            res.status(200).json({
                message: syncResult.message,
                data: {
                    newEstimatesCount: syncResult.newEstimatesCount,
                    updatedEstimatesCount: syncResult.updatedEstimatesCount
                }
            });

        } catch (error) {
            console.error('[AUTOMATION] Sync process failed:', error);
            res.status(500).json({
                message: 'Internal server error during the synchronization process.',
                error: error.message
            });
        }
    }
}

module.exports = new AutomationsController(); 