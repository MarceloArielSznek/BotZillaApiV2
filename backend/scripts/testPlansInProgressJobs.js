const https = require('https');
const { loginToAtticTech } = require('../src/utils/atticTechAuth');

/**
 * Script de prueba para fetchear jobs con estado "Plans In Progress"
 * y analizar la estructura del JSON que devuelve la API
 */

async function testPlansInProgressJobs() {
    console.log('🚀 Iniciando test de Plans In Progress jobs...\n');

    try {
        // 1. Obtener token de autenticación
        console.log('🔑 Obteniendo token de Attic Tech...');
        const token = await loginToAtticTech();
        
        if (!token) {
            throw new Error('No se pudo obtener el token de autenticación');
        }
        console.log('✅ Token obtenido exitosamente\n');

        // 2. Construir la petición al endpoint de jobs
        const queryString = 'where[and][0][status][equals]=Plans%20In%20Progress&depth=2&limit=10';
        
        console.log('📡 Haciendo petición a Attic Tech API...');
        console.log(`   Endpoint: /api/jobs?${queryString}\n`);

        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/jobs?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Test Script'
            }
        };

        // 3. Hacer la petición
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    if (res.statusCode === 200) {
                        try {
                            resolve(JSON.parse(data));
                        } catch (e) {
                            reject(new Error(`Error parseando JSON: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`La petición falló con status ${res.statusCode}: ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => {
                reject(new Error(`Error en la petición: ${e.message}`));
            });
            
            req.end();
        });

        // 4. Analizar y mostrar la respuesta
        console.log('✅ Respuesta recibida exitosamente\n');
        console.log('=' .repeat(80));
        console.log('📊 ESTRUCTURA DE LA RESPUESTA:');
        console.log('=' .repeat(80));
        
        console.log('\n📋 Metadata de la respuesta:');
        console.log('   - Total de jobs:', response.totalDocs || response.length || 'N/A');
        console.log('   - Página:', response.page || 'N/A');
        console.log('   - Límite:', response.limit || 'N/A');
        console.log('   - Total de páginas:', response.totalPages || 'N/A');
        
        const jobs = Array.isArray(response) ? response : response.docs || [];
        
        console.log(`\n📦 Encontrados ${jobs.length} jobs con estado "Plans In Progress"\n`);

        if (jobs.length > 0) {
            console.log('=' .repeat(80));
            console.log('🔍 ESTRUCTURA DEL PRIMER JOB:');
            console.log('=' .repeat(80));
            
            const firstJob = jobs[0];
            
            console.log('\n📄 Campos principales del job:');
            Object.keys(firstJob).forEach(key => {
                const value = firstJob[key];
                const type = typeof value;
                
                if (type === 'object' && value !== null) {
                    if (Array.isArray(value)) {
                        console.log(`   - ${key}: Array[${value.length}]`);
                    } else {
                        console.log(`   - ${key}: Object {${Object.keys(value).join(', ')}}`);
                    }
                } else {
                    console.log(`   - ${key}: ${type} = ${value}`);
                }
            });

            console.log('\n📝 DATOS COMPLETOS DEL PRIMER JOB:');
            console.log(JSON.stringify(firstJob, null, 2));

            // Analizar campos importantes para las notificaciones
            console.log('\n=' .repeat(80));
            console.log('📋 DATOS RELEVANTES PARA NOTIFICACIONES:');
            console.log('=' .repeat(80));
            console.log('\nJob Information:');
            console.log('   - ID:', firstJob.id);
            console.log('   - Name:', firstJob.name);
            console.log('   - Status:', firstJob.status);
            console.log('   - Created At:', firstJob.createdAt);
            console.log('   - Updated At:', firstJob.updatedAt);
            
            if (firstJob.jobEstimate) {
                console.log('\nEstimate Information:');
                console.log('   - Estimate ID:', firstJob.jobEstimate.id);
                console.log('   - Estimate Name:', firstJob.jobEstimate.name);
                
                if (firstJob.jobEstimate.user) {
                    console.log('\nSalesperson/User Information:');
                    console.log('   - User ID:', firstJob.jobEstimate.user.id);
                    console.log('   - User Name:', firstJob.jobEstimate.user.name);
                    console.log('   - User Email:', firstJob.jobEstimate.user.email);
                }
                
                if (firstJob.jobEstimate.branch) {
                    console.log('\nBranch Information:');
                    console.log('   - Branch ID:', firstJob.jobEstimate.branch.id);
                    console.log('   - Branch Name:', firstJob.jobEstimate.branch.name);
                }
                
                if (firstJob.jobEstimate.client) {
                    console.log('\nClient Information:');
                    console.log('   - Client Name:', firstJob.jobEstimate.client.fullName);
                    console.log('   - Client Phone:', firstJob.jobEstimate.client.phone);
                    console.log('   - Client Email:', firstJob.jobEstimate.client.email);
                }
                
                if (firstJob.jobEstimate.property) {
                    console.log('\nProperty Information:');
                    console.log('   - Address:', firstJob.jobEstimate.property.address);
                }
            }
            
            // Buscar el Crew Leader en el array assignedCrew
            if (firstJob.assignedCrew && Array.isArray(firstJob.assignedCrew)) {
                console.log('\n👥 ASSIGNED CREW INFORMATION:');
                console.log(`   - Total crew members: ${firstJob.assignedCrew.length}`);
                
                // Buscar el crew leader (el que tiene rol "Crew Leader")
                const crewLeader = firstJob.assignedCrew.find(member => 
                    member.roles && member.roles.some(role => 
                        role.name === 'Crew Leader' || role.description === 'Crew Leader'
                    )
                );
                
                if (crewLeader) {
                    console.log('\n🎯 CREW LEADER ENCONTRADO (IMPORTANTE):');
                    console.log('   - Crew Leader ID:', crewLeader.id);
                    console.log('   - Crew Leader Name:', crewLeader.name);
                    console.log('   - Crew Leader Email:', crewLeader.email);
                    console.log('   - Is Verified:', crewLeader.isVerified);
                    console.log('   - Roles:', JSON.stringify(crewLeader.roles, null, 2));
                    console.log('   - Branches:', JSON.stringify(crewLeader.branches, null, 2));
                    console.log('\n   - Crew Leader Object Completo:', JSON.stringify(crewLeader, null, 2));
                } else {
                    console.log('\n⚠️ No se encontró Crew Leader en el assignedCrew');
                }
                
                // Mostrar todos los crew members para debug
                console.log('\n📋 TODOS LOS CREW MEMBERS:');
                firstJob.assignedCrew.forEach((member, index) => {
                    const roles = member.roles ? member.roles.map(r => r.name).join(', ') : 'Sin roles';
                    console.log(`   ${index + 1}. ${member.name} (${member.email}) - Roles: ${roles}`);
                });
            } else {
                console.log('\n⚠️ No se encontró array assignedCrew en este job');
            }
        } else {
            console.log('⚠️ No se encontraron jobs con estado "Plans In Progress"');
        }

        console.log('\n' + '=' .repeat(80));
        console.log('✅ Test completado exitosamente');
        console.log('=' .repeat(80));

    } catch (error) {
        console.error('\n❌ Error durante el test:');
        console.error('   Mensaje:', error.message);
        console.error('   Stack:', error.stack);
    }
}

// Ejecutar el test
testPlansInProgressJobs()
    .then(() => {
        console.log('\n✅ Script finalizado');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n❌ Error fatal:', error);
        process.exit(1);
    });

