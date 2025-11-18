#!/usr/bin/env node

/**
 * Script para hacer backfill de snapshot_multiplier_ranges
 * en estimates que no lo tienen
 * 
 * Usage:
 *   node backend/src/scripts/backfillEstimateSnapshots.js
 *   node backend/src/scripts/backfillEstimateSnapshots.js --dry-run              # Solo ver qué haría
 *   node backend/src/scripts/backfillEstimateSnapshots.js --limit 10             # Para testing
 *   node backend/src/scripts/backfillEstimateSnapshots.js --lost-only            # Solo lost estimates
 *   node backend/src/scripts/backfillEstimateSnapshots.js --weeks 3              # Últimas N semanas
 *   node backend/src/scripts/backfillEstimateSnapshots.js --lost-only --weeks 3  # Combinar filtros
 * 
 * Ejemplos:
 *   # Lost estimates de las últimas 3 semanas (dry run)
 *   node backend/src/scripts/backfillEstimateSnapshots.js --lost-only --weeks 3 --dry-run
 * 
 *   # Lost estimates de las últimas 3 semanas (ejecutar)
 *   node backend/src/scripts/backfillEstimateSnapshots.js --lost-only --weeks 3
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { Sequelize, Op } = require('sequelize');
const axios = require('axios');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        dialect: process.env.DB_DIALECT,
        schema: process.env.DB_SCHEMA,
        logging: false
    }
);

const ATTIC_TECH_EMAIL = process.env.ATTIC_TECH_EMAIL;
const ATTIC_TECH_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
const DRY_RUN = process.argv.includes('--dry-run');
const LIMIT = process.argv.includes('--limit') 
    ? parseInt(process.argv[process.argv.indexOf('--limit') + 1]) 
    : null;
const LOST_ONLY = process.argv.includes('--lost-only');
const WEEKS = process.argv.includes('--weeks')
    ? parseInt(process.argv[process.argv.indexOf('--weeks') + 1])
    : null;

// Colores para consola
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    red: '\x1b[31m'
};

function log(text, color = 'reset') {
    console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Login to Attic Tech API
 */
async function loginToAtticTech() {
    try {
        const response = await axios.post('https://www.attic-tech.com/api/users/login', {
            email: ATTIC_TECH_EMAIL,
            password: ATTIC_TECH_PASSWORD
        });
        return response.data.token;
    } catch (error) {
        throw new Error(`Failed to login: ${error.message}`);
    }
}

/**
 * Fetch estimate from Attic Tech by ID
 */
async function fetchEstimateFromAtticTech(estimateId, token) {
    try {
        const response = await axios.get(
            `https://www.attic-tech.com/api/job-estimates/${estimateId}?depth=3`,
            {
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Accept': 'application/json'
                }
            }
        );
        return response.data;
    } catch (error) {
        if (error.response?.status === 404) {
            return null; // Estimate no encontrado
        }
        throw error;
    }
}

/**
 * Extract multiplier ranges from estimate snapshot
 */
function extractMultiplierRanges(estimate) {
    try {
        const snapshot = estimate.estimateSnapshot;
        if (!snapshot) return null;
        
        const snapshotData = typeof snapshot.snapshotData === 'string' 
            ? JSON.parse(snapshot.snapshotData) 
            : snapshot.snapshotData;
        
        return snapshotData?.multiplierRanges || null;
    } catch (error) {
        log(`  ⚠️  Error extracting snapshot: ${error.message}`, 'yellow');
        return null;
    }
}

/**
 * Main backfill function
 */
