const https = require('https');
require('dotenv').config();

/**
 * Script to find Vincent Lee estimates with services amount between 1600-1800
 * Excludes Sold estimates and only shows estimates from September 2025 onwards
 */

/**
 * Login to Attic Tech API
 */
async function loginToAtticTech() {
    console.log('🔑 Logging in to Attic Tech...');
    
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    
    if (!API_USER_EMAIL || !API_USER_PASSWORD) {
        throw new Error('ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in environment variables');
    }

    const loginData = JSON.stringify({
        email: API_USER_EMAIL,
        password: API_USER_PASSWORD
    });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla Vincent Lee Search Script'
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try { 
                            resolve(JSON.parse(data)); 
                        } catch (e) { 
                            reject(new Error(`Error parsing login response: ${e.message}`));
                        }
                    } else {
                        reject(new Error(`Login request failed: ${res.statusCode} - ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => reject(e));
            req.write(loginData);
            req.end();
        });

        if (response.token) {
            console.log('✅ Successfully logged in');
            console.log(`👤 User: ${response.user?.email || 'Unknown'}`);
            return response.token;
        } else {
            throw new Error('No token received in login response');
        }
    } catch (error) {
        console.error(`❌ Login error: ${error.message}`);
        throw error;
    }
}

/**
 * Search all users and find Vincent Lee
 */
async function findVincentLeeId(token) {
    console.log('\n🔍 Searching for Vincent Lee in users...');
    
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    
    while (hasMore) {
        const queryString = `limit=${pageSize}&page=${page}`;
        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/users?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Vincent Lee Search Script'
            }
        };

        try {
            const response = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(new Error(`Error parsing users response: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`Users request failed: ${res.statusCode} - ${data}`));
                        }
                    });
                });
                req.on('error', (e) => reject(e));
                req.end();
            });

            const users = response.docs || [];
            
            // Buscar a Vincent Lee
            const vincentLee = users.find(user => 
                user.name && user.name.toLowerCase().includes('vincent') && user.name.toLowerCase().includes('lee')
            );
            
            if (vincentLee) {
                console.log(`✅ Vincent Lee found!`);
                console.log(`   ID: ${vincentLee.id}`);
                console.log(`   Name: ${vincentLee.name}`);
                console.log(`   Email: ${vincentLee.email || 'N/A'}`);
                return vincentLee.id;
            }
            
            hasMore = page < (response.totalPages || 1);
            page++;
            
        } catch (error) {
            console.error(`❌ Error searching users: ${error.message}`);
            throw error;
        }
    }
    
    return null;
}

/**
 * Fetch estimates for a specific user (from September 2025 onwards)
 */
async function fetchEstimatesForUser(token, userId) {
    console.log(`\n📊 Fetching estimates for user ${userId}...`);
    
    // Date filter: September 1st, 2025 onwards
    const startDate = new Date('2025-09-01T00:00:00.000Z').toISOString();
    
    let allEstimates = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;
    
    while (hasMore) {
        // Use depth=5 to get complete service_data
        // Filter by user and date (September 2025 onwards)
        const queryString = `limit=${pageSize}&page=${page}&depth=5&where[user][equals]=${userId}&where[createdAt][greater_than_equal]=${encodeURIComponent(startDate)}`;
        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/job-estimates?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla Vincent Lee Search Script'
            },
            timeout: 60000 // 60 segundos de timeout
        };

        try {
            const response = await new Promise((resolve, reject) => {
                const req = https.request(options, (res) => {
                    let data = '';
                    res.on('data', (chunk) => { data += chunk; });
                    res.on('end', () => {
                        if (res.statusCode === 200) {
                            try {
                                resolve(JSON.parse(data));
                            } catch (e) {
                                reject(new Error(`Error parsing estimates response: ${e.message}`));
                            }
                        } else {
                            reject(new Error(`Estimates request failed: ${res.statusCode} - ${data}`));
                        }
                    });
                });
                req.on('error', (e) => reject(e));
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request timeout'));
                });
                req.end();
            });

            const estimates = response.docs || [];
            allEstimates = allEstimates.concat(estimates);
            
            console.log(`   Page ${page}: ${estimates.length} estimates found`);
            
            hasMore = page < (response.totalPages || 1);
            page++;
            
        } catch (error) {
            console.error(`❌ Error fetching estimates: ${error.message}`);
            throw error;
        }
    }
    
    console.log(`✅ Total estimates found: ${allEstimates.length}`);
    return allEstimates;
}

/**
 * Check if an estimate has any service with amount between 1600-1800
 */
