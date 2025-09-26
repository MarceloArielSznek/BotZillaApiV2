const { loginToAtticTech } = require('../src/utils/atticTechAuth');

async function testAuth() {
    console.log('🧪 Iniciando prueba de autenticación con Attic Tech');
    const logMessages = [];

    try {
        const token = await loginToAtticTech(logMessages);
        
        console.log('\n📝 Mensajes de log:');
        logMessages.forEach(msg => console.log(msg));
        
        if (token) {
            console.log('\n✅ Prueba exitosa! Token recibido:', token.substring(0, 20) + '...');
        } else {
            console.log('\n❌ Prueba fallida: No se recibió token');
        }
    } catch (error) {
        console.log('\n❌ Error durante la prueba:', error.message);
        console.log('\n📝 Mensajes de log antes del error:');
        logMessages.forEach(msg => console.log(msg));
    }
}

testAuth();
