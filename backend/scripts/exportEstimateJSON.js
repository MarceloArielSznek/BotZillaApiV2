const { loginToAtticTech } = require('./generateSoldEstimatesExcel');
const fs = require('fs');
const path = require('path');

async function exportEstimateJSON() {
    try {
        console.log('🔍 Exportando estimate de Washington a JSON...');
        
        const token = await loginToAtticTech();
        
        // Buscar en múltiples páginas hasta encontrar un estimate de Washington
        console.log('🔍 Buscando estimates de Washington...');
        
        const pageSize = 100;
        let page = 1;
        let waEstimate = null;
        const maxPages = 10; // Buscar en máximo 10 páginas

        while (page <= maxPages && !waEstimate) {
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

            // Verificar que response.data existe
            if (!response.data || !Array.isArray(response.data)) {
                console.log(`❌ No se encontraron datos en la página ${page}`);
                console.log('Response keys:', Object.keys(response));
                page++;
                continue;
            }
            
            console.log(`📊 Encontrados ${response.data.length} estimates en la página ${page}`);
            
            // Filtrar solo estimates vendidos de Washington
            const waEstimates = response.data.filter(estimate => 
                estimate.status === 'sold' && 
                (estimate.branch?.name === 'Everett -WA' || estimate.branch?.name === 'Kent -WA ')
            );
            
            console.log(`📊 ${waEstimates.length} estimates vendidos de Washington encontrados en página ${page}`);
            
            if (waEstimates.length > 0) {
                waEstimate = waEstimates[0];
                console.log(`✅ Encontrado estimate de Washington en página ${page}`);
                break;
            }
            
            page++;
        }
        
        if (!waEstimate) {
            console.log('❌ No se encontraron estimates de Washington en las primeras 10 páginas');
            return;
        }
        
        // waEstimate ya está definido en el while loop
        
        console.log(`\n📊 Exportando estimate: ${waEstimate.name}`);
        console.log(`   Branch: ${waEstimate.branch?.name}`);
        console.log(`   True Cost: $${waEstimate.true_cost}`);
        console.log(`   Final Price: $${waEstimate.final_price}`);
        
        // Exportar el estimate completo a JSON
        const jsonData = JSON.stringify(waEstimate, null, 2);
        const fileName = `estimate_${waEstimate.name.replace(/[^a-zA-Z0-9]/g, '_')}_${waEstimate.branch?.name.replace(/[^a-zA-Z0-9]/g, '_')}.json`;
        const filePath = path.join(__dirname, '..', 'exports', fileName);
        
        // Crear directorio si no existe
        const exportDir = path.dirname(filePath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, jsonData);
        
        console.log(`\n✅ Estimate exportado a: ${filePath}`);
        console.log(`📄 Archivo: ${fileName}`);
        console.log(`📊 Tamaño: ${(jsonData.length / 1024).toFixed(2)} KB`);
        
        console.log('\n🔍 Por favor, revisa el archivo JSON para encontrar el campo que contiene el precio después de taxes.');

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

exportEstimateJSON();
