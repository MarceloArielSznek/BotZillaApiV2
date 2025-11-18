#!/usr/bin/env node

/**
 * Script para listar estimates disponibles en Attic Tech API
 * Uso: node backend/src/scripts/listEstimates.js [limit]
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const https = require('https');

const ATTIC_TECH_EMAIL = process.env.ATTIC_TECH_EMAIL;
const ATTIC_TECH_PASSWORD = process.env.ATTIC_TECH_PASSWORD;

// Colores para la consola
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    cyan: '\x1b[36m',
    yellow: '\x1b[33m',
    green: '\x1b[32m',
    red: '\x1b[31m'
};

function log(text, color = 'reset') {
    console.log(`${colors[color]}${text}${colors.reset}`);
}

/**
 * Login to Attic Tech API
 */
async function loginToAtticTech() {
    if (!ATTIC_TECH_EMAIL || !ATTIC_TECH_PASSWORD) {
        throw new Error('ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in .env file');
    }

    const loginData = JSON.stringify({ 
        email: ATTIC_TECH_EMAIL, 
        password: ATTIC_TECH_PASSWORD 
    });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla Analyzer v1.0'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    if (response.token) {
                        resolve(response.token);
                    } else {
                        reject(new Error('No token received from Attic Tech API'));
                    }
                } catch (error) {
                    reject(new Error(`Failed to parse login response: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.write(loginData);
        req.end();
    });
}

/**
 * Fetch recent estimates from Attic Tech API
 */
async function fetchRecentEstimates(apiKey, limit = 20) {
    const queryString = `limit=${limit}&sort=-updatedAt`;
    
    const options = {
        hostname: 'www.attic-tech.com',
        path: `/api/job-estimates?${queryString}`,
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Accept': 'application/json',
            'User-Agent': 'BotZilla Analyzer v1.0'
        }
    };

    return new Promise((resolve, reject) => {
        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const response = JSON.parse(data);
                    resolve(response.docs || []);
                } catch (error) {
                    reject(new Error(`Failed to parse estimates response: ${error.message}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function listEstimates() {
    try {
        const limit = parseInt(process.argv[2]) || 20;
        
        log('\n🔐 Logging in to Attic Tech API...', 'cyan');
        const apiKey = await loginToAtticTech();
        log('✅ Logged in successfully', 'green');
        
        log(`\n🔍 Fetching ${limit} most recent estimates...`, 'cyan');
        const estimates = await fetchRecentEstimates(apiKey, limit);
        
        log(`\n✅ Found ${estimates.length} estimates:\n`, 'green');
        log('═'.repeat(120), 'cyan');
        
        console.log(`${'ID'.padEnd(8)} | ${'Name'.padEnd(45)} | ${'Branch'.padEnd(20)} | ${'True Cost'.padStart(12)} | ${'Retail'.padStart(12)} | ${'Status'.padEnd(15)}`);
        log('═'.repeat(120), 'cyan');
        
        estimates.forEach(est => {
            const id = String(est.id).padEnd(8);
            const name = (est.name || 'N/A').substring(0, 45).padEnd(45);
            const branch = (est.branch?.name || 'N/A').substring(0, 20).padEnd(20);
            const trueCost = `$${(est.true_cost || 0).toFixed(2)}`.padStart(12);
            const retail = `$${(est.retail_cost || 0).toFixed(2)}`.padStart(12);
            const status = (est.status || 'N/A').substring(0, 15).padEnd(15);
            
            console.log(`${id} | ${name} | ${branch} | ${trueCost} | ${retail} | ${status}`);
        });
        
        log('═'.repeat(120), 'cyan');
        log('\n💡 Para analizar un estimate, usa:', 'yellow');
        log('   node backend/src/scripts/analyzeEstimate.js "Nombre del Estimate"\n', 'green');
        
    } catch (error) {
        log(`\n❌ Error: ${error.message}`, 'red');
        if (process.env.DEBUG) {
            console.error(error);
        }
        process.exit(1);
    }
}

listEstimates().then(() => {
    process.exit(0);
}).catch(error => {
    log(`\n❌ Fatal error: ${error.message}`, 'red');
    if (process.env.DEBUG) {
        console.error(error);
    }
    process.exit(1);
});
