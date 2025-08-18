require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');
const sequelize = require('../config/database');
const { SalesPerson, Branch, EstimateStatus, Estimate, SalesPersonBranch } = require('../models');

// --- Configuración de la Sincronización ---
const todayIso = new Date().toISOString().slice(0, 10);
const weekAgoIso = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString().slice(0, 10);

const config = {
    fechaInicio: process.env.START_DATE || weekAgoIso,
    fechaFin: process.env.END_DATE || todayIso,
    sucursalObjetivo: process.env.BRANCH || 'San Diego',
    limiteResultados: parseInt(process.env.LIMIT || '10', 10),
    // DRY RUN por defecto: si no se define DRY_RUN en el entorno, asumimos true
    dryRun: process.env.DRY_RUN ? process.env.DRY_RUN === 'true' : true,
    // Si true, imprime el objeto RAW del primer estimate seleccionado (después del filtrado)
    debugRawLead: process.env.DEBUG_RAW ? process.env.DEBUG_RAW === 'true' : false
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
function mapAtticTechDataToEstimates(leads, logMessages = []) {
    return leads.map(lead => {
        const customerName = (lead.customer_info?.firstName || lead.customer_info?.lastName)
            ? `${lead.customer_info.firstName || ''} ${lead.customer_info.lastName || ''}`.trim()
            : (lead.property?.client?.fullName || lead.client?.fullName || lead.customer_name || null);

        // 1) Heurística de contacto: buscar email/teléfono recorriendo el objeto
        const { email: detectedEmail, emailCandidates, phone: detectedPhone, phoneCandidates } = findContactInfoInLead(lead);

        // 2) Priorizar rutas conocidas si existen
        const knownEmail = lead.property?.client?.email || lead.client?.email || lead.email || lead.contact?.email || null;
        const knownPhone = lead.property?.client?.phone || lead.property?.client?.phoneNumber || lead.client?.phone || lead.client?.phoneNumber || lead.phone || lead.contact?.phone || null;

        const finalEmail = knownEmail || detectedEmail || null;
        const finalPhone = knownPhone || detectedPhone || null;

        // 3) Log para depurar candidatos y la selección final
        try {
            const topEmailCandidates = emailCandidates.slice(0, 5).map(c => `${c.path}: ${c.value}`);
            const topPhoneCandidates = phoneCandidates.slice(0, 5).map(c => `${c.path}: ${c.value}`);
            logMessages.push(`✉️ Email candidates: ${topEmailCandidates.join(' | ')}`);
            logMessages.push(`📱 Phone candidates: ${topPhoneCandidates.join(' | ')}`);
            logMessages.push(`✅ Selected email: ${finalEmail || 'N/A'} | Selected phone: ${finalPhone || 'N/A'}`);
        } catch (_) { /* noop for safety */ }

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
            customer_address: lead.address || lead.property?.address || null,
            customer_email: finalEmail,
            customer_phone: finalPhone,
            crew_notes: lead.crew_notes
        };
    });
}

