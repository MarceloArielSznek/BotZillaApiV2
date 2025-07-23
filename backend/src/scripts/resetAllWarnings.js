const { SalesPerson } = require('../models');

/**
 * This script resets the warning_count for all salespersons to zero.
 * It's useful for starting a new monitoring cycle.
 * 
 * To run this script, use the command from the backend root directory:
 * node -r ./src/config/load-env.js src/scripts/resetAllWarnings.js
 */
const resetWarnings = async () => {
    console.log('🔄 Starting the process to reset warnings for all salespersons...');

    try {
        const [affectedRows] = await SalesPerson.update(
            { warning_count: 0 },
            { where: {} } // Empty where clause means it applies to all records
        );

        console.log(`✅ Success! Warnings have been reset for ${affectedRows} salespersons.`);

    } catch (error) {
        console.error('❌ An error occurred while resetting warnings:', error);
    } finally {
        // We might need to manually close the DB connection if the script doesn't exit
        // For now, Node.js should exit automatically.
        console.log('🔚 Process finished.');
    }
};

resetWarnings(); 