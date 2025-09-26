const fs = require('fs');
const path = require('path');
const https = require('https');
const { loginToAtticTech } = require('./generateSoldEstimatesExcel');

/**
 * Fetches a single estimate by its ID from the Attic Tech API.
 * @param {string} estimateId The ID of the estimate to fetch.
 */
async function fetchEstimateById(estimateId) {
    if (!estimateId) {
        console.error('❌ Error: Por favor, proporciona un ID de estimate.');
        console.log('Uso: node scripts/fetchEstimateById.js <estimateId>');
        return;
    }

    try {
        console.log(`🔍 Iniciando la búsqueda para el estimate ID: ${estimateId}`);

        const token = await loginToAtticTech();
        console.log('✅ Autenticación exitosa.');

        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/job-estimates/${estimateId}?depth=5`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Fetch Script'
            }
        };

        const responseData = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Error parseando la respuesta JSON: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`La solicitud falló: ${res.statusCode} - ${data}`));
                    }
                });
            });
            req.on('error', (e) => reject(e));
            req.end();
        });

        console.log('✅ Estimate encontrado exitosamente.');

        const jsonData = JSON.stringify(responseData, null, 2);
        const fileName = `estimate_${estimateId}_details.json`;
        const filePath = path.join(__dirname, '..', 'exports', fileName);

        const exportDir = path.dirname(filePath);
        if (!fs.existsSync(exportDir)) {
            fs.mkdirSync(exportDir, { recursive: true });
        }

        fs.writeFileSync(filePath, jsonData);
        console.log(`📄✅ Estimate completo exportado a: ${filePath}`);

    } catch (error) {
        console.error('❌ Error durante el proceso:', error.message);
    }
}

// Obtener el ID del estimate desde los argumentos de la línea de comandos
const estimateId = process.argv[2];
fetchEstimateById(estimateId);
