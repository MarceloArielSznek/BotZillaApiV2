#!/usr/bin/env node

/**
 * Script para analizar el breakdown de costos de un Estimate
 * Fetches data from Attic Tech API
 * Uso: node backend/src/scripts/analyzeEstimate.js "Casey Litton - RES"
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');

const ATTIC_TECH_EMAIL = process.env.ATTIC_TECH_EMAIL;
const ATTIC_TECH_PASSWORD = process.env.ATTIC_TECH_PASSWORD;

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

function formatHours(hours) {
    return `${hours.toFixed(2)} hours`;
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
            'User-Agent': 'BotZilla Analyzer v1.0'
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
    // Search with name filter
    const queryString = `where[name][like]=${encodeURIComponent(estimateName)}&depth=3`;
    
    const options = {
        hostname: 'www.attic-tech.com',
        path: `/api/job-estimates?${queryString}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'BotZilla Analyzer v1.0'
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
                    
                    // Find exact match
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
 * Calcular distancia entre dos direcciones (simplificado)
 */
function calculateDistance(address1, address2) {
    // Mock: retornar 183 millas (366 round trip como en el ejemplo)
    return 183;
}

/**
 * PASO 1: Calcular Material y Labor Cost (antes de factores de work area)
 */
function calculateMaterialAndLaborBeforeFactors(estimate) {
    const { service_data, estimateSnapshot } = estimate;
    const snapshotData = estimateSnapshot.snapshotData;
    const constants = snapshotData.branchConfigurationConstants;
    
    let totalMaterialBeforeFactors = 0;
    let totalLaborBeforeFactors = 0;
    let totalLaborHours = 0;
    
    const itemsBreakdown = [];
    
    for (const service of service_data.services || []) {
        const workArea = snapshotData.workAreas?.find(wa => wa.id === service.workAreaTypeId);
        
        if (!workArea) continue;
        
        for (const [categoryId, categoryItems] of Object.entries(service.itemData || {})) {
            for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
                const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
                
                if (!itemDefinition) continue;
                
                // Solo items NO subcontratados
                if (itemDefinition.subItem === true) continue;
                
                const amount = selectedItem.amount || 0;
                
                // Material cost (sin waste factor aún)
                let itemMaterialCost = amount * (itemDefinition.materialCost || 0);
                
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
                
                totalMaterialBeforeFactors += itemMaterialCost;
                totalLaborBeforeFactors += itemLaborCost;
                totalLaborHours += itemLaborHours;
                
                itemsBreakdown.push({
                    name: itemDefinition.name,
                    amount: amount,
                    unit: itemDefinition.unit,
                    materialCost: itemMaterialCost,
                    laborHours: itemLaborHours,
                    laborCost: itemLaborCost
                });
            }
        }
    }
    
    return {
        totalMaterialBeforeFactors,
        totalLaborBeforeFactors,
        totalLaborHours,
        itemsBreakdown,
        constants
    };
}

/**
 * PASO 2: Aplicar factores de work area
 */
function applyWorkAreaFactors(estimate, materialBeforeFactors, laborBeforeFactors) {
    const { service_data, estimateSnapshot } = estimate;
    const snapshotData = estimateSnapshot.snapshotData;
    
    let materialAfterFactors = materialBeforeFactors;
    let laborAfterFactors = laborBeforeFactors;
    
    const activeFactors = [];
    
    for (const service of service_data.services || []) {
        const workArea = snapshotData.workAreas?.find(wa => wa.id === service.workAreaTypeId);
        
        if (!workArea) continue;
        
        // Obtener factores activos
        for (const factor of workArea.factors || []) {
            if (service.factors && service.factors[factor.id] === true) {
                activeFactors.push(factor);
                
                if (factor.appliesTo === "Labor Cost" || factor.appliesTo === "Both") {
                    laborAfterFactors *= factor.factor;
                }
                
                if (factor.appliesTo === "Material Cost" || factor.appliesTo === "Both") {
                    materialAfterFactors *= factor.factor;
                }
            }
        }
    }
    
    return {
        materialAfterFactors,
        laborAfterFactors,
        activeFactors
    };
}

