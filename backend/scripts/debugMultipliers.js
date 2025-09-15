const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function debugMultipliers() {
    try {
        console.log('🔍 Debuggeando multipliers...');
        
        const token = await loginToAtticTech();
        
        // Solo buscar en la primera página para obtener algunos estimates
        console.log('🔍 Buscando estimates para debug de multipliers...');
        
        const pageSize = 10;
        const queryString = `limit=${pageSize}&page=1&depth=5&sort=-updatedAt`;

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
            console.log('❌ No se encontraron datos en la respuesta');
            return;
        }
        
        // Filtrar solo estimates vendidos
        const soldEstimates = response.docs.filter(est => est.status === 'Sold');
        
        console.log(`📊 Analizando ${soldEstimates.length} estimates vendidos...`);
        
        // Analizar cada estimate
        soldEstimates.forEach((estimate, index) => {
            console.log(`\n--- Estimate ${index + 1}: ${estimate.name} ---`);
            console.log(`Branch: ${estimate.branch?.name}`);
            console.log(`True Cost: $${estimate.true_cost}`);
            console.log(`Final Price: $${estimate.final_price}`);
            
            // Debug multiplier calculation
            let multiplier = 'N/A';
            let multiplierSource = 'N/A';
            
            // 1. Primero verificar si hay un multiplierOverride específico
            if (estimate.multiplierOverride) {
                multiplier = estimate.multiplierOverride.toString();
                multiplierSource = 'multiplierOverride';
                console.log(`✅ Multiplier Override: ${multiplier}`);
            } 
            // 2. Buscar en el data model "Multiplier Ranges"
            else if (estimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
                const multiplierRanges = estimate.estimateSnapshot.snapshotData.multiplierRanges;
                const totalCost = estimate.true_cost || 0;
                let foundRange = null;
                
                console.log(`📊 Multiplier Ranges disponibles: ${multiplierRanges.length}`);
                multiplierRanges.forEach((range, idx) => {
                    console.log(`  Range ${idx}: ${range.minCost}-${range.maxCost} = ${range.lowestMultiple}`);
                });
                
                for (const range of multiplierRanges) {
                    const minCost = range.minCost || 0;
                    const maxCost = range.maxCost || Infinity;
                    if (totalCost >= minCost && totalCost <= maxCost) {
                        foundRange = range;
                        break;
                    }
                }
                
                if (foundRange) {
                    multiplier = foundRange.lowestMultiple.toString();
                    multiplierSource = `MultiplierRanges (${foundRange.minCost}-${foundRange.maxCost})`;
                    console.log(`✅ Encontrado rango: ${foundRange.minCost}-${foundRange.maxCost} = ${multiplier}`);
                } else {
                    const selectedRangeIndex = estimate.global_info?.['2'];
                    if (selectedRangeIndex !== undefined && multiplierRanges[selectedRangeIndex]) {
                        const selectedRange = multiplierRanges[selectedRangeIndex];
                        multiplier = selectedRange.lowestMultiple.toString();
                        multiplierSource = `global_info[2] index`;
                        console.log(`✅ Usando global_info[2] index: ${selectedRangeIndex} = ${multiplier}`);
                    } else {
                        multiplier = multiplierRanges[0]?.lowestMultiple?.toString() || 'N/A';
                        multiplierSource = 'first_range_fallback';
                        console.log(`⚠️ Usando primer rango como fallback: ${multiplier}`);
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
                console.log(`⚠️ Usando rangos estándar: ${multiplier} (${multiplierSource})`);
            }
            
            // Calcular multiplier real basado en true_cost y final_price
            const trueCost = estimate.true_cost || 0;
            const finalPrice = estimate.final_price || 0;
            const actualMultiplier = trueCost > 0 ? (finalPrice / trueCost).toFixed(2) : 'N/A';
            
            console.log(`📊 Multiplier calculado: ${multiplier} (${multiplierSource})`);
            console.log(`📊 Multiplier real (final_price/true_cost): ${actualMultiplier}`);
            
            if (multiplier !== 'N/A' && actualMultiplier !== 'N/A') {
                const diff = Math.abs(parseFloat(multiplier) - parseFloat(actualMultiplier));
                if (diff > 0.1) {
                    console.log(`❌ DIFERENCIA DETECTADA: ${diff.toFixed(2)}`);
                } else {
                    console.log(`✅ Multiplier correcto`);
                }
            }
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugMultipliers();
