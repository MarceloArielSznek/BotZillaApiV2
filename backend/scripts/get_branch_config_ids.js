/**
 * Script para obtener los Configuration IDs de cada branch desde Attic Tech
 * Uso: node backend/scripts/get_branch_config_ids.js
 */

const https = require('https');
const { loginToAtticTech } = require('../src/utils/atticTechAuth');

// Lista de branches con sus AT Branch IDs
const branches = [
    { name: 'San Diego', at_branch_id: 4 },
    { name: 'Orange County', at_branch_id: 5 },
    { name: 'Everett -WA', at_branch_id: 3 },
    { name: 'San Bernardino', at_branch_id: 1 },
    { name: 'Kent -WA', at_branch_id: 2 },
    { name: 'Los Angeles', at_branch_id: 8 }
];

async function fetchBranchFromAtticTech(apiKey, branchId) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/branches/${branchId}?depth=2`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        const json = JSON.parse(data);
                        resolve(json);
                    } catch (e) {
                        reject(new Error('Error parsing JSON'));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });
        });

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Timeout'));
        });
        req.end();
    });
}

async function main() {
    try {
        console.log('🔑 Logging into Attic Tech...');
        const apiKey = await loginToAtticTech();
        console.log('✅ Logged in successfully\n');

        console.log('📊 Fetching configuration IDs for each branch...\n');
        console.log('═'.repeat(80));
        
        const results = [];

        for (const branch of branches) {
            try {
                console.log(`\n🔍 Fetching: ${branch.name} (AT Branch ID: ${branch.at_branch_id})...`);
                const branchData = await fetchBranchFromAtticTech(apiKey, branch.at_branch_id);
                
                const configId = branchData.configuration?.id || branchData.configuration;
                const configName = branchData.configuration?.name || 'N/A';
                
                if (configId) {
                    console.log(`   ✅ Configuration ID: ${configId}`);
                    console.log(`   📝 Configuration Name: ${configName}`);
                    results.push({
                        branch_name: branch.name,
                        at_branch_id: branch.at_branch_id,
                        at_config_id: configId,
                        config_name: configName
                    });
                } else {
                    console.log(`   ⚠️  No configuration found`);
                    results.push({
                        branch_name: branch.name,
                        at_branch_id: branch.at_branch_id,
                        at_config_id: null,
                        config_name: null
                    });
                }
            } catch (error) {
                console.log(`   ❌ Error: ${error.message}`);
                results.push({
                    branch_name: branch.name,
                    at_branch_id: branch.at_branch_id,
                    error: error.message
                });
            }
        }

        console.log('\n' + '═'.repeat(80));
        console.log('\n📋 RESUMEN - SQL QUERIES PARA ACTUALIZAR:\n');
        
        for (const result of results) {
            if (result.at_config_id) {
                console.log(`-- ${result.branch_name} (Config: ${result.config_name})`);
                console.log(`-- AT Branch ID: ${result.at_branch_id}, AT Config ID: ${result.at_config_id}`);
                console.log(`UPDATE botzilla.branch SET attic_tech_branch_id = ${result.at_branch_id} WHERE name = '${result.branch_name}';`);
                console.log('');
            }
        }

        console.log('\n📋 SYNC COMMAND - Para sincronizar todos los config IDs encontrados:\n');
        const configIds = results
            .filter(r => r.at_config_id)
            .map(r => r.at_config_id)
            .join(',');
        
        if (configIds) {
            console.log(`GET https://yallaprojects.com/api/automations/multiplier-ranges-sync?configIds=${configIds}`);
            console.log(`Headers: x-api-key: YOUR_API_KEY\n`);
        }

        console.log('\n✅ Done!\n');

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}

main();

