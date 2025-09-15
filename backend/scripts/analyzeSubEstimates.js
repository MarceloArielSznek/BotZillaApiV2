const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function analyzeSubEstimates() {
    try {
        console.log('🔍 Analizando estimates con subcontratistas...');
        
        const token = await loginToAtticTech();
        
        const pageSize = 100;
        let page = 1;
        let allEstimates = [];
        const maxPages = 5;

        while (page <= maxPages) {
            console.log(`📄 Procesando página ${page}...`);
            
            const queryString = `limit=${pageSize}&page=${page}&depth=5&sort=-updatedAt`;

            const https = require('https');
            const options = {
                hostname: 'www.attic-tech.com',
                path: `/api/job-estimates?${queryString}`,
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json',
                    'User-Agent': 'BotZilla Export Script'
                }
            };

            const response = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try { 
                                resolve(JSON.parse(data)); 
                            } catch (e) { 
                                reject(new Error(`Error parsing response: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`Request failed: ${res.statusCode} - ${data}`));
                        }
                    });
                });
                
                req.on('error', (e) => { 
                    reject(e); 
                });
                
                req.end();
            });

            if (!response.docs || !Array.isArray(response.docs)) {
                console.log(`❌ No se encontraron datos en la página ${page}`);
                break;
            }

            // Filtrar solo estimates vendidos
            const soldEstimates = response.docs.filter(estimate => 
                estimate.status === 'Sold'
            );

            allEstimates = allEstimates.concat(soldEstimates);
            
            if (response.docs.length < pageSize) {
                console.log(`🛑 Última página detectada: ${response.docs.length} estimates`);
                break;
            }
            
            page++;
        }

        console.log(`\n📊 Total estimates vendidos encontrados: ${allEstimates.length}`);

        // Filtrar estimates con subcontratistas
        const estimatesWithSub = allEstimates.filter(estimate => 
            estimate.sub_services_retail_cost && 
            parseFloat(estimate.sub_services_retail_cost) > 0
        );

        console.log(`📊 Estimates con subcontratistas: ${estimatesWithSub.length}`);

        // Analizar cada estimate con subcontratistas
        console.log('\n📋 ANÁLISIS DETALLADO DE ESTIMATES CON SUBCONTRATISTAS:');
        console.log('='.repeat(120));
        
        estimatesWithSub.forEach((estimate, index) => {
            const trueCost = parseFloat(estimate.true_cost) || 0;
            const subCost = parseFloat(estimate.sub_services_retail_cost) || 0;
            const baseCost = trueCost - subCost;
            const finalPrice = parseFloat(estimate.final_price) || 0;
            
            // Multiplier real (final_price / true_cost)
            const actualMultiplier = trueCost > 0 ? (finalPrice / trueCost) : 0;
            
            // Multiplier base (final_price / base_cost)
            const baseMultiplier = baseCost > 0 ? (finalPrice / baseCost) : 0;
            
            console.log(`\n${index + 1}. ${estimate.name} (${estimate.branch?.name})`);
            console.log(`   True Cost: $${trueCost.toFixed(2)}`);
            console.log(`   Sub Cost: $${subCost.toFixed(2)}`);
            console.log(`   Base Cost (True - Sub): $${baseCost.toFixed(2)}`);
            console.log(`   Final Price: $${finalPrice.toFixed(2)}`);
            console.log(`   Multiplier Real (final/true): ${actualMultiplier.toFixed(2)}`);
            console.log(`   Multiplier Base (final/base): ${baseMultiplier.toFixed(2)}`);
            
            // Calcular multiplier usando nuestra lógica actual
            let calculatedMultiplier = 'N/A';
            let multiplierSource = 'N/A';
            
            if (estimate.multiplierOverride) {
                calculatedMultiplier = estimate.multiplierOverride.toString();
                multiplierSource = 'multiplierOverride';
            } else if (estimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
                const multiplierRanges = estimate.estimateSnapshot.snapshotData.multiplierRanges;
                
                // Buscar el rango donde el baseCost cae dentro del min/max
                let foundRange = null;
                
                for (const range of multiplierRanges) {
                    const minCost = range.minCost || 0;
                    const maxCost = range.maxCost || Infinity;
                    
                    if (baseCost >= minCost && baseCost <= maxCost) {
                        foundRange = range;
                        break;
                    }
                }
                
                if (foundRange) {
                    calculatedMultiplier = foundRange.lowestMultiple.toString();
                    multiplierSource = `MultiplierRanges (${foundRange.minCost}-${foundRange.maxCost})`;
                } else {
                    const selectedRangeIndex = estimate.global_info?.['2'];
                    if (selectedRangeIndex !== undefined && multiplierRanges[selectedRangeIndex]) {
                        const selectedRange = multiplierRanges[selectedRangeIndex];
                        calculatedMultiplier = selectedRange.lowestMultiple.toString();
                        multiplierSource = `global_info[2] index`;
                    } else {
                        calculatedMultiplier = multiplierRanges[0]?.lowestMultiple?.toString() || 'N/A';
                        multiplierSource = 'first_range_fallback';
                    }
                }
            } else {
                if (baseCost > 6000) {
                    calculatedMultiplier = '2.25';
                    multiplierSource = 'standard_range_6000+';
                } else if (baseCost > 1700) {
                    calculatedMultiplier = '2.5';
                    multiplierSource = 'standard_range_1700-6000';
                } else if (baseCost > 0) {
                    calculatedMultiplier = '2.75';
                    multiplierSource = 'standard_range_0-1700';
                }
            }
            
            console.log(`   Multiplier Calculado: ${calculatedMultiplier} (${multiplierSource})`);
            
            // Comparar con el multiplier real
            if (calculatedMultiplier !== 'N/A') {
                const calcMultiplier = parseFloat(calculatedMultiplier);
                const diff = Math.abs(calcMultiplier - actualMultiplier);
                console.log(`   Diferencia con Real: ${diff.toFixed(2)}`);
                
                // Sugerir cuál usar
                if (diff < 0.1) {
                    console.log(`   ✅ Multiplier calculado es correcto`);
                } else {
                    console.log(`   ❌ Multiplier calculado difiere del real`);
                    console.log(`   💡 Sugerencia: Usar multiplier real (${actualMultiplier.toFixed(2)})`);
                }
            }
            
            // Mostrar multiplier ranges si están disponibles
            if (estimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
                console.log(`   📊 Multiplier Ranges disponibles:`);
                estimate.estimateSnapshot.snapshotData.multiplierRanges.forEach((range, idx) => {
                    console.log(`      Range ${idx}: ${range.minCost}-${range.maxCost} = ${range.lowestMultiple}`);
                });
            }
        });
        
        // Exportar análisis a JSON
        const fs = require('fs');
        const path = require('path');
        const analysis = estimatesWithSub.map(estimate => {
            const trueCost = parseFloat(estimate.true_cost) || 0;
            const subCost = parseFloat(estimate.sub_services_retail_cost) || 0;
            const baseCost = trueCost - subCost;
            const finalPrice = parseFloat(estimate.final_price) || 0;
            const actualMultiplier = trueCost > 0 ? (finalPrice / trueCost) : 0;
            const baseMultiplier = baseCost > 0 ? (finalPrice / baseCost) : 0;
            
            return {
                name: estimate.name,
                branch: estimate.branch?.name,
                trueCost,
                subCost,
                baseCost,
                finalPrice,
                actualMultiplier: actualMultiplier.toFixed(2),
                baseMultiplier: baseMultiplier.toFixed(2)
            };
        });
        
        const jsonData = JSON.stringify(analysis, null, 2);
        const fileName = `sub_estimates_analysis_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(__dirname, '..', 'exports', fileName);
        
        const exportDir = path.dirname(filePath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonData);
        console.log(`\n📄 Análisis exportado a: ${filePath}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

analyzeSubEstimates();