function hasServiceWithAmountInRange(estimate) {
    if (!estimate.service_data || !estimate.service_data.services) {
        return { found: false };
    }
    
    const services = estimate.service_data.services;
    const matchedItems = [];
    
    for (const service of services) {
        if (!service.itemData) continue;
        
        // Iterate over all item groups (2, 4, 17, etc.)
        for (const groupKey in service.itemData) {
            const itemGroup = service.itemData[groupKey];
            
            // Iterate over all items within the group
            for (const itemKey in itemGroup) {
                const item = itemGroup[itemKey];
                // Check if amount is between 1600 and 1800
                if (item.amount >= 1600 && item.amount <= 1800) {
                    matchedItems.push({
                        service: service,
                        item: item,
                        groupKey: groupKey,
                        itemKey: itemKey
                    });
                }
            }
        }
    }
    
    if (matchedItems.length > 0) {
        return {
            found: true,
            matches: matchedItems
        };
    }
    
    return { found: false };
}

/**
 * Main function
 */
async function main() {
    try {
        console.log('🚀 Starting search for Vincent Lee estimates with amount 1600-1800\n');
        console.log('   (From September 2025 onwards, excluding Sold estimates)\n');
        console.log('═'.repeat(70));
        
        // 1. Login
        const token = await loginToAtticTech();
        
        // 2. Find Vincent Lee ID
        const vincentLeeId = await findVincentLeeId(token);
        
        if (!vincentLeeId) {
            console.log('\n❌ Vincent Lee not found in the system');
            return;
        }
        
        // 3. Get all estimates from Vincent Lee (from Sept 2025 onwards)
        const estimates = await fetchEstimatesForUser(token, vincentLeeId);
        
        // 4. Filter estimates that have services with amount between 1600-1800
        // and exclude Sold estimates
        console.log('\n🔍 Filtering estimates with services amount 1600-1800 (excluding Sold)...');
        const matchingEstimates = [];
        
        for (const estimate of estimates) {
            // Skip Sold estimates
            if (estimate.status === 'Sold') {
                continue;
            }
            
            const result = hasServiceWithAmountInRange(estimate);
            if (result.found) {
                matchingEstimates.push({
                    estimate: estimate,
                    matchDetails: result
                });
            }
        }
        
        // 5. Display results
        console.log('\n═'.repeat(70));
        console.log(`\n📋 RESULTS:`);
        console.log(`   Total Vincent Lee estimates (Sept 2025+): ${estimates.length}`);
        console.log(`   Estimates with amount 1600-1800 (excl. Sold): ${matchingEstimates.length}\n`);
        
        if (matchingEstimates.length === 0) {
            console.log('❌ No estimates found with services amount 1600-1800');
        } else {
            console.log('✅ Estimates found with amount 1600-1800:\n');
            
            matchingEstimates.forEach((match, index) => {
                const est = match.estimate;
                const details = match.matchDetails;
                
                console.log(`\n📄 Estimate ${index + 1}:`);
                console.log(`   ID: ${est.id}`);
                console.log(`   Name: ${est.name || 'N/A'}`);
                console.log(`   Status: ${est.status || 'N/A'}`);
                console.log(`   Created: ${est.createdAt || 'N/A'}`);
                console.log(`   Branch: ${est.branch?.name || 'N/A'}`);
                console.log(`   Client: ${est.property?.client?.fullName || est.client?.fullName || 'N/A'}`);
                console.log(`   Address: ${est.property?.address || 'N/A'}`);
                console.log(`   Final Price: $${est.final_price || 0}`);
                console.log(`\n   🎯 Services with amount 1600-1800:`);
                
                // Show all matched items
                details.matches.forEach((item, itemIndex) => {
                    console.log(`\n      Item ${itemIndex + 1}:`);
                    console.log(`      Service Type: ${item.service.type || 'N/A'}`);
                    console.log(`      Item Name: ${item.item.name}`);
                    console.log(`      Unit: ${item.item.unit}`);
                    console.log(`      Amount: ${item.item.amount}`);
                    console.log(`      Group Key: ${item.groupKey}`);
                    console.log(`      Item Key: ${item.itemKey}`);
                });
                
                console.log(`\n   🔗 View in Attic Tech: https://www.attic-tech.com/admin/collections/job-estimates/${est.id}`);
                console.log('   ' + '─'.repeat(65));
            });
        }
        
        console.log('\n✅ Search completed');
        
    } catch (error) {
        console.error('\n❌ Process error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

// Ejecutar script
main();