async function backfillSnapshots() {
    let apiToken = null;
    
    try {
        log('\n🔧 Starting Estimate Snapshots Backfill', 'cyan');
        log('═══════════════════════════════════════════════════════════════\n', 'cyan');
        
        if (DRY_RUN) {
            log('⚠️  DRY RUN MODE - No changes will be made\n', 'yellow');
        }
        
        if (LOST_ONLY) {
            log('🎯 Filtering: Lost estimates only\n', 'cyan');
        }
        
        if (WEEKS) {
            log(`📅 Filtering: Last ${WEEKS} week(s)\n`, 'cyan');
        }
        
        // 1. Contar estimates sin snapshot
        let countQuery = `
            SELECT 
                COUNT(*) as total,
                COUNT(snapshot_multiplier_ranges) as with_snapshot,
                COUNT(*) - COUNT(snapshot_multiplier_ranges) as without_snapshot
            FROM ${process.env.DB_SCHEMA}.estimate e
        `;
        
        const whereConditions = [];
        
        if (LOST_ONLY) {
            whereConditions.push(`
                e.status_id = (
                    SELECT id FROM ${process.env.DB_SCHEMA}.estimate_status 
                    WHERE name = 'Lost' LIMIT 1
                )
            `);
        }
        
        if (WEEKS) {
            whereConditions.push(`
                e.at_updated_date >= NOW() - INTERVAL '${WEEKS} weeks'
            `);
        }
        
        if (whereConditions.length > 0) {
            countQuery += ' WHERE ' + whereConditions.join(' AND ');
        }
        
        const [countResult] = await sequelize.query(countQuery);
        
        const stats = countResult[0];
        log(`📊 Database Stats:`, 'cyan');
        log(`   Total estimates: ${stats.total}`);
        log(`   With snapshot: ${stats.with_snapshot}`);
        log(`   Without snapshot: ${stats.without_snapshot}`, 'yellow');
        
        if (stats.without_snapshot === 0) {
            log('\n✅ All estimates already have snapshots!', 'green');
            return;
        }
        
        // 2. Obtener estimates sin snapshot
        let query = `
            SELECT e.id, e.name, e.attic_tech_estimate_id, e.price
            FROM ${process.env.DB_SCHEMA}.estimate e
            WHERE e.snapshot_multiplier_ranges IS NULL
        `;
        
        // Agregar filtros
        if (LOST_ONLY) {
            query += ` AND e.status_id = (
                SELECT id FROM ${process.env.DB_SCHEMA}.estimate_status 
                WHERE name = 'Lost' LIMIT 1
            )`;
        }
        
        if (WEEKS) {
            query += ` AND e.at_updated_date >= NOW() - INTERVAL '${WEEKS} weeks'`;
        }
        
        query += ' ORDER BY e.updated_at DESC';
        
        if (LIMIT) {
            query += ` LIMIT ${LIMIT}`;
            log(`\n⚠️  Limited to ${LIMIT} estimates for testing\n`, 'yellow');
        }
        
        const [estimates] = await sequelize.query(query);
        
        if (estimates.length === 0) {
            log('\n✅ No estimates to process with the given filters!', 'green');
            return;
        }
        
        log(`\n📝 Processing ${estimates.length} estimates...\n`);
        
        // 3. Login to Attic Tech
        log('🔐 Logging in to Attic Tech API...', 'cyan');
        apiToken = await loginToAtticTech();
        log('✅ Logged in successfully\n', 'green');
        
        // 4. Process each estimate
        let successCount = 0;
        let failCount = 0;
        let notFoundCount = 0;
        let noSnapshotCount = 0;
        
        for (let i = 0; i < estimates.length; i++) {
            const estimate = estimates[i];
            const progress = `[${i + 1}/${estimates.length}]`;
            
            try {
                log(`${progress} Processing: ${estimate.name} (ID: ${estimate.id})`, 'cyan');
                
                // Fetch from Attic Tech
                const atEstimate = await fetchEstimateFromAtticTech(
                    estimate.attic_tech_estimate_id,
                    apiToken
                );
                
                if (!atEstimate) {
                    log(`  ❌ Not found in Attic Tech`, 'red');
                    notFoundCount++;
                    continue;
                }
                
                // Extract snapshot
                const multiplierRanges = extractMultiplierRanges(atEstimate);
                
                if (!multiplierRanges || multiplierRanges.length === 0) {
                    log(`  ⚠️  No snapshot available`, 'yellow');
                    noSnapshotCount++;
                    continue;
                }
                
                log(`  ✅ Found snapshot with ${multiplierRanges.length} ranges`);
                
                // Update database
                if (!DRY_RUN) {
                    await sequelize.query(`
                        UPDATE ${process.env.DB_SCHEMA}.estimate
                        SET snapshot_multiplier_ranges = :snapshot
                        WHERE id = :id
                    `, {
                        replacements: {
                            snapshot: JSON.stringify(multiplierRanges),
                            id: estimate.id
                        }
                    });
                    log(`  💾 Updated in database`, 'green');
                } else {
                    log(`  💾 Would update (dry run)`, 'yellow');
                }
                
                successCount++;
                
                // Rate limiting
                await new Promise(resolve => setTimeout(resolve, 200));
                
            } catch (error) {
                log(`  ❌ Error: ${error.message}`, 'red');
                failCount++;
            }
        }
        
        // 5. Summary
        log('\n═══════════════════════════════════════════════════════════════', 'cyan');
        log('📊 SUMMARY:', 'cyan');
        log(`   Successfully processed: ${successCount}`, 'green');
        log(`   Failed: ${failCount}`, failCount > 0 ? 'red' : 'reset');
        log(`   Not found in AT: ${notFoundCount}`, notFoundCount > 0 ? 'yellow' : 'reset');
        log(`   No snapshot available: ${noSnapshotCount}`, noSnapshotCount > 0 ? 'yellow' : 'reset');
        
        if (DRY_RUN) {
            log('\n⚠️  This was a DRY RUN - no changes were made', 'yellow');
            log('Run without --dry-run to apply changes', 'yellow');
        } else {
            log('\n✅ Backfill completed!', 'green');
        }
        
    } catch (error) {
        log(`\n❌ Fatal error: ${error.message}`, 'red');
        console.error(error);
        process.exit(1);
    } finally {
        await sequelize.close();
    }
}

// Execute
if (!ATTIC_TECH_EMAIL || !ATTIC_TECH_PASSWORD) {
    log('❌ Missing ATTIC_TECH_EMAIL or ATTIC_TECH_PASSWORD in .env', 'red');
    process.exit(1);
}

backfillSnapshots().then(() => {
    process.exit(0);
}).catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    process.exit(1);
});

