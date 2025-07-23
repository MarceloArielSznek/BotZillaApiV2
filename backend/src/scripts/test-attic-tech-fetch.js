
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');

async function loginToAtticTech() {
    console.log('🔑 Iniciando sesión en Attic Tech...');
    
    const email = process.env.ATTIC_TECH_EMAIL;
    const password = process.env.ATTIC_TECH_PASSWORD;
    
    if (!email || !password) {
        console.error('❌ Error: Las variables de entorno ATTIC_TECH_EMAIL y ATTIC_TECH_PASSWORD deben estar configuradas.');
        process.exit(1);
    }

    const loginData = JSON.stringify({ email, password });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla Test Script'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    const response = JSON.parse(data);
                    console.log('✅ Sesión iniciada correctamente.');
                    resolve(response.token);
                } else {
                    console.error(`❌ Error de inicio de sesión. Estado: ${res.statusCode}`);
                    console.error(data);
                    reject(`Fallo en el inicio de sesión con código de estado: ${res.statusCode}`);
                }
            });
        });
        
        req.on('error', (e) => {
            console.error('❌ Error en la solicitud de inicio de sesión:', e);
            reject(e);
        });
        
        req.write(loginData);
        req.end();
    });
}

async function fetchEstimates(token, fechaInicio, fechaFin, sucursalObjetivo = null, limite = null) {
    console.log(`📊 Obteniendo estimates desde ${fechaInicio} hasta ${fechaFin}...`);
    if (sucursalObjetivo) {
        console.log(`🎯 Filtrando por sucursal: ${sucursalObjetivo}`);
    }
    if (limite) {
        console.log(`📏 Límite establecido en: ${limite}`);
    }
    
    let allLeads = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    while (hasMore && (!limite || allLeads.length < limite)) {
        let queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-updatedAt`;
        if (fechaInicio) {
            queryString += `&where[createdAt][greater_than_equal]=${encodeURIComponent(fechaInicio)}`;
        }
        if (fechaFin) {
            queryString += `&where[createdAt][less_than_equal]=${encodeURIComponent(fechaFin)}`;
        }

        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/job-estimates?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Test Script'
            }
        };

        try {
            const result = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', chunk => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                console.error('❌ Error al parsear la respuesta JSON de Attic Tech.');
                                reject(e);
                            }
                        } else {
                            console.error(`❌ Error de la API de Attic Tech. Estado: ${res.statusCode}`);
                            reject(new Error(`Error en la API de Attic Tech: ${res.statusCode}`));
                        }
                    });
                });
                req.on('error', reject);
                req.end();
            });
            
            if (result.docs && result.docs.length > 0) {
                let newLeads = result.docs;
                
                if (sucursalObjetivo) {
                    newLeads = newLeads.filter(e => e.user?.branches?.[0]?.name === sucursalObjetivo);
                }

                allLeads = allLeads.concat(newLeads);
                console.log(`📄 Página ${page} obtenida: ${result.docs.length} estimates. (${newLeads.length} cumplen el filtro). Total acumulado: ${allLeads.length}`);
            }

            hasMore = result.hasNextPage && result.docs.length > 0;
            page++;

        } catch (error) {
            console.error(`❌ Error obteniendo la página ${page}:`, error);
            hasMore = false; // Detener en caso de error
        }
    }

    if (limite && allLeads.length > limite) {
        allLeads = allLeads.slice(0, limite);
    }

    console.log(`✅ Total de estimates procesados: ${allLeads.length}`);
    return allLeads;
}

async function main() {
    // --- Configuración de Fechas y Filtros ---
    // Edita estas fechas para filtrar los estimates que quieres obtener.
    // Formato: YYYY-MM-DD
    const fechaInicio = '2025-07-016';
    const fechaFin = '2025-07-17';

    // Agrega el nombre de la sucursal para filtrar. Dejar en null para obtener de todas.
    const sucursalObjetivo = 'Orange County'; 

    // Define el número máximo de estimates que quieres obtener. Dejar en null para no tener límite.
    const limiteResultados = 1;
    // -----------------------------------------

    try {
        const token = await loginToAtticTech();
        if (token) {
            const estimates = await fetchEstimates(token, fechaInicio, fechaFin, sucursalObjetivo, limiteResultados);
            
            if (estimates.length > 0) {
                console.log(`\n--- Mostrando ${estimates.length} Estimate(s) Obtenido(s) (raw data) ---`);
                
                estimates.forEach((estimate, index) => {
                    console.log(`\n--- Estimate #${index + 1} ---`);
                    console.log(JSON.stringify(estimate, null, 2));
                });

                console.log("\n\n--- Resumen de Estimates ---");
                estimates.forEach(e => {
                    console.log(`- ID: ${e.id}, Nombre: ${e.name}, Fecha: ${e.createdAt}, Vendedor: ${e.user?.name}, Sucursal: ${e.user?.branches?.[0]?.name}`);
                });

            } else {
                console.log("No se encontraron estimates que coincidan con los filtros especificados.");
            }
        }
    } catch (error) {
        console.error('\n❌ Ocurrió un error en el proceso principal:', error.message);
    }
}

main(); 