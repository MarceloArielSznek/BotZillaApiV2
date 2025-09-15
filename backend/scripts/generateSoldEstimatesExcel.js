const https = require('https');
const ExcelJS = require('exceljs');
const path = require('path');
require('dotenv').config();

// Configuración
const ATTIC_TECH_HOST = 'www.attic-tech.com';

/**
 * Login a Attic Tech y obtiene el token de autenticación
 */
async function loginToAtticTech() {
    console.log('🔑 Iniciando login a Attic Tech...');
    
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    
    if (!API_USER_EMAIL || !API_USER_PASSWORD) {
        throw new Error('ATTIC_TECH_EMAIL y ATTIC_TECH_PASSWORD deben estar configurados en las variables de entorno');
    }

    const loginData = JSON.stringify({
        email: API_USER_EMAIL,
        password: API_USER_PASSWORD
    });

    const options = {
        hostname: ATTIC_TECH_HOST,
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla Sold Estimates Script'
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
                            reject(new Error(`Error parsing login response: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`Login request failed: ${res.statusCode} - ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => { 
                reject(e); 
            });
            
            req.write(loginData);
            req.end();
        });

        if (response.token) {
            console.log('✅ Login exitoso a Attic Tech');
            console.log(`👤 Conectado como: ${response.user?.email || 'Unknown'}`);
            return response.token;
        } else {
            throw new Error('No se recibió token en la respuesta de login');
        }
    } catch (error) {
        console.error('❌ Error en login a Attic Tech:', error.message);
        throw error;
    }
}

/**
 * Fetchea estimates vendidos desde Attic Tech (solo 5 para prueba)
 */
