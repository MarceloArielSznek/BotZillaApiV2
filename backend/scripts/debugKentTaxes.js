const { loginToAtticTech } = require('./generateSoldEstimatesExcel');
const fs = require('fs');
const path = require('path');

async function debugKentTaxes() {
    try {
        console.log('🔍 Debuggeando taxes de Kent-WA...');
        
        const token = await loginToAtticTech();
        
        // Buscar específicamente estimates de Kent-WA
        console.log('🔍 Buscando estimates de Kent-WA...');
        
        const pageSize = 100;
        let page = 1;
        let kentEstimates = [];
        const maxPages = 20; // Buscar en más páginas para encontrar Kent-WA

        while (page <= maxPages && kentEstimates.length < 3) {
            console.log(`📄 Buscando en página ${page}...`);
            
            const queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-updatedAt`;

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
                console.log('Response keys:', Object.keys(response));
                console.log('Response docs type:', typeof response.docs);
                if (response.docs) {
                    console.log('Response docs keys:', Object.keys(response.docs));
                }
                page++;
                continue;
            }
            
            // Filtrar solo estimates vendidos de Kent-WA (verificar diferentes variaciones del nombre)
            const kentEstimatesInPage = response.docs.filter(estimate => 
                estimate.status === 'sold' && 
                (estimate.branch?.name === 'Kent -WA ' || 
                 estimate.branch?.name === 'Kent -WA' ||
                 estimate.branch?.name?.toLowerCase().includes('kent'))
            );
            
            console.log(`📊 ${kentEstimatesInPage.length} estimates de Kent-WA encontrados en página ${page}`);
            
            kentEstimates = kentEstimates.concat(kentEstimatesInPage);
            page++;
        }
        
        if (kentEstimates.length === 0) {
            console.log('❌ No se encontraron estimates de Kent-WA');
            return;
        }
        
        console.log(`\n📊 Analizando ${kentEstimates.length} estimates de Kent-WA...`);
        
        // Analizar cada estimate de Kent-WA
        kentEstimates.forEach((estimate, index) => {
            console.log(`\n--- Estimate ${index + 1}: ${estimate.name} ---`);
            console.log(`Branch: ${estimate.branch?.name}`);
            console.log(`True Cost: $${estimate.true_cost}`);
            console.log(`Final Price: $${estimate.final_price}`);
            
            // Verificar tax_details
            if (estimate.tax_details) {
                console.log('✅ tax_details encontrado:');
                console.log('  - Keys disponibles:', Object.keys(estimate.tax_details));
                
                if (estimate.tax_details.final_price_after_taxes) {
                    console.log(`  - final_price_after_taxes: $${estimate.tax_details.final_price_after_taxes}`);
                } else {
                    console.log('  - ❌ final_price_after_taxes NO encontrado');
                }
                
                // Mostrar todos los valores de tax_details
                Object.entries(estimate.tax_details).forEach(([key, value]) => {
                    console.log(`  - ${key}: ${value}`);
                });
            } else {
                console.log('❌ tax_details NO encontrado');
            }
            
            // Aplicar la lógica del script
            const branchName = estimate.branch?.name?.toLowerCase() || '';
            let displayPrice = estimate.final_price;
            if ((branchName.includes('kent') || branchName.includes('everett')) && estimate.tax_details?.final_price_after_taxes) {
                displayPrice = estimate.tax_details.final_price_after_taxes;
                console.log(`✅ Aplicando tax_details.final_price_after_taxes: $${displayPrice}`);
            } else {
                console.log(`❌ Usando final_price (sin taxes): $${displayPrice}`);
            }
        });
        
        // Exportar el primer estimate completo a JSON para análisis detallado
        if (kentEstimates.length > 0) {
            const firstEstimate = kentEstimates[0];
            const jsonData = JSON.stringify(firstEstimate, null, 2);
            const fileName = `kent_estimate_debug_${firstEstimate.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
            const filePath = path.join(__dirname, '..', 'exports', fileName);
            
            // Crear directorio si no existe
            const exportDir = path.dirname(filePath);
            if (!fs.existsSync(exportDir)) {
                fs.mkdirSync(exportDir, { recursive: true });
            }
            
            fs.writeFileSync(filePath, jsonData);
            
            console.log(`\n📄 Estimate completo exportado a: ${filePath}`);
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugKentTaxes();
