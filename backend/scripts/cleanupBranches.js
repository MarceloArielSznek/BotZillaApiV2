/**
 * Script para limpiar branches duplicados en producción
 * Ejecutar: node backend/scripts/cleanupBranches.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { cleanupDuplicateBranches } = require('../src/utils/branchHelper');
const { logger } = require('../src/utils/logger');

async function run() {
    try {
        console.log('🧹 Starting branch cleanup...\n');
        
        const result = await cleanupDuplicateBranches();
        
        if (!result.success) {
            console.error('❌ Cleanup failed:', result.error);
            process.exit(1);
        }
        
        if (result.duplicatesFound === 0) {
            console.log('✅ No duplicate branches found. Database is clean!');
            process.exit(0);
        }
        
        console.log('\n✅ Cleanup completed successfully!\n');
        console.log('📊 Results:');
        console.log(`   - Duplicates found: ${result.duplicatesFound}`);
        console.log(`   - Duplicates deleted: ${result.duplicatesDeleted}`);
        console.log('\n📋 Consolidation Map:');
        
        for (const [oldId, newId] of Object.entries(result.consolidationMap)) {
            console.log(`   - Branch ID ${oldId} → merged into Branch ID ${newId}`);
        }
        
        console.log('\n✨ All references (employees, jobs, estimates) have been updated.');
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error during cleanup:', error);
        logger.error('Branch cleanup script failed', { error: error.message });
        process.exit(1);
    }
}

// Ejecutar
run();