// Utilidad: detectar email/teléfono recorriendo el objeto lead con heurísticas
function findContactInfoInLead(root) {
    const visited = new Set();
    const emailCandidates = [];
    const phoneCandidates = [];

    const emailRegex = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
    const isIsoDate = (v) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v);
    const looksLikePhone = (v) => {
        if (typeof v !== 'string' && typeof v !== 'number') return false;
        const s = String(v);
        if (isIsoDate(s)) return false; // excluir timestamps ISO
        const digits = s.replace(/\D/g, '');
        return digits.length >= 7 && digits.length <= 15; // rango típico de teléfonos
    };

    const stack = [{ value: root, path: 'root', depth: 0 }];
    const MAX_DEPTH = 6;
    const MAX_NODES = 5000;
    let processed = 0;

    while (stack.length && processed < MAX_NODES) {
        const { value, path, depth } = stack.pop();
        processed++;
        if (!value || typeof value !== 'object' || visited.has(value) || depth > MAX_DEPTH) continue;
        visited.add(value);

        if (Array.isArray(value)) {
            for (let i = 0; i < value.length; i++) {
                stack.push({ value: value[i], path: `${path}[${i}]`, depth: depth + 1 });
            }
        } else {
            for (const key of Object.keys(value)) {
                const child = value[key];
                const childPath = `${path}.${key}`;

                // Candidatos por nombre de clave
                const keyLc = key.toLowerCase();
                if (typeof child === 'string') {
                    if (keyLc.includes('email') || emailRegex.test(child)) {
                        emailCandidates.push({ path: childPath, value: child });
                    }
                    const isPhoneKey = keyLc.includes('phone') || keyLc.includes('mobile') || keyLc.includes('cell') || keyLc.includes('tel');
                    const isExcludedKey = keyLc.includes('updatedat') || keyLc.includes('createdat') || keyLc.includes('address');
                    if (isPhoneKey && !isExcludedKey && looksLikePhone(child)) {
                        phoneCandidates.push({ path: childPath, value: child });
                    }
                } else if (typeof child === 'number') {
                    const asString = String(child);
                    const isPhoneKey = keyLc.includes('phone') || keyLc.includes('mobile') || keyLc.includes('cell') || keyLc.includes('tel');
                    if (isPhoneKey && looksLikePhone(asString)) {
                        phoneCandidates.push({ path: childPath, value: asString });
                    }
                }

                if (child && typeof child === 'object') {
                    stack.push({ value: child, path: childPath, depth: depth + 1 });
                }
            }
        }
    }

    // Ordenar candidatos por prioridad heurística: ruta con client/property/contact primero
    const prioritize = (candidates) => {
        const scorePath = (p) => {
            let score = 0;
            const pl = p.toLowerCase();
            if (pl.includes('property')) score += 3;
            if (pl.includes('client') || pl.includes('customer')) score += 5;
            if (pl.includes('contact')) score += 2;
            if (pl.includes('email')) score += 5;
            if (pl.includes('phone') || pl.includes('mobile') || pl.includes('cell') || pl.includes('tel')) score += 5;
            return score;
        };
        return candidates
            .map(c => {
                const digits = String(c.value).replace(/\D/g, '');
                return { ...c, _score: scorePath(c.path) + Math.min(digits.length, 15) / 3 };
            })
            .sort((a, b) => b._score - a._score);
    };

    const prioritizedEmails = prioritize(emailCandidates);
    const prioritizedPhones = prioritize(phoneCandidates);

    return {
        email: prioritizedEmails.length ? prioritizedEmails[0].value : null,
        emailCandidates: prioritizedEmails,
        phone: prioritizedPhones.length ? prioritizedPhones[0].value : null,
        phoneCandidates: prioritizedPhones
    };
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
    const stats = { inserted: 0, updated: 0, errors: 0, skipped: 0, wouldInsert: 0, wouldUpdate: 0 };

    console.log("--- Iniciando Script de Sincronización de Estimates ---");

    try {
        await sequelize.authenticate();
        console.log('✅ Conexión a la base de datos establecida.');

        const apiKey = await loginToAtticTech(logMessages);
        
        const rawLeads = await fetchAllEstimatesFromAtticTech(apiKey, config.fechaInicio, config.fechaFin, logMessages);
        
        let estimatesToProcess = mapAtticTechDataToEstimates(rawLeads, logMessages);
        
        if (config.sucursalObjetivo) {
            estimatesToProcess = estimatesToProcess.filter(e => e.branchName === config.sucursalObjetivo);
        }
        if (config.limiteResultados) {
            estimatesToProcess = estimatesToProcess.slice(0, config.limiteResultados);
        }

        // Debug: imprimir un solo lead RAW para identificar campos reales de contacto
        if (config.debugRawLead && rawLeads && rawLeads.length > 0) {
            try {
                // Encontrar el lead original del primer estimate filtrado
                const first = estimatesToProcess[0];
                const source = rawLeads.find(l => l && l.id === first.attic_tech_estimate_id) || rawLeads[0];
                console.log('\n===== RAW LEAD DEBUG (UNO SOLO) =====');
                console.log(JSON.stringify({
                    id: source?.id,
                    name: source?.name,
                    keys: source ? Object.keys(source) : [],
                    user: source?.user,
                    client: source?.client,
                    property_client: source?.property?.client,
                    customer_info: source?.customer_info,
                    contact: source?.contact,
                    phone_guess_examples: [
                        source?.customer_info?.phone,
                        source?.customer_info?.phoneNumber,
                        source?.client?.phone,
                        source?.client?.phoneNumber,
                        source?.property?.client?.phone,
                        source?.property?.client?.phoneNumber,
                        source?.contact?.phone,
                        source?.phone
                    ]
                }, null, 2));
                console.log('====================================\n');
            } catch (e) {
                console.log('RAW lead debug failed:', e.message);
            }
        }
        
        logMessages.push(`🔄 Procesando ${estimatesToProcess.length} estimates...`);

        for (const estimateData of estimatesToProcess) {
             try {
                if (!estimateData.attic_tech_estimate_id) {
                    logMessages.push(`⚠️ Saltado: Estimate sin ID de Attic Tech (${estimateData.name})`);
                    stats.skipped++;
                    continue;
                }

                let branch = null, salesPerson = null, status = null;
                if (!config.dryRun) {
                    branch = await findOrCreateBranch(estimateData.branchName, logMessages);
                    salesPerson = await findOrCreateSalesPerson(estimateData.salespersonName, estimateData.branchName, logMessages);
                    status = await findOrCreateEstimateStatus(estimateData.status, logMessages);
                }

                const estimatePayload = {
                    attic_tech_estimate_id: estimateData.attic_tech_estimate_id,
                    name: estimateData.name,
                    atCreatedDate: estimateData.atCreatedDate,
                    atUpdatedDate: estimateData.atUpdatedDate,
                    customer_name: estimateData.customer_name,
                    customer_address: estimateData.customer_address,
                    customer_email: estimateData.customer_email || null,
                    customer_phone: estimateData.customer_phone || null,
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
                
                if (config.dryRun) {
                    const existing = await Estimate.findOne({ where: { attic_tech_estimate_id: estimatePayload.attic_tech_estimate_id } });
                    if (existing) {
                        stats.wouldUpdate++;
                        logMessages.push(`🧪 [DRY RUN] Actualizaría: ${estimatePayload.name} (AT ID: ${estimatePayload.attic_tech_estimate_id})`);
                    } else {
                        stats.wouldInsert++;
                        logMessages.push(`🧪 [DRY RUN] Crearía: ${estimatePayload.name} (AT ID: ${estimatePayload.attic_tech_estimate_id})`);
                    }
                    logMessages.push(`   ↳ branch: ${estimateData.branchName} | salesperson: ${estimateData.salespersonName} | status: ${estimateData.status}`);
                    logMessages.push(`   ↳ contacto: email=${estimatePayload.customer_email || 'N/A'}, phone=${estimatePayload.customer_phone || 'N/A'}`);
                } else {
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
                }

            } catch (dbError) {
                stats.errors++;
                logMessages.push(`❌ ERROR procesando ${estimateData.name}: ${dbError.message}`);
            }
        }
        
        const summary = config.dryRun
            ? `DRY RUN - Resultados: ${stats.wouldInsert} crearían, ${stats.wouldUpdate} actualizarían, ${stats.errors} errores, ${stats.skipped} saltados.`
            : `Resultados: ${stats.inserted} creados, ${stats.updated} actualizados, ${stats.errors} errores, ${stats.skipped} saltados.`;
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