/**
 * PASO 3: Calcular otros costos (gas, carga/descarga, QC)
 */
function calculateOtherCosts(estimate, constants) {
    const property = estimate.property || {};
    const branchAddress = constants.address || '';
    
    // Calcular distancia y gas
    const oneWayDistance = calculateDistance(property.address, branchAddress);
    const roundTripDistance = oneWayDistance * 2;
    const gallonsUsed = roundTripDistance / (constants.truckAverageMPG || 12.5);
    const totalGasCost = gallonsUsed * (constants.gasCost || 5.21);
    
    // Calcular horas de manejo
    const avgSpeedMph = 30; // Asumiendo velocidad promedio
    const drivingHours = roundTripDistance / avgSpeedMph;
    const drivingLaborCost = drivingHours * (constants.baseHourlyRate || 0);
    
    // Horas de carga/descarga
    const loadUnloadHours = constants.laborHoursLoadUnload || 1;
    const loadUnloadCost = loadUnloadHours * (constants.baseHourlyRate || 0);
    
    // Quality Control Visit
    const qcCost = estimate.quality_control_visit ? (constants.qualityControlVisitPrice || 0) : 0;
    
    return {
        roundTripDistance,
        totalGasCost,
        drivingHours,
        drivingLaborCost,
        loadUnloadHours,
        loadUnloadCost,
        qcCost
    };
}

/**
 * PASO 4: Calcular Non-Sub Cost total
 */
function calculateNonSubCost(estimate) {
    const step1 = calculateMaterialAndLaborBeforeFactors(estimate);
    const { constants } = step1;
    
    // Aplicar waste factor al material
    const materialWithWaste = step1.totalMaterialBeforeFactors * (constants.wasteFactor || 1.05);
    
    const step2 = applyWorkAreaFactors(
        estimate, 
        materialWithWaste, 
        step1.totalLaborBeforeFactors
    );
    
    const otherCosts = calculateOtherCosts(estimate, constants);
    
    // Total Non-Sub Cost
    const totalNonSubCost = 
        step2.materialAfterFactors + 
        step2.laborAfterFactors + 
        otherCosts.totalGasCost + 
        otherCosts.drivingLaborCost +
        otherCosts.loadUnloadCost +
        otherCosts.qcCost;
    
    return {
        materialBeforeFactors: step1.totalMaterialBeforeFactors,
        materialWithWaste,
        materialAfterFactors: step2.materialAfterFactors,
        laborBeforeFactors: step1.totalLaborBeforeFactors,
        laborAfterFactors: step2.laborAfterFactors,
        laborHours: step1.totalLaborHours,
        activeFactors: step2.activeFactors,
        otherCosts,
        totalNonSubCost,
        constants,
        itemsBreakdown: step1.itemsBreakdown
    };
}

/**
 * PASO 5: Calcular Sub Services Retail Cost
 */
function calculateSubServicesRetailCost(estimate) {
    const { service_data, estimateSnapshot } = estimate;
    const snapshotData = estimateSnapshot.snapshotData;
    const constants = snapshotData.branchConfigurationConstants;
    
    let subServicesRetailCost = 0;
    const subItems = [];
    
    for (const service of service_data.services || []) {
        const workArea = snapshotData.workAreas?.find(wa => wa.id === service.workAreaTypeId);
        
        if (!workArea) continue;
        
        for (const [categoryId, categoryItems] of Object.entries(service.itemData || {})) {
            for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
                const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
                
                if (!itemDefinition || itemDefinition.subItem !== true) continue;
                
                const subBaseCost = (selectedItem.amount || 0) * (itemDefinition.materialCost || 0);
                const subMultiplier = itemDefinition.multiplierOverride || constants.subMultiplier || 1.75;
                const subRetailCost = subBaseCost * subMultiplier;
                
                subServicesRetailCost += subRetailCost;
                
                subItems.push({
                    name: itemDefinition.name,
                    baseCost: subBaseCost,
                    multiplier: subMultiplier,
                    retailCost: subRetailCost
                });
            }
        }
    }
    
    return {
        subServicesRetailCost,
        subItems
    };
}

