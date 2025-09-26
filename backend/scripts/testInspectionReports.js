const http = require('http');

// Configuración
const API_KEY = '7f30eef84b0166d6b5cdc20ac9ee152ef6c5e4b190d2ad13800739675c1a63cc';
const BASE_URL = 'http://localhost:3333';

async function makeRequest(path, options = {}) {
    const defaultOptions = {
        method: 'POST',
        headers: {
            'X-API-Key': API_KEY,
            'Content-Type': 'application/json'
        }
    };

    const url = new URL(path, BASE_URL);
    
    return new Promise((resolve, reject) => {
        const req = http.request(
            url,
            { ...defaultOptions, ...options },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    try {
                        const jsonData = JSON.parse(data);
                        resolve({
                            statusCode: res.statusCode,
                            headers: res.headers,
                            data: jsonData
                        });
                    } catch (e) {
                        reject(new Error(`Error parsing response: ${e.message}`));
                    }
                });
            }
        );

        req.on('error', (error) => {
            reject(error);
        });

        if (options.body) {
            req.write(JSON.stringify(options.body));
        }
        req.end();
    });
}

async function testInspectionReportsSync() {
    console.log('🧪 Iniciando prueba de sincronización de reportes de inspección');

    try {
        const response = await makeRequest('/api/automations/sync-inspection-reports');
        
        console.log('\n📊 Respuesta del servidor:');
        console.log('Status:', response.statusCode);
        console.log('Data:', JSON.stringify(response.data, null, 2));

        if (response.statusCode === 200) {
            console.log('\n✅ Prueba exitosa!');
            
            if (response.data.notifications && response.data.notifications.length > 0) {
                console.log('\n📬 Notificaciones generadas:');
                response.data.notifications.forEach((notification, index) => {
                    console.log(`\nNotificación #${index + 1}:`);
                    console.log('- Tipo:', notification.type);
                    console.log('- Cliente:', notification.client_name);
                    console.log('- Vendedor:', notification.salesperson_name);
                    console.log('- Condición:', notification.condition);
                    console.log('- Link:', notification.estimate_link);
                });
            } else {
                console.log('\nℹ️ No se encontraron reportes que requieran notificación');
            }
        } else {
            console.log('\n❌ La prueba falló');
            console.log('Código de estado:', response.statusCode);
            console.log('Mensaje de error:', response.data.message || 'No hay mensaje de error');
        }
    } catch (error) {
        console.log('\n❌ Error durante la prueba:', error.message);
    }
}

testInspectionReportsSync();
