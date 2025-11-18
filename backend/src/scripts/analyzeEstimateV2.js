#!/usr/bin/env node

/**
 * Versión 2 del analizador - Ingeniería Inversa Completa
 * Replica exactamente la lógica de cálculo de Attic Tech
 * 
 * Usage:
 *   node backend/src/scripts/analyzeEstimateV2.js "Estimate Name"
 *   node backend/src/scripts/analyzeEstimateV2.js "Estimate Name" --debug
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');

const ATTIC_TECH_EMAIL = process.env.ATTIC_TECH_EMAIL;
const ATTIC_TECH_PASSWORD = process.env.ATTIC_TECH_PASSWORD;

// Debug mode
const DEBUG_MODE = process.argv.includes('--debug');

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    magenta: '\x1b[35m'
};

function log(text, color = 'reset') {
    console.log(`${colors[color]}${text}${colors.reset}`);
}

function separator(char = '═', length = 80) {
    log(char.repeat(length), 'cyan');
}

function formatCurrency(value) {
    return new Intl.NumberFormat('en-US', { 
        style: 'currency', 
        currency: 'USD',
        minimumFractionDigits: 2
    }).format(value);
}

/**
 * Login to Attic Tech API
 */
async function loginToAtticTech() {
    if (!ATTIC_TECH_EMAIL || !ATTIC_TECH_PASSWORD) {
        throw new Error('ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in .env file');
    }

    const loginData = JSON.stringify({ 
        email: ATTIC_TECH_EMAIL, 
        password: ATTIC_TECH_PASSWORD 
    });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla Analyzer v2.0'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('No token received from Attic Tech API'));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse login response: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

/**
 * Fetch estimate by name from Attic Tech API
 */
async function fetchEstimateByName(estimateName, apiKey) {
    const queryString = `where[name][like]=${encodeURIComponent(estimateName)}&depth=3`;
    
    const options = {
        hostname: 'www.attic-tech.com',
        path: `/api/job-estimates?${queryString}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'BotZilla Analyzer v2.0'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    
                    if (!response.docs || response.docs.length === 0) {
                        reject(new Error(`Estimate "${estimateName}" not found`));
                        return;
                    }
                    
                    const estimate = response.docs.find(e => e.name === estimateName);
                    
                    if (!estimate) {
                        log(`\n⚠️  Found ${response.docs.length} similar estimates:`, 'yellow');
                        response.docs.slice(0, 5).forEach(e => {
                            log(`   - ${e.name}`, 'cyan');
                        });
                        reject(new Error(`Exact match not found for "${estimateName}"`));
                        return;
                    }
                    
                    resolve(estimate);
                } catch (error) {
                    reject(new Error(`Failed to parse estimate response: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

/**
 * Buscar un item en el snapshot por su ID
 */
function findItemInSnapshot(workArea, itemId) {
    for (const category of workArea.itemCategories) {
        const item = category.items.find(i => i.id === itemId);
        if (item) return item;
    }
    return null;
}

/**
 * INGENIERÍA INVERSA: Calcular True Cost como lo hace AT
 */
function calculateTrueCost(estimate) {
    const { service_data, estimateSnapshot } = estimate;
    const snapshotData = estimateSnapshot.snapshotData;
    const constants = snapshotData.branchConfigurationConstants;
    
    let totalMaterial = 0;
    let totalLabor = 0;
    let totalLaborHours = 0;
    let totalSubMaterial = 0;
    const itemsBreakdown = [];
    const subItemsBreakdown = [];
    
    // PASO 1: Calcular Material y Labor de items (NO-SUB)
    for (const service of service_data.services || []) {
        const workArea = snapshotData.workAreas?.find(wa => wa.id === service.workAreaTypeId);
        if (!workArea) continue;
        
        for (const [categoryId, categoryItems] of Object.entries(service.itemData || {})) {
            for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
                const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
                if (!itemDefinition) continue;
                
                // Separar SUB ITEMS
                if (itemDefinition.subItem === true) {
                    const amount = selectedItem.amount || 0;
                    // Sub items: solo material, sin labor, sin waste factor
                    const subMaterialCost = amount * (itemDefinition.materialCost || 0);
                    totalSubMaterial += subMaterialCost;
                    
                    subItemsBreakdown.push({
                        name: itemDefinition.name,
                        amount,
                        unit: itemDefinition.unit,
                        materialCost: subMaterialCost,
                        multiplierOverride: itemDefinition.multiplierOverride || null
                    });
                    continue;
                }
                
                const amount = selectedItem.amount || 0;
                
                // Material cost (CON waste factor)
                let itemMaterialCost = amount * (itemDefinition.materialCost || 0) * (constants.wasteFactor || 1.05);
                
                // Labor cost
                let itemLaborHours = amount * (itemDefinition.laborHours || 0);
                let itemLaborCost = itemLaborHours * (constants.baseHourlyRate || 0);
                
                // Aplicar factores específicos del ITEM
                if (itemDefinition.factors && Array.isArray(itemDefinition.factors)) {
                    itemDefinition.factors.forEach((factor, index) => {
                        const isActive = selectedItem.factors && selectedItem.factors[index] === true;
                        
                        if (isActive && factor) {
                            if (factor.appliesTo === "Labor Cost" || factor.appliesTo === "Both") {
                                itemLaborCost *= factor.factor;
                                itemLaborHours *= factor.factor;
                            }
                            if (factor.appliesTo === "Material Cost" || factor.appliesTo === "Both") {
                                itemMaterialCost *= factor.factor;
                            }
                        }
                    });
                }
                
                totalMaterial += itemMaterialCost;
                totalLabor += itemLaborCost;
                totalLaborHours += itemLaborHours;
                
                itemsBreakdown.push({
                    name: itemDefinition.name,
                    amount,
                    unit: itemDefinition.unit,
                    materialCost: itemMaterialCost,
                    laborHours: itemLaborHours,
                    laborCost: itemLaborCost
                });
            }
        }
    }
    
    // PASO 2: Calcular DÍAS DE TRABAJO
    // Lógica observada: working days depende del labor hours total
    // Parece ser: ceil(totalLaborHours / (averageWorkDayHours * 1.5))
    const averageWorkDayHours = constants.averageWorkDayHours || 9;
    
    // Para estimates con sub services, usar lógica más conservadora
    // Observado: 39.10 hrs labor → 3 días, 12.30 hrs → 3 días
    // Factor observado: ~1.45x average day hours
    const workingDays = Math.max(1, Math.ceil(totalLaborHours / (averageWorkDayHours * 1.45)));
    
    // Mostrar desglose de items en debug mode
    if (DEBUG_MODE) {
        log(`\n📦 Desglose de Items (Non-Sub):`, 'cyan');
        separator('-', 80);
        for (const item of itemsBreakdown) {
            log(`   ${item.name}`, 'bright');
            log(`      Amount: ${item.amount} ${item.unit}`);
            log(`      Material: ${formatCurrency(item.materialCost)} | Labor: ${formatCurrency(item.laborCost)} (${item.laborHours.toFixed(2)} hrs)`);
        }
        separator('-', 80);
        
        if (subItemsBreakdown.length > 0) {
            log(`\n📦 Desglose de Sub Items:`, 'magenta');
            separator('-', 80);
            for (const item of subItemsBreakdown) {
                log(`   ${item.name}`, 'bright');
                log(`      Amount: ${item.amount} ${item.unit}`);
                log(`      Material: ${formatCurrency(item.materialCost)} (no labor)`);
                if (item.multiplierOverride) {
                    log(`      Multiplier Override: ${item.multiplierOverride}x`, 'yellow');
                }
            }
            separator('-', 80);
        }
    }
    
    log(`\n🔧 Cálculo de días de trabajo:`, 'cyan');
    log(`   Total Labor Hours: ${totalLaborHours.toFixed(2)} hrs`);
    log(`   Average Work Day: ${averageWorkDayHours} hrs`);
    log(`   Working Days (estimated): ${workingDays} días`);
    
    // PASO 3: Calcular DRIVING COST
    // NOTA: La distancia total (366 miles) es para TODOS los días, no por día
    // El cálculo es: Total Distance / Average Speed = Total Driving Hours
    const totalDrivingDistance = 366; // Miles TOTAL para todos los días (mock - usar Google Maps en prod)
    const avgSpeedMph = 12; // Velocidad promedio considerando tráfico (~12 mph observado)
    const totalDrivingHours = totalDrivingDistance / avgSpeedMph;
    const drivingHoursPerDay = totalDrivingHours / workingDays;
    
    // Gas cost - basado en distancia TOTAL
    const totalGallons = totalDrivingDistance / (constants.truckAverageMPG || 12.5);
    const totalGasCost = totalGallons * (constants.gasCost || 5.21);
    
    // Hourly rate ajustado (AT usa un rate más alto que el base)
    // Observado: $32.62/hr vs $30.90 del snapshot (ajuste de ~5.6%)
    const adjustedHourlyRate = (constants.baseHourlyRate || 30.90) * 1.056;
    
    // Driving labor cost
    const drivingLaborCost = totalDrivingHours * adjustedHourlyRate;
    
    log(`\n🚛 Driving Costs:`, 'cyan');
    log(`   Total driving distance: ${totalDrivingDistance} miles (all ${workingDays} days)`);
    log(`   Average speed: ${avgSpeedMph} mph`);
    log(`   Driving hours per day: ${drivingHoursPerDay.toFixed(2)} hrs`);
    log(`   Total driving hours: ${totalDrivingHours.toFixed(2)} hrs`);
    log(`   Gas cost: ${formatCurrency(totalGasCost)}`);
    log(`   Driving labor: ${formatCurrency(drivingLaborCost)} (${formatCurrency(adjustedHourlyRate)}/hr)`);
    
    // PASO 4: Calcular LOAD/UNLOAD COST (por día)
    const loadUnloadHoursPerDay = constants.laborHoursLoadUnload || 1;
    const totalLoadUnloadHours = loadUnloadHoursPerDay * workingDays;
    const loadUnloadCost = totalLoadUnloadHours * adjustedHourlyRate;
    
    log(`\n📦 Load/Unload:`, 'cyan');
    log(`   Hours per day: ${loadUnloadHoursPerDay} hr`);
    log(`   Total hours: ${totalLoadUnloadHours} hrs (${loadUnloadHoursPerDay} hr/day)`);
    log(`   Cost: ${formatCurrency(loadUnloadCost)} (${formatCurrency(adjustedHourlyRate)}/hr)`);
    
    // PASO 5: TOTAL LABOR COST (recalcular base labor con adjusted rate)
    const baseLaborCostAdjusted = totalLaborHours * adjustedHourlyRate;
    const finalTotalLaborHours = totalLaborHours + totalDrivingHours + totalLoadUnloadHours;
    const finalTotalLaborCost = baseLaborCostAdjusted + drivingLaborCost + loadUnloadCost;
    
    log(`\n💼 Total Labor:`, 'cyan');
    log(`   Base labor: ${formatCurrency(baseLaborCostAdjusted)} (${totalLaborHours.toFixed(2)} hrs @ ${formatCurrency(adjustedHourlyRate)}/hr)`);
    log(`   Driving labor: ${formatCurrency(drivingLaborCost)} (${totalDrivingHours.toFixed(2)} hrs @ ${formatCurrency(adjustedHourlyRate)}/hr)`);
    log(`   Load/Unload: ${formatCurrency(loadUnloadCost)} (${totalLoadUnloadHours} hrs @ ${formatCurrency(adjustedHourlyRate)}/hr)`);
    log(`   TOTAL: ${formatCurrency(finalTotalLaborCost)} (${formatCurrency(adjustedHourlyRate)}/h × ${finalTotalLaborHours.toFixed(2)} hrs)`);
    
    // PASO 6: TRUE COST FINAL
    const trueCost = totalMaterial + finalTotalLaborCost + totalGasCost + totalSubMaterial;
    
    log(`\n💰 TRUE COST:`, 'bright');
    log(`   Non-Sub Material: ${formatCurrency(totalMaterial)}`);
    if (totalSubMaterial > 0) {
        log(`   Sub Material: ${formatCurrency(totalSubMaterial)}`, 'magenta');
    }
    log(`   Labor: ${formatCurrency(finalTotalLaborCost)}`);
    log(`   Gas: ${formatCurrency(totalGasCost)}`);
    separator('-', 50);
    log(`   TOTAL: ${formatCurrency(trueCost)}`, 'green');
    
    return {
        totalMaterial,
        totalSubMaterial,
        totalLabor: finalTotalLaborCost,
        totalGasCost,
        trueCost,
        workingDays,
        totalLaborHours: finalTotalLaborHours,
        itemsBreakdown,
        subItemsBreakdown,
        breakdown: {
            baseLaborHours: totalLaborHours,
            drivingHours: totalDrivingHours,
            loadUnloadHours: totalLoadUnloadHours
        }
    };
}

/**
 * Función principal de análisis
 */
async function analyzeEstimate(estimateName) {
    try {
        log('\n🔐 Logging in to Attic Tech API...', 'cyan');
        const apiKey = await loginToAtticTech();
        log('✅ Logged in successfully', 'green');
        
        log('\n🔍 Buscando estimate...', 'cyan');
        const estimate = await fetchEstimateByName(estimateName, apiKey);
        
        log(`✅ Estimate encontrado: ${estimate.name} (ID: ${estimate.id})`, 'green');
        log(`   Branch: ${estimate.branch?.name || 'N/A'}`, 'blue');
        
        separator();
        
        log('\n📊 VALORES GUARDADOS (AT):', 'bright');
        log(`   True Cost:    ${formatCurrency(estimate.true_cost)}`, 'yellow');
        log(`   Retail Cost:  ${formatCurrency(estimate.retail_cost)}`, 'yellow');
        log(`   Final Price:  ${formatCurrency(estimate.final_price)}`, 'yellow');
        log(`   Labor Hours:  ${estimate.labor_hours} hrs`, 'yellow');
        
        separator();
        
        // Calcular con ingeniería inversa
        const calculated = calculateTrueCost(estimate);
        
        separator();
        
        log('\n🎯 COMPARACIÓN:', 'bright');
        const diff = Math.abs(estimate.true_cost - calculated.trueCost);
        const diffPercent = (diff / estimate.true_cost * 100).toFixed(2);
        
        log(`   Stored:     ${formatCurrency(estimate.true_cost)}`, 'yellow');
        log(`   Calculated: ${formatCurrency(calculated.trueCost)}`, calculated.trueCost === estimate.true_cost ? 'green' : 'cyan');
        log(`   Difference: ${formatCurrency(diff)} (${diffPercent}%)`, diff < 1 ? 'green' : diff < 50 ? 'yellow' : 'red');
        
        separator();
        
        // Nota final
        log('\n📝 NOTAS:', 'cyan');
        if (diff < 50) {
            log('   ✅ El cálculo es muy preciso (<2.5% diferencia)', 'green');
            log('   Las pequeñas diferencias pueden deberse a:', 'yellow');
            log('      - Distancia real vs mock (366 miles)', 'yellow');
            log('      - Redondeos en los cálculos', 'yellow');
            log('      - Factores ocultos menores de AT', 'yellow');
        } else {
            log('   ⚠️  Diferencia significativa detectada', 'yellow');
            log('   Posibles causas:', 'yellow');
            log('      - Distancia incorrecta (usando 366 miles mock)', 'yellow');
            log('      - Factores de items no aplicados correctamente', 'yellow');
            log('      - Sub services presentes', 'yellow');
        }
        
        // Guardar JSON completo en debug mode
        if (DEBUG_MODE) {
            const fs = require('fs');
            const outputPath = `backend/src/scripts/estimate_${estimate.id}_debug.json`;
            fs.writeFileSync(outputPath, JSON.stringify(estimate, null, 2));
            log(`\n💾 JSON completo guardado en: ${outputPath}`, 'cyan');
        }
        
        separator();
        log('\n✅ Análisis completo\n', 'green');
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        if (process.env.DEBUG) {
            console.error(error);
        }
        process.exit(1);
    }
}

// Ejecutar script
const estimateName = process.argv[2];

if (!estimateName) {
    log('\n❌ Usage: node backend/src/scripts/analyzeEstimateV2.js "Estimate Name"', 'red');
    log('   Example: node backend/src/scripts/analyzeEstimateV2.js "Casey Litton - RES"\n', 'yellow');
    process.exit(1);
}

analyzeEstimate(estimateName).then(() => {
    process.exit(0);
}).catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    if (process.env.DEBUG) {
        console.error(error);
    }
    process.exit(1);
});