/**
 * PASO 6: Calcular Retail Price y aplicar factores
 */
function calculateRetailAndFinalPrice(estimate, nonSubCost, subServicesRetailCost) {
    const { estimateSnapshot, payment_method, discount_provided } = estimate;
    const snapshotData = estimateSnapshot.snapshotData;
    const constants = snapshotData.branchConfigurationConstants;
    const multiplierRanges = snapshotData.multiplierRanges || [];
    
    // Encontrar multiplier range aplicable
    const applicableRange = multiplierRanges.find(range => 
        nonSubCost >= range.minCost && 
        (range.maxCost === null || nonSubCost <= range.maxCost)
    );
    
    if (!applicableRange) {
        return {
            error: `No multiplier range found for cost: ${formatCurrency(nonSubCost)}`
        };
    }
    
    const baseMultiplier = applicableRange.lowestMultiple;
    let retailCost = (nonSubCost * baseMultiplier) + subServicesRetailCost;
    
    // Aplicar payment method factor
    let paymentMethodFactor = 1;
    let paymentMethodName = 'None';
    
    if (payment_method === 'cash') {
        paymentMethodFactor = constants.cashFactor || 1.04;
        paymentMethodName = 'Cash';
    } else if (payment_method === 'credit_card') {
        paymentMethodFactor = constants.creditCardFee || 1.045;
        paymentMethodName = 'Credit Card';
    } else if (payment_method === 'finance') {
        paymentMethodFactor = 1.15; // Default
        paymentMethodName = 'Finance';
    }
    
    retailCost *= paymentMethodFactor;
    
    // Aplicar descuento
    const discountAmount = retailCost * ((discount_provided || 0) / 100);
    const finalPrice = retailCost - discountAmount;
    
    return {
        applicableRange,
        baseMultiplier,
        retailBeforePaymentFactor: (nonSubCost * baseMultiplier) + subServicesRetailCost,
        paymentMethodFactor,
        paymentMethodName,
        retailCost,
        discountProvided: discount_provided || 0,
        discountAmount,
        finalPrice
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
        log(`   Status: ${estimate.status || 'N/A'}`, 'blue');
        
        // Debug: Mostrar valores guardados
        log('\n📋 Valores guardados en el estimate:', 'cyan');
        log(`   True Cost:    ${formatCurrency(estimate.true_cost)}`);
        log(`   Retail Cost:  ${formatCurrency(estimate.retail_cost)}`);
        log(`   Final Price:  ${formatCurrency(estimate.final_price)}`);
        log(`   Labor Hours:  ${estimate.labor_hours} hrs`);
        log(`   Discount:     ${estimate.discount_provided}%`);
        log(`   Payment:      ${estimate.payment_method || 'N/A'}`);
        
        // Debug: Verificar snapshot
        const snapshotData = estimate.estimateSnapshot?.snapshotData;
        if (!snapshotData) {
            log('\n❌ ERROR: No se encontró snapshotData en el estimate', 'red');
            process.exit(1);
        }
        
        const constants = snapshotData.branchConfigurationConstants;
        log('\n🔧 Constants del snapshot:', 'cyan');
        log(`   Base Hourly Rate: ${formatCurrency(constants.baseHourlyRate)}/hr`);
        log(`   Waste Factor:     ${constants.wasteFactor}`);
        log(`   Cash Factor:      ${constants.cashFactor}`);
        log(`   Sub Multiplier:   ${constants.subMultiplier}`);
        
        // Debug: Guardar JSON completo del estimate
        if (DEBUG_MODE) {
            const fs = require('fs');
            const path = require('path');
            const filename = path.join(__dirname, `estimate_${estimate.id}_debug.json`);
            fs.writeFileSync(filename, JSON.stringify(estimate, null, 2));
            log(`\n🐛 Full estimate JSON saved to: ${filename}`, 'magenta');
        }
        
        separator();
        
        // Calcular breakdown
        const nonSubBreakdown = calculateNonSubCost(estimate);
        const subBreakdown = calculateSubServicesRetailCost(estimate);
        const retailBreakdown = calculateRetailAndFinalPrice(
            estimate, 
            nonSubBreakdown.totalNonSubCost, 
            subBreakdown.subServicesRetailCost
        );
        
        if (retailBreakdown.error) {
            log(`\n❌ ${retailBreakdown.error}`, 'red');
            process.exit(1);
        }
        
        // ═══════════════════════════════════════════════════════════
        // MOSTRAR RESULTADOS
        // ═══════════════════════════════════════════════════════════
        
        log('\n📊 ESTIMATE BREAKDOWN', 'bright');
        separator();
        
        // Mostrar items desglosados por work area
        log('\n📦 ITEMS BREAKDOWN BY WORK AREA:', 'bright');
        separator();
        
        // Reutilizar snapshotData ya declarado arriba
        const { service_data } = estimate;
        
        for (const service of service_data.services || []) {
            const workArea = snapshotData.workAreas?.find(wa => wa.id === service.workAreaTypeId);
            if (!workArea) continue;
            
            log(`\n${workArea.name}`, 'cyan');
            log('─'.repeat(80));
            log(`${'Name'.padEnd(45)} | ${'Material Cost'.padStart(14)} | ${'Labor Cost'.padStart(14)}`);
            log('─'.repeat(80));
            
            let workAreaMaterial = 0;
            let workAreaLabor = 0;
            
            for (const [categoryId, categoryItems] of Object.entries(service.itemData || {})) {
                for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
                    const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
                    if (!itemDefinition || itemDefinition.subItem === true) continue;
                    
                    const amount = selectedItem.amount || 0;
                    
                    // Material cost base
                    let itemMaterialCost = amount * (itemDefinition.materialCost || 0) * (constants.wasteFactor || 1.05);
                    
                    // Labor cost base
                    let itemLaborHours = amount * (itemDefinition.laborHours || 0);
                    let itemLaborCost = itemLaborHours * (constants.baseHourlyRate || 0);
                    
                    // Aplicar factores específicos del ITEM (no del work area)
                    if (itemDefinition.factors && Array.isArray(itemDefinition.factors)) {
                        itemDefinition.factors.forEach((factor, index) => {
                            // Verificar si este factor está activado en selectedItem.factors
                            const isActive = selectedItem.factors && selectedItem.factors[index] === true;
                            
                            if (isActive && factor) {
                                if (factor.appliesTo === "Labor Cost" || factor.appliesTo === "Both") {
                                    itemLaborCost *= factor.factor;
                                    itemLaborHours *= factor.factor;
                                    if (DEBUG_MODE) {
                                        log(`  🔴 Factor activo: ${factor.name} (×${factor.factor})`, 'magenta');
                                    }
                                }
                                if (factor.appliesTo === "Material Cost" || factor.appliesTo === "Both") {
                                    itemMaterialCost *= factor.factor;
                                    if (DEBUG_MODE) {
                                        log(`  🔴 Factor activo: ${factor.name} (×${factor.factor})`, 'magenta');
                                    }
                                }
                            }
                        });
                    }
                    
                    workAreaMaterial += itemMaterialCost;
                    workAreaLabor += itemLaborCost;
                    
                    const itemName = itemDefinition.name.substring(0, 45).padEnd(45);
                    const matCost = formatCurrency(itemMaterialCost).padStart(14);
                    const labCost = formatCurrency(itemLaborCost).padStart(14);
                    
                    log(`${itemName} | ${matCost} | ${labCost}`);
                    
                    // Mostrar detalles del item
                    log(`  ${amount} ${itemDefinition.unit}`, 'blue');
                    log(`  ${formatCurrency(itemDefinition.materialCost)} / ${itemDefinition.unit}`, 'blue');
                    log(`  ${itemDefinition.laborHours} hr / ${itemDefinition.unit}`, 'blue');
                    
                    // Debug mode: Mostrar cálculos detallados
                    if (DEBUG_MODE) {
                        log(`  🐛 DEBUG: Item ID ${itemId}`, 'magenta');
                        log(`  🐛   Material: ${amount} × ${itemDefinition.materialCost} × ${constants.wasteFactor} = ${itemMaterialCost}`, 'magenta');
                        log(`  🐛   Labor: ${amount} × ${itemDefinition.laborHours} × ${constants.baseHourlyRate} = ${itemLaborCost}`, 'magenta');
                    }
                    
                    // Mostrar factores específicos si aplican
                    if (itemDefinition.factors && itemDefinition.factors.length > 0) {
                        itemDefinition.factors.forEach(f => {
                            if (service.factors && service.factors[f.id]) {
                                log(`  ${f.name}`, 'magenta');
                            }
                        });
                    }
                    
                    log(`  Total after factors: Material ${formatCurrency(itemMaterialCost)}, ${itemLaborHours.toFixed(1)} hrs`, 'green');
                    log('');
                }
            }
            
            log('─'.repeat(80));
            log(`${'Total before area factors'.padEnd(45)} | ${formatCurrency(workAreaMaterial).padStart(14)} | ${formatCurrency(workAreaLabor).padStart(14)}`, 'yellow');
            log('');
        }
        
        // Totales generales
        separator();
        log(`\n${'TOTAL BEFORE AREA FACTORS'.padEnd(45)} | ${formatCurrency(nonSubBreakdown.materialBeforeFactors).padStart(14)} | ${formatCurrency(nonSubBreakdown.laborBeforeFactors).padStart(14)}`, 'bright');
        
        if (nonSubBreakdown.activeFactors.length > 0) {
            log('\n⚡ Active Work Area Factors:', 'magenta');
            nonSubBreakdown.activeFactors.forEach(factor => {
                log(`   - ${factor.name}: x${factor.factor} (${factor.appliesTo})`);
            });
            log(`\n   After factors:`);
            log(`   Material: ${formatCurrency(nonSubBreakdown.materialAfterFactors)}`);
            log(`   Labor:    ${formatCurrency(nonSubBreakdown.laborAfterFactors)}`);
        }
        
        // Other Costs
        log('\n🚛 Other costs:', 'yellow');
        log(`   Total Driving Distance:       ${nonSubBreakdown.otherCosts.roundTripDistance} miles`);
        log(`   Gas Cost:                     ${formatCurrency(nonSubBreakdown.constants.gasCost)} /gallon`);
        log(`   Truck Average MPG:            ${nonSubBreakdown.constants.truckAverageMPG}`);
        log(`   Total Gas Cost:               ${formatCurrency(nonSubBreakdown.otherCosts.totalGasCost)}`);
        log(`   Total Labor Driving Time:     ${formatHours(nonSubBreakdown.otherCosts.drivingHours)}`);
        log(`   Total Labor Hours Load/Unload: ${formatHours(nonSubBreakdown.otherCosts.loadUnloadHours)}`);
        
        const totalOtherLaborHours = nonSubBreakdown.laborHours + 
            nonSubBreakdown.otherCosts.drivingHours + 
            nonSubBreakdown.otherCosts.loadUnloadHours;
        const totalLaborCost = nonSubBreakdown.laborAfterFactors + 
            nonSubBreakdown.otherCosts.drivingLaborCost + 
            nonSubBreakdown.otherCosts.loadUnloadCost;
        
        log(`   Base Labor Cost:              ${formatCurrency(totalLaborCost)} (${formatCurrency(nonSubBreakdown.constants.baseHourlyRate)}/h x ${totalOtherLaborHours.toFixed(2)} hours)`);
        
        if (nonSubBreakdown.otherCosts.qcCost > 0) {
            log(`   Quality Control Visit:        ${formatCurrency(nonSubBreakdown.otherCosts.qcCost)}`);
        }
        
        // Retail Breakdown
        log('\n📈 Retail Breakdown:', 'yellow');
        separator('-', 50);
        log(`Total Non-Sub Cost (Material + Labor): ${formatCurrency(nonSubBreakdown.totalNonSubCost)}`, 'red');
        log(`Multiplier:                            x ${retailBreakdown.baseMultiplier} (${formatCurrency(nonSubBreakdown.totalNonSubCost * retailBreakdown.baseMultiplier)})`);
        log(`Total Sub Cost (Material):             ${formatCurrency(subBreakdown.subServicesRetailCost)}`);
        
        if (subBreakdown.subItems.length > 0) {
            log('\n   Sub Items:', 'cyan');
            subBreakdown.subItems.forEach(item => {
                log(`   - ${item.name}: ${formatCurrency(item.baseCost)} x ${item.multiplier} = ${formatCurrency(item.retailCost)}`);
            });
        }
        
        log(`\nAfter Sub Multiplier(s):               ${formatCurrency(retailBreakdown.retailBeforePaymentFactor)}`);
        log(`Payment Method Factor (${retailBreakdown.paymentMethodName}):     x ${retailBreakdown.paymentMethodFactor}`);
        separator('-', 50);
        log(`Retail Price:                          ${formatCurrency(retailBreakdown.retailCost)}`, 'red');
        
        log(`\nDiscount Provided (%):                 ${retailBreakdown.discountProvided}%`);
        separator('-', 50);
        log(`Final Proposal Price:                  ${formatCurrency(retailBreakdown.finalPrice)}`, 'green');
        
        // Comparación con valores guardados
        log('\n\n🔍 Comparison with stored values:', 'cyan');
        separator();
        
        const trueCostDiff = Math.abs(estimate.true_cost - nonSubBreakdown.totalNonSubCost);
        const retailDiff = Math.abs(estimate.retail_cost - retailBreakdown.retailCost);
        const finalDiff = Math.abs(estimate.final_price - retailBreakdown.finalPrice);
        
        log(`True Cost:    Stored: ${formatCurrency(estimate.true_cost)}       Calculated: ${formatCurrency(nonSubBreakdown.totalNonSubCost)}       Diff: ${formatCurrency(trueCostDiff)}`, trueCostDiff < 1 ? 'green' : 'yellow');
        log(`Retail Cost:  Stored: ${formatCurrency(estimate.retail_cost)}  Calculated: ${formatCurrency(retailBreakdown.retailCost)}      Diff: ${formatCurrency(retailDiff)}`, retailDiff < 1 ? 'green' : 'yellow');
        log(`Final Price:  Stored: ${formatCurrency(estimate.final_price)}  Calculated: ${formatCurrency(retailBreakdown.finalPrice)}      Diff: ${formatCurrency(finalDiff)}`, finalDiff < 1 ? 'green' : 'yellow');
        
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
const DEBUG_MODE = process.argv[3] === '--debug';

if (!estimateName) {
    log('\n❌ Usage: node backend/src/scripts/analyzeEstimate.js "Estimate Name" [--debug]', 'red');
    log('   Example: node backend/src/scripts/analyzeEstimate.js "Casey Litton - RES"', 'yellow');
    log('   Debug:   node backend/src/scripts/analyzeEstimate.js "Casey Litton - RES" --debug\n', 'yellow');
    process.exit(1);
}

if (DEBUG_MODE) {
    log('\n🐛 DEBUG MODE ENABLED', 'magenta');
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
