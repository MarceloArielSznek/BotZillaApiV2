#!/usr/bin/env node

const { main } = require('./scripts/generateSoldEstimatesExcel');

console.log('🎯 BotZilla - Generador de Excel de Estimates Vendidos');
console.log('=====================================================\n');

main()
    .then(() => {
        console.log('\n🎉 ¡Script ejecutado exitosamente!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Error ejecutando el script:', error.message);
        process.exit(1);
    });