async function fetchSoldEstimatesFromAtticTech(token) {
    let allEstimates = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    const maxEstimates = Infinity; // 10 estimates para testing con nueva lógica

    console.log('🔍 Iniciando fetch de estimates vendidos desde Attic Tech...');

    while (hasMore && allEstimates.length < maxEstimates) {
        // Query para obtener estimates con mayor depth para incluir tax_details
        let queryString = `limit=${pageSize}&page=${page}&depth=5&sort=-updatedAt`;

        const options = {
            hostname: ATTIC_TECH_HOST,
            path: `/api/job-estimates?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Sold Estimates Script'
            }
        };

        try {
            const estimates = await new Promise((resolve, reject) => {
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

            // Filtrar estimates vendidos de Orange County
            const soldEstimates = estimates.filter(est => 
                est.status === 'Sold' && 
                est.branch?.name === 'Orange County'
            );
            
            // Separar estimates con y sin SUB cost
            const estimatesWithSub = soldEstimates.filter(est => est.sub_services_retail_cost && est.sub_services_retail_cost > 0);
            const estimatesWithoutSub = soldEstimates.filter(est => !est.sub_services_retail_cost || est.sub_services_retail_cost === 0);
            
            // Combinar: primero los que tienen SUB, luego los que no
            const prioritizedEstimates = [...estimatesWithSub, ...estimatesWithoutSub];
            
            // Agregar solo hasta completar maxEstimates
            const remainingNeeded = maxEstimates - allEstimates.length;
            const estimatesToAdd = prioritizedEstimates.slice(0, remainingNeeded);
            
            allEstimates = allEstimates.concat(estimatesToAdd);
            console.log(`📄 Página ${page}: ${estimates.length} estimates total, ${soldEstimates.length} vendidos (${estimatesWithSub.length} con SUB), agregados ${estimatesToAdd.length}`);
            
            if (allEstimates.length >= maxEstimates) {
                console.log(`✅ Alcanzado el límite de ${maxEstimates} estimates vendidos`);
                break;
            }
            
            if (estimates.length < pageSize) {
                console.log(`🛑 Última página detectada: ${estimates.length} estimates (menos que ${pageSize})`);
                hasMore = false;
            } else {
                page++;
            }
        } catch (error) {
            console.error(`❌ Error en página ${page}: ${error.message}`);
            throw error;
        }
    }

    console.log(`✅ Total estimates vendidos fetcheados: ${allEstimates.length}`);
    console.log(`📊 Total de páginas procesadas: ${page - 1}`);
    return allEstimates;
}

/**
 * Procesa y estructura los datos de los estimates
 */
function processEstimatesData(estimates) {
    return estimates.map(estimate => {
        // Calcular multiplier real basado en el data model "Multiplier Ranges"
        let multiplier = 'N/A';
        let multiplierSource = 'N/A'; // Para debugging
        
        // Verificar si hay subcontratistas
        const hasSubCost = estimate.sub_services_retail_cost && parseFloat(estimate.sub_services_retail_cost) > 0;
        
        // Para estimates con subcontratistas, usar el multiplier estándar del rango base
        if (hasSubCost) {
            const subCost = parseFloat(estimate.sub_services_retail_cost) || 0;
            const baseCost = (parseFloat(estimate.true_cost) || 0) - subCost;
            
            // Usar el multiplier estándar basado en el baseCost
            if (baseCost > 6000) {
                multiplier = '2.25';
                multiplierSource = 'standard_range_6000+_with_sub';
            } else if (baseCost > 1700) {
                multiplier = '2.5';
                multiplierSource = 'standard_range_1700-6000_with_sub';
            } else if (baseCost > 0) {
                multiplier = '2.75';
                multiplierSource = 'standard_range_0-1700_with_sub';
            }
        } else {
            // 1. Primero verificar si hay un multiplierOverride específico (prioridad más alta)
            if (estimate.multiplierOverride) {
                multiplier = estimate.multiplierOverride.toString();
                multiplierSource = 'multiplierOverride';
            } 
            // 2. Buscar en el data model "Multiplier Ranges" según la lógica de Eli
            else if (estimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
                const multiplierRanges = estimate.estimateSnapshot.snapshotData.multiplierRanges;
                // Usar el costo base sin subcontratistas para determinar el rango
                // El true_cost ya incluye subcontratistas, necesitamos el costo base
                const subCost = estimate.sub_services_retail_cost || 0;
                const baseCost = (estimate.true_cost || 0) - subCost;
                
                // Buscar el rango donde el baseCost cae dentro del min/max
                let foundRange = null;
                
                for (const range of multiplierRanges) {
                    const minCost = range.minCost || 0;
                    const maxCost = range.maxCost || Infinity;
                    
                    // Verificar si el baseCost cae dentro del rango
                    if (baseCost >= minCost && baseCost <= maxCost) {
                        foundRange = range;
                        break;
                    }
                }
                
                if (foundRange) {
                    multiplier = foundRange.lowestMultiple.toString();
                    multiplierSource = `MultiplierRanges (${foundRange.minCost}-${foundRange.maxCost})`;
                } else {
                    // Si no se encuentra rango, usar el índice del global_info como fallback
                    const selectedRangeIndex = estimate.global_info?.['2'];
                    if (selectedRangeIndex !== undefined && multiplierRanges[selectedRangeIndex]) {
                        const selectedRange = multiplierRanges[selectedRangeIndex];
                        multiplier = selectedRange.lowestMultiple.toString();
                        multiplierSource = `global_info[2] index`;
                    } else {
                        // Último fallback: usar el primer rango disponible
                        multiplier = multiplierRanges[0]?.lowestMultiple?.toString() || 'N/A';
                        multiplierSource = 'first_range_fallback';
                    }
                }
            } 
            // 3. Fallback final: calcular basado en rangos estándar
            else {
                const totalCost = estimate.true_cost || 0;
                if (totalCost > 6000) {
                    multiplier = '2.25';
                    multiplierSource = 'standard_range_6000+';
                } else if (totalCost > 1700) {
                    multiplier = '2.5';
                    multiplierSource = 'standard_range_1700-6000';
                } else if (totalCost > 0) {
                    multiplier = '2.75';
                    multiplierSource = 'standard_range_0-1700';
                }
            }
        }

        // Usar el precio final real (ya incluye impuestos si corresponde)
        const finalPrice = estimate.final_price;

        // Calcular error del multiplier considerando descuentos
        let errorPercentage = 'N/A';
        let errorCategory = 'N/A';
        let discountApplied = estimate.discount_provided || 0;
        let adjustedMultiplier = multiplier;
        
        if (multiplier !== 'N/A' && estimate.true_cost && finalPrice) {
            const trueCostNum = parseFloat(estimate.true_cost);
            const finalPriceNum = parseFloat(finalPrice);
            const multiplierNum = parseFloat(multiplier);
            
            if (trueCostNum > 0 && finalPriceNum > 0 && multiplierNum > 0) {
                // Calcular precio esperado con multiplier
                const expectedPriceWithMultiplier = trueCostNum * multiplierNum;
                
                // Aplicar descuento si existe
                let expectedPriceAfterDiscount = expectedPriceWithMultiplier;
                if (discountApplied > 0) {
                    expectedPriceAfterDiscount = expectedPriceWithMultiplier * (1 - discountApplied / 100);
                }
                
                // Calcular error considerando el descuento
                const absoluteError = Math.abs(expectedPriceAfterDiscount - finalPriceNum);
                errorPercentage = ((absoluteError / finalPriceNum) * 100).toFixed(2);
                
                const errorNum = parseFloat(errorPercentage);
                if (errorNum <= 5) {
                    errorCategory = 'BAJO';
                } else if (errorNum <= 10) {
                    errorCategory = 'MEDIO';
                } else {
                    errorCategory = 'ALTO';
                }
                
                // Calcular multiplier ajustado (incluyendo descuento)
                if (discountApplied > 0) {
                    adjustedMultiplier = (multiplierNum * (1 - discountApplied / 100)).toFixed(2);
                }
            }
        }

        // Usar la misma lógica que automation.controller.js para Kent y Everett
        const branchName = estimate.branch?.name?.toLowerCase() || '';
        let displayPrice = finalPrice;
        
        // Debug removido para producción
        
        // Lógica para Kent-WA y Everett-WA
        if (branchName.includes('kent') || branchName.includes('everett')) {
            if (estimate.tax_details?.final_price_after_taxes) {
                // Si existe tax_details, usarlo
                displayPrice = estimate.tax_details.final_price_after_taxes;
            } else {
                // Si no existe tax_details, aplicar taxes al final_price
                // Para Washington, tax rate es aproximadamente 10.1%
                const taxRate = 0.101;
                const priceWithTax = finalPrice * (1 + taxRate);
                displayPrice = priceWithTax;
            }
        }

        // Calcular After Sub Multiplier
        const trueCost = estimate.true_cost || 0;
        const subCost = estimate.sub_services_retail_cost || 0;
        const afterSubMultiplier = trueCost > 0 ? ((trueCost + subCost) / trueCost).toFixed(2) : 'N/A';

        return {
            jobName: estimate.name || 'Unnamed Estimate',
            createdBy: estimate.user?.name || 'N/A',
            status: estimate.status || 'N/A',
            proposedCost: displayPrice ? parseFloat(displayPrice) : null,
            multiplier: multiplier !== 'N/A' ? parseFloat(multiplier) : null,
            discountApplied: discountApplied > 0 ? parseFloat(discountApplied) : 0,
            totalNonSubCost: estimate.true_cost ? parseFloat(estimate.true_cost) : null,
            totalSubCost: estimate.sub_services_retail_cost ? parseFloat(estimate.sub_services_retail_cost) : null,
            afterSubMultiplier: afterSubMultiplier !== 'N/A' ? parseFloat(afterSubMultiplier) : null,
            retailPrice: estimate.retail_cost ? parseFloat(estimate.retail_cost) : null,
            branchName: estimate.branch?.name || 'N/A',
            createdAt: estimate.createdAt ? new Date(estimate.createdAt) : null,
            soldDate: estimate.updatedAt ? new Date(estimate.updatedAt) : null
        };
    });
}

/**
 * Genera el archivo Excel con múltiples hojas por branch
 */
async function generateExcelFile(processedEstimates) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'BotZilla API';
    workbook.lastModifiedBy = 'BotZilla Sold Estimates Script';
    workbook.created = new Date();
    workbook.modified = new Date();

    // Agrupar estimates por branch
    const estimatesByBranch = {};
    processedEstimates.forEach(estimate => {
        const branchName = estimate.branchName;
        if (!estimatesByBranch[branchName]) {
            estimatesByBranch[branchName] = [];
        }
        estimatesByBranch[branchName].push(estimate);
    });

    console.log(`📊 Generando Excel con ${Object.keys(estimatesByBranch).length} branches...`);

    // Crear una hoja por cada branch
    for (const [branchName, estimates] of Object.entries(estimatesByBranch)) {
        const worksheet = workbook.addWorksheet(branchName || 'Sin Branch');
        
        // Definir columnas organizadas por secciones con formateo
        worksheet.columns = [
            // Job Data Section
            { header: 'Job Name', key: 'jobName', width: 30 },
            { header: 'Created By', key: 'createdBy', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            // Costs Section
            { header: 'Proposed Cost', key: 'proposedCost', width: 15 },
            { header: 'Multiplier', key: 'multiplier', width: 15 },
            { header: 'Discount Applied', key: 'discountApplied', width: 15 },
            { header: 'Total Non-Sub Cost', key: 'totalNonSubCost', width: 20 },
            { header: 'Total Sub Cost', key: 'totalSubCost', width: 15 },
            { header: 'After Sub Multiplier', key: 'afterSubMultiplier', width: 20 },
            { header: 'Retail Price', key: 'retailPrice', width: 15 },
            // Dates Section
            { header: 'Created Date', key: 'createdAt', width: 15 },
            { header: 'Sold Date', key: 'soldDate', width: 15 }
        ];

        // Agregar datos (los bordes se aplican después)
        estimates.forEach((estimate, index) => {
            const row = worksheet.addRow(estimate);
            
            // Aplicar formateo específico a las columnas
            // Formateo de moneda para columnas de costos
            if (row.getCell(4).value !== null) { // Proposed Cost
                row.getCell(4).numFmt = '$#,##0.00';
            }
            if (row.getCell(7).value !== null) { // Total Non-Sub Cost
                row.getCell(7).numFmt = '$#,##0.00';
            }
            if (row.getCell(8).value !== null) { // Total Sub Cost
                row.getCell(8).numFmt = '$#,##0.00';
            }
            if (row.getCell(10).value !== null) { // Retail Price
                row.getCell(10).numFmt = '$#,##0.00';
            }
            
            // Formateo de número para Discount Applied
            if (row.getCell(6).value !== null) { // Discount Applied
                row.getCell(6).numFmt = '$#,##0.00';
            }
            
            // Formateo de fechas
            if (row.getCell(11).value !== null) { // Created Date
                row.getCell(11).numFmt = 'mm/dd/yyyy';
            }
            if (row.getCell(12).value !== null) { // Sold Date
                row.getCell(12).numFmt = 'mm/dd/yyyy';
            }
        });
        
        // Borde de la última fila removido

        // Estilos para el header con secciones separadas
        const headerRow = worksheet.getRow(1);
        
        // Estilo base para todo el header
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        
        // Job Data Section (columnas A-C): Azul
        for (let i = 1; i <= 3; i++) {
            const cell = headerRow.getCell(i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF4472C4' }
            };
        }
        
        // Costs Section (columnas D-K): Verde
        for (let i = 4; i <= 11; i++) {
            const cell = headerRow.getCell(i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FF70AD47' }
            };
        }
        
        // Dates Section (columnas L-M): Naranja
        for (let i = 12; i <= 13; i++) {
            const cell = headerRow.getCell(i);
            cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFF8C00' }
            };
        }
        
        // Agregar bordes gruesos para separar secciones en TODAS las filas
        const totalRows = estimates.length + 1; // +1 para incluir el header
        
        for (let rowNum = 1; rowNum <= totalRows; rowNum++) {
            const row = worksheet.getRow(rowNum);
            
            // Borde derecho después de Job Data (columna C)
            row.getCell(3).border = {
                right: { style: 'thick', color: { argb: 'FF000000' } }
            };
            
            // Borde derecho después de Retail Price (columna J)
            row.getCell(10).border = {
                right: { style: 'thick', color: { argb: 'FF000000' } }
            };
        }

        // Auto-filter (actualizado para las nuevas columnas)
        worksheet.autoFilter = {
            from: 'A1',
            to: `L${estimates.length + 1}`
        };

        console.log(`✅ Hoja "${branchName}" creada con ${estimates.length} estimates`);
    }

    // Crear hoja de resumen
    const summaryWorksheet = workbook.addWorksheet('Summary');
    summaryWorksheet.columns = [
        { header: 'Branch', key: 'branch', width: 25 },
        { header: 'Total Estimates', key: 'totalEstimates', width: 20 },
        { header: 'Total Value', key: 'totalValue', width: 20 },
        { header: 'Avg Multiplier', key: 'avgMultiplier', width: 20 }
    ];

    // Calcular estadísticas por branch
    for (const [branchName, estimates] of Object.entries(estimatesByBranch)) {
        const totalValue = estimates.reduce((sum, est) => {
            const cost = est.proposedCost || 0;
            return sum + cost;
        }, 0);

        const multipliers = estimates
            .map(est => est.multiplier)
            .filter(m => m !== null && !isNaN(m));
        
        const avgMultiplier = multipliers.length > 0 
            ? (multipliers.reduce((sum, m) => sum + m, 0) / multipliers.length).toFixed(2)
            : 'N/A';

        summaryWorksheet.addRow({
            branch: branchName,
            totalEstimates: estimates.length,
            totalValue: `$${totalValue.toLocaleString('en-US', {minimumFractionDigits: 2})}`,
            avgMultiplier: avgMultiplier
        });
    }

    // Estilo para el resumen
    summaryWorksheet.getRow(1).font = { bold: true };
    summaryWorksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF70AD47' }
    };
    summaryWorksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };

    // Guardar archivo
    const fileName = `sold-estimates-${new Date().toISOString().split('T')[0]}.xlsx`;
    const filePath = path.join(__dirname, '..', 'exports', fileName);
    
    // Crear directorio si no existe
    const fs = require('fs');
    const exportDir = path.dirname(filePath);
    if (!fs.existsSync(exportDir)) {
        fs.mkdirSync(exportDir, { recursive: true });
    }

    await workbook.xlsx.writeFile(filePath);
    console.log(`📁 Archivo Excel guardado: ${filePath}`);
    
    return filePath;
}

/**
 * Función principal
 */
async function main() {
    try {
        console.log('🚀 Iniciando generación de Excel con estimates vendidos...');
        
        // Login a Attic Tech
        const token = await loginToAtticTech();

        // Fetchear estimates vendidos
        const soldEstimates = await fetchSoldEstimatesFromAtticTech(token);
        
        if (soldEstimates.length === 0) {
            console.log('⚠️ No se encontraron estimates vendidos');
            return;
        }

        // Procesar datos
        console.log('📊 Procesando datos de estimates...');
        const processedEstimates = processEstimatesData(soldEstimates);

        // Generar Excel
        console.log('📈 Generando archivo Excel...');
        const filePath = await generateExcelFile(processedEstimates);

        console.log('✅ ¡Proceso completado exitosamente!');
        console.log(`📁 Archivo generado: ${filePath}`);
        console.log(`📊 Total estimates procesados: ${processedEstimates.length}`);

    } catch (error) {
        console.error('❌ Error en el proceso:', error.message);
        process.exit(1);
    }
}

// Ejecutar script
if (require.main === module) {
    main();
}

module.exports = { main, loginToAtticTech, fetchSoldEstimatesFromAtticTech, processEstimatesData, generateExcelFile };
