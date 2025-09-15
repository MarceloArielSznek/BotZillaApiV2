const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function analyzeMultiplierPattern() {
    try {
        console.log('🔍 Analizando patrón de multipliers en estimates vendidos...');
        
        const token = await loginToAtticTech();
        
        const pageSize = 100;
        let page = 1;
        let allEstimates = [];
        const maxPages = 20; // Buscar en más páginas

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
                estimate.status === 'sold'
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

        // Analizar cada estimate
        const analysis = [];
        
        for (const estimate of allEstimates) {
            const trueCost = parseFloat(estimate.true_cost) || 0;
            const subCost = parseFloat(estimate.sub_services_retail_cost) || 0;
            const baseCost = trueCost - subCost;
            const finalPrice = parseFloat(estimate.final_price) || 0;
            
            // Multiplier real (final_price / true_cost)
            const actualMultiplier = trueCost > 0 ? (finalPrice / trueCost) : 0;
            
            // Multiplier base (final_price / base_cost)
            const baseMultiplier = baseCost > 0 ? (finalPrice / baseCost) : 0;
            
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
            
            const hasSub = subCost > 0;
            
            analysis.push({
                name: estimate.name,
                branch: estimate.branch?.name,
                hasSub,
                trueCost,
                subCost,
                baseCost,
                finalPrice,
                actualMultiplier: actualMultiplier.toFixed(2),
                baseMultiplier: baseMultiplier.toFixed(2),
                calculatedMultiplier,
                multiplierSource,
                difference: calculatedMultiplier !== 'N/A' ? 
                    Math.abs(parseFloat(calculatedMultiplier) - actualMultiplier).toFixed(2) : 'N/A'
            });
        }
        
        // Mostrar análisis detallado solo para estimates con subcontratistas
        console.log('\n📋 ANÁLISIS DETALLADO (Estimates con Subcontratistas):');
        console.log('='.repeat(120));
        
        const estimatesWithSubAnalysis = analysis.filter(item => item.hasSub);
        
        if (estimatesWithSubAnalysis.length === 0) {
            console.log('❌ No se encontraron estimates con subcontratistas');
        } else {
            estimatesWithSubAnalysis.forEach((item, index) => {
                console.log(`\n${index + 1}. ${item.name} (${item.branch})`);
                console.log(`   True Cost: $${item.trueCost.toFixed(2)}`);
                console.log(`   Sub Cost: $${item.subCost.toFixed(2)}`);
                console.log(`   Base Cost: $${item.baseCost.toFixed(2)}`);
                console.log(`   Final Price: $${item.finalPrice.toFixed(2)}`);
                console.log(`   Multiplier Real (final/true): ${item.actualMultiplier}`);
                console.log(`   Multiplier Base (final/base): ${item.baseMultiplier}`);
                console.log(`   Multiplier Calculado: ${item.calculatedMultiplier} (${item.multiplierSource})`);
                console.log(`   Diferencia: ${item.difference}`);
            });
        }
        
        // Mostrar algunos ejemplos de estimates sin subcontratistas para comparar
        console.log('\n📋 EJEMPLOS (Estimates sin Subcontratistas):');
        console.log('='.repeat(120));
        
        const estimatesWithoutSub = analysis.filter(item => !item.hasSub).slice(0, 5);
        
        estimatesWithoutSub.forEach((item, index) => {
            console.log(`\n${index + 1}. ${item.name} (${item.branch})`);
            console.log(`   True Cost: $${item.trueCost.toFixed(2)}`);
            console.log(`   Final Price: $${item.finalPrice.toFixed(2)}`);
            console.log(`   Multiplier Real (final/true): ${item.actualMultiplier}`);
            console.log(`   Multiplier Calculado: ${item.calculatedMultiplier} (${item.multiplierSource})`);
            console.log(`   Diferencia: ${item.difference}`);
        });
        
        // Estadísticas generales
        console.log('\n📊 ESTADÍSTICAS GENERALES:');
        console.log('='.repeat(50));
        
        const validCalculations = analysis.filter(item => item.calculatedMultiplier !== 'N/A');
        const differences = validCalculations.map(item => parseFloat(item.difference));
        
        if (differences.length > 0) {
            const avgDifference = differences.reduce((sum, diff) => sum + diff, 0) / differences.length;
            const maxDifference = Math.max(...differences);
            const minDifference = Math.min(...differences);
            
            console.log(`Total estimates analizados: ${analysis.length}`);
            console.log(`Estimates con subcontratistas: ${estimatesWithSubAnalysis.length}`);
            console.log(`Promedio de diferencia: ${avgDifference.toFixed(2)}`);
            console.log(`Diferencia máxima: ${maxDifference.toFixed(2)}`);
            console.log(`Diferencia mínima: ${minDifference.toFixed(2)}`);
        }
        
        // Exportar análisis a JSON
        const fs = require('fs');
        const path = require('path');
        const jsonData = JSON.stringify(analysis, null, 2);
        const fileName = `multiplier_analysis_${new Date().toISOString().split('T')[0]}.json`;
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

analyzeMultiplierPattern();
