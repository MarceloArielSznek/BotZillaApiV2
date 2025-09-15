const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

async function debugEstimatesStatus() {
    try {
        console.log('🔍 Debuggeando estados de estimates...');
        
        const token = await loginToAtticTech();
        
        const pageSize = 50;
        let page = 1;
        const maxPages = 3;

        while (page <= maxPages) {
            console.log(`\n📄 Página ${page}:`);
            
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

            console.log(`📊 Total estimates en página: ${response.docs.length}`);
            
            // Contar por status
            const statusCount = {};
            response.docs.forEach(estimate => {
                const status = estimate.status || 'unknown';
                statusCount[status] = (statusCount[status] || 0) + 1;
            });
            
            console.log('📋 Estados encontrados:');
            Object.entries(statusCount).forEach(([status, count]) => {
                console.log(`   ${status}: ${count}`);
            });
            
            // Mostrar algunos ejemplos de cada status
            console.log('\n📋 Ejemplos por estado:');
            Object.keys(statusCount).forEach(status => {
                const examples = response.docs.filter(est => (est.status || 'unknown') === status).slice(0, 3);
                console.log(`\n${status}:`);
                examples.forEach(est => {
                    console.log(`   - ${est.name} (${est.branch?.name})`);
                });
            });
            
            page++;
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

debugEstimatesStatus();
