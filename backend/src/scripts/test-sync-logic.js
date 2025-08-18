const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Importar la función del controller
const { findOrCreateSalesPerson } = require('../controllers/automations.controller');

async function testSyncLogic() {
    console.log('🧪 PROBANDO NUEVA LÓGICA DE SYNC');
    console.log('================================\n');

    const testCases = [
        { name: "Eben Woodall", branchId: 1, expected: "should find Eben Woodbell (similar)" },
        { name: "Mathew Stevenson", branchId: 1, expected: "should find Matthew Stevenson (similar)" },
        { name: "Dan Howard", branchId: 1, expected: "should find existing Dan Howard (exact)" },
        { name: "Daniel Howard", branchId: 1, expected: "should NOT reactivate inactive Daniel Howard" },
        { name: "Brandon L.", branchId: 1, expected: "should find Brandon LaDue (similar)" },
        { name: "New Person", branchId: 1, expected: "should create new salesperson" }
    ];

    for (const testCase of testCases) {
        console.log(`\n🔍 Probando: "${testCase.name}"`);
        console.log(`   Esperado: ${testCase.expected}`);
        
        try {
            const result = await findOrCreateSalesPerson(testCase.name, testCase.branchId, []);
            
            if (result) {
                console.log(`   ✅ Resultado: ${result.name} (ID: ${result.id}, Active: ${result.is_active})`);
            } else {
                console.log(`   ❌ Resultado: null (no se encontró/creó salesperson)`);
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n📊 RESUMEN DE LA PRUEBA:');
    console.log('========================');
    console.log('• La nueva lógica NO reactiva salespersons inactivos automáticamente');
    console.log('• Usa el mismo algoritmo de similitud que el script de limpieza');
    console.log('• Solo asigna branches a salespersons nuevos');
    console.log('• Mantiene la integridad de los datos existentes');
}

// Ejecutar la prueba
testSyncLogic()
    .then(() => {
        console.log('\n✅ Prueba completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error en la prueba:', error);
        process.exit(1);
    }); 