const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { cleanDuplicateSalesPersons } = require('./clean-duplicate-salespersons');

console.log('🧹 Ejecutando limpieza de salespersons duplicados...');
console.log('⏰ Iniciado en:', new Date().toISOString());

cleanDuplicateSalesPersons()
    .then(result => {
        if (result.success) {
            console.log('\n✅ LIMPIEZA COMPLETADA EXITOSAMENTE');
            console.log('📊 Resumen:');
            console.log(`   - Duplicados procesados: ${result.totalDuplicates}`);
            console.log(`   - Salespersons marcados como inactivos: ${result.totalDeactivated}`);
            console.log(`   - Mensaje: ${result.message}`);
            
            console.log('\n📝 Logs detallados:');
            result.logs.forEach(log => console.log(`   ${log}`));
            
            console.log('\n⏰ Finalizado en:', new Date().toISOString());
            process.exit(0);
        } else {
            console.error('\n❌ LA LIMPIEZA FALLÓ');
            console.error('Error:', result.error);
            console.log('\n📝 Logs de error:');
            result.logs.forEach(log => console.log(`   ${log}`));
            process.exit(1);
        }
    })
    .catch(error => {
        console.error('\n❌ ERROR INESPERADO');
        console.error('Error:', error.message);
        console.error('Stack:', error.stack);
        process.exit(1);
    }); 