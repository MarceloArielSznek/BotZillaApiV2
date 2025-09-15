const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function debugSpecificEstimate() {
    try {
        console.log('🔍 Debuggeando estimate específico: Andres Veronica - MON');
        
        const token = await loginToAtticTech();
        
        // Buscar específicamente este estimate
        console.log('🔍 Buscando estimate específico...');
        
        const pageSize = 100;
        let page = 1;
        let foundEstimate = null;
        const maxPages = 5;

        while (page <= maxPages && !foundEstimate) {
            console.log(`📄 Buscando en página ${page}...`);
            
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
                page++;
                continue;
            }
            
            // Buscar el estimate específico
            const targetEstimate = response.docs.find(est => 
                est.name && est.name.includes('Andres Veronica - MON')
            );
            
            if (targetEstimate) {
                foundEstimate = targetEstimate;
                console.log(`✅ Encontrado estimate en página ${page}`);
                break;
            }
            
            page++;
        }
        
        if (!foundEstimate) {
            console.log('❌ No se encontró el estimate específico');
            return;
        }
        
        console.log(`\n--- Estimate: ${foundEstimate.name} ---`);
        console.log(`Branch: ${foundEstimate.branch?.name}`);
        console.log(`True Cost: $${foundEstimate.true_cost}`);
        console.log(`Final Price: $${foundEstimate.final_price}`);
        console.log(`Sub Services Retail Cost: $${foundEstimate.sub_services_retail_cost}`);
        console.log(`Retail Cost: $${foundEstimate.retail_cost}`);
        
        // Debug multiplier calculation
        console.log('\n🔍 Debug Multiplier Calculation:');
        
        if (foundEstimate.multiplierOverride) {
            console.log(`✅ Multiplier Override: ${foundEstimate.multiplierOverride}`);
        }
        
        if (foundEstimate.estimateSnapshot?.snapshotData?.multiplierRanges) {
            const multiplierRanges = foundEstimate.estimateSnapshot.snapshotData.multiplierRanges;
            const baseCost = foundEstimate.true_cost || 0;
            
            console.log(`📊 Multiplier Ranges disponibles: ${multiplierRanges.length}`);
            multiplierRanges.forEach((range, idx) => {
                console.log(`  Range ${idx}: ${range.minCost}-${range.maxCost} = ${range.lowestMultiple}`);
            });
            
            console.log(`📊 Base Cost: $${baseCost}`);
            
            // Buscar el rango correcto
            let foundRange = null;
            for (const range of multiplierRanges) {
                const minCost = range.minCost || 0;
                const maxCost = range.maxCost || Infinity;
                
                if (baseCost >= minCost && baseCost <= maxCost) {
                    foundRange = range;
                    console.log(`✅ Encontrado rango: ${range.minCost}-${range.maxCost} = ${range.lowestMultiple}`);
                    break;
                }
            }
            
            if (!foundRange) {
                console.log(`❌ No se encontró rango para base cost $${baseCost}`);
                
                // Verificar global_info
                const selectedRangeIndex = foundEstimate.global_info?.['2'];
                console.log(`📊 Global Info [2]: ${selectedRangeIndex}`);
                
                if (selectedRangeIndex !== undefined && multiplierRanges[selectedRangeIndex]) {
                    const selectedRange = multiplierRanges[selectedRangeIndex];
                    console.log(`✅ Usando global_info[2] index: ${selectedRangeIndex} = ${selectedRange.lowestMultiple}`);
                }
            }
        }
        
        // Calcular multiplier real
        const trueCost = foundEstimate.true_cost || 0;
        const finalPrice = foundEstimate.final_price || 0;
        const actualMultiplier = trueCost > 0 ? (finalPrice / trueCost).toFixed(2) : 'N/A';
        
        console.log(`\n📊 Multiplier real (final_price/true_cost): ${actualMultiplier}`);
        
        // Exportar el estimate completo a JSON
        const fs = require('fs');
        const path = require('path');
        const jsonData = JSON.stringify(foundEstimate, null, 2);
        const fileName = `andres_veronica_mon_debug.json`;
        const filePath = path.join(__dirname, '..', 'exports', fileName);
        
        // Crear directorio si no existe
        const exportDir = path.dirname(filePath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonData);
        console.log(`\n📄 Estimate completo exportado a: ${filePath}`);

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugSpecificEstimate();
