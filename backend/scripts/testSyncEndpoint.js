const https = require('https');
require('dotenv').config();

const API_KEY = process.env.AUTOMATION_API_KEY;
const NGROK_URL = process.env.NGROK_FORWARDING_URL;

if (!API_KEY || !NGROK_URL) {
    console.error('❌ Error: Debes configurar AUTOMATION_API_KEY y NGROK_FORWARDING_URL en tu archivo .env que debe estar en el directorio /backend.');
    process.exit(1);
}

if (NGROK_URL.includes('<tu-url-de-ngrok>')) {
    console.error('❌ Error: La variable NGROK_FORWARDING_URL en tu archivo .env todavía contiene el valor de ejemplo.');
    console.error('   Por favor, reemplázalo con tu URL de ngrok real (ej: https://faf8bc8b4a7e.ngrok-free.app)');
    process.exit(1);
}

const url = new URL(NGROK_URL);

const options = {
    method: 'POST',
    hostname: url.hostname,
    path: '/api/automations/sync-inspection-reports',
    headers: {
        'X-API-Key': API_KEY,
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true'
    }
};

const req = https.request(options, (res) => {
    let data = '';
    console.log(`STATUS: ${res.statusCode}`);
    
    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const response = JSON.parse(data);
            console.log('\n--- Respuesta del Endpoint ---');
            console.log('Mensaje:', response.message);
            
            if (response.notifications && response.notifications.length > 0) {
                console.log(`\n✅ Se encontraron ${response.notifications.length} notificaciones pendientes:\n`);
                
                response.notifications.forEach((notif, index) => {
                    console.log(`--- Notificación #${index + 1} ---`);
                    console.log('  (Datos formateados para lectura fácil)');
                    console.log(`  Tipo de Servicio: ${notif.service_type}`);
                    console.log(`  Nombre del Trabajo: ${notif.job_name}`);
                    console.log(`  Cliente: ${notif.cx_name} (${notif.cx_phone})`);
                    console.log(`  Email Cliente: ${notif.client_email}`);
                    console.log(`  Dirección: ${notif.job_address}`);
                    console.log(`  Sucursal: ${notif.branch}`);
                    console.log(`  Vendedor: ${notif.salesperson_name}`);
                    console.log(`  Link: ${notif.estimate_link}`);
                    console.log('\n  (JSON crudo que recibirá Make.com)');
                    console.log(JSON.stringify(notif, null, 2));
                    console.log('-------------------------------------\n');
                });
            } else {
                console.log('\nℹ️ No se generaron nuevas notificaciones.');
            }
        } catch (e) {
            console.error('Error al parsear la respuesta JSON:', e);
            console.log('Respuesta en crudo:', data);
        }
    });
});

req.on('error', (e) => {
    console.error(`Error en la solicitud: ${e.message}`);
});

// Enviar un body JSON vacío
req.write(JSON.stringify({}));
req.end();
