const { loginToAtticTech, fetchSoldEstimatesFromAtticTech, processEstimatesData } = require('./generateSoldEstimatesExcel');

async function testMultiplier() {
    try {
        console.log('🔍 Probando cálculo de multiplier...');
        
        const token = await loginToAtticTech();
        
        // Modificar temporalmente para solo tomar 5 estimates
        const allEstimates = await fetchSoldEstimatesFromAtticTech(token);
        const estimates = allEstimates.slice(0, 5);
        
        const processedEstimates = processEstimatesData(estimates);
        
        console.log('\n📊 RESULTADOS DEL MULTIPLIER:');
        
        processedEstimates.forEach((estimate, index) => {
            console.log(`\n${index + 1}. ${estimate.jobName}`);
            console.log(`   Branch: ${estimate.branchName}`);
            console.log(`   Multiplier: ${estimate.multiplier}`);
            console.log(`   Proposed Cost: ${estimate.proposedCost}`);
        });

    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

testMultiplier();
