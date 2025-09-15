const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function debugMultiplierLogic() {
    try {
        console.log('🔍 Debuggeando lógica del multiplier...');
        
        const token = await loginToAtticTech();
        
        const pageSize = 50;
        let page = 1;
        let allEstimates = [];
        const maxPages = 3;

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

            // Filtrar solo estimates vendidos con subcontratistas
            const soldEstimatesWithSub = response.docs.filter(estimate => 
                estimate.status === 'Sold' && 
                estimate.sub_services_retail_cost && 
                parseFloat(estimate.sub_services_retail_cost) > 0
            );

            allEstimates = allEstimates.concat(soldEstimatesWithSub);
            
            if (response.docs.length < pageSize) {
                console.log(`🛑 Última página detectada: ${response.docs.length} estimates`);
                break;
            }
            
            page++;
        }

        console.log(`\n📊 Total estimates con subcontratistas encontrados: ${allEstimates.length}`);

        // Analizar cada estimate
        console.log('\n📋 ANÁLISIS DETALLADO DE MULTIPLIER LOGIC:');
        console.log('='.repeat(120));
        
        allEstimates.slice(0, 10).forEach((estimate, index) => {
            const trueCost = parseFloat(estimate.true_cost) || 0;
            const subCost = parseFloat(estimate.sub_services_retail_cost) || 0;
            const baseCost = trueCost - subCost;
            const finalPrice = parseFloat(estimate.final_price) || 0;
            
            console.log(`\n${index + 1}. ${estimate.name} (${estimate.branch?.name})`);
            console.log(`   True Cost: $${trueCost.toFixed(2)}`);
            console.log(`   Sub Cost: $${subCost.toFixed(2)}`);
            console.log(`   Base Cost (True - Sub): $${baseCost.toFixed(2)}`);
            console.log(`   Final Price: $${finalPrice.toFixed(2)}`);
            
            // Diferentes cálculos de multiplier
            const multiplier1 = trueCost > 0 ? (finalPrice / trueCost) : 0; // final/true
            const multiplier2 = baseCost > 0 ? (finalPrice / baseCost) : 0; // final/base
            const multiplier3 = baseCost > 0 ? ((trueCost + subCost) / baseCost) : 0; // (true+sub)/base
            
            console.log(`   Multiplier 1 (final/true): ${multiplier1.toFixed(2)}`);
            console.log(`   Multiplier 2 (final/base): ${multiplier2.toFixed(2)}`);
            console.log(`   Multiplier 3 ((true+sub)/base): ${multiplier3.toFixed(2)}`);
            
            // Verificar si hay multiplierOverride
            if (estimate.multiplierOverride) {
                console.log(`   Multiplier Override: ${estimate.multiplierOverride}`);
            }
            
            // Verificar multiplier ranges
            if (estimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
                const multiplierRanges = estimate.estimateSnapshot.snapshotData.multiplierRanges;
                console.log(`   📊 Multiplier Ranges disponibles:`);
                multiplierRanges.forEach((range, idx) => {
                    console.log(`      Range ${idx}: ${range.minCost}-${range.maxCost} = ${range.lowestMultiple}`);
                });
                
                // Buscar el rango correcto para baseCost
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
                    console.log(`   ✅ Rango encontrado para base cost $${baseCost}: ${foundRange.minCost}-${foundRange.maxCost} = ${foundRange.lowestMultiple}`);
                } else {
                    console.log(`   ❌ No se encontró rango para base cost $${baseCost}`);
                }
            }
            
            // Verificar si hay algún campo específico de multiplier
            console.log(`   🔍 Campos relacionados con multiplier:`);
            if (estimate.multiplier) console.log(`      - multiplier: ${estimate.multiplier}`);
            if (estimate.multiplierValue) console.log(`      - multiplierValue: ${estimate.multiplierValue}`);
            if (estimate.appliedMultiplier) console.log(`      - appliedMultiplier: ${estimate.appliedMultiplier}`);
            if (estimate.finalMultiplier) console.log(`      - finalMultiplier: ${estimate.finalMultiplier}`);
            
            // Verificar global_info
            if (estimate.global_info) {
                console.log(`   📊 Global Info:`, JSON.stringify(estimate.global_info, null, 2));
            }
        });
        
        // Exportar algunos estimates completos para análisis
        const fs = require('fs');
        const path = require('path');
        const jsonData = JSON.stringify(allEstimates.slice(0, 5), null, 2);
        const fileName = `multiplier_debug_${new Date().toISOString().split('T')[0]}.json`;
        const filePath = path.join(__dirname, '..', 'exports', fileName);
        
        const exportDir = path.dirname(filePath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonData);
        console.log(`\n📄 Estimates completos exportados a: ${filePath}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugMultiplierLogic();
