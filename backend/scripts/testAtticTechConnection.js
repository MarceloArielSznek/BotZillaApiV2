#!/usr/bin/env node

/**
 * Script de prueba rápida para verificar conexión a Attic Tech API
 * Uso: node testAtticTechConnection.js
 */

const axios = require('axios');

const ATTIC_TECH_CONFIG = {
    email: 'marcelosz.office@gmail.com',
    password: 'Fideo2022!',
    baseUrl: 'https://www.attic-tech.com/api'
};

async function testConnection() {
    try {
        console.log('\n==============================================');
        console.log('   ATTIC TECH API CONNECTION TEST');
        console.log('==============================================\n');

        // Test 1: Login
        console.log('🔑 Testing login...');
        const loginResponse = await axios.post(`${ATTIC_TECH_CONFIG.baseUrl}/users/login`, {
            email: ATTIC_TECH_CONFIG.email,
            password: ATTIC_TECH_CONFIG.password
        });

        if (loginResponse.data && loginResponse.data.token) {
            console.log('✅ Login successful!');
            console.log(`   Token received: ${loginResponse.data.token.substring(0, 20)}...\n`);
            
            const apiKey = loginResponse.data.token;

            // Test 2: Fetch branches
            console.log('🏢 Testing branches endpoint...');
            const branchesResponse = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/branches`, {
                headers: {
                    'Authorization': `JWT ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    limit: 5,
                    depth: 1
                }
            });

            const branches = branchesResponse.data?.docs || [];
            console.log(`✅ Branches endpoint working!`);
            console.log(`   Found ${branches.length} branches (showing first 5):`);
            branches.slice(0, 5).forEach((branch, index) => {
                console.log(`   ${index + 1}. ${branch.name} (ID: ${branch.id})`);
            });
            console.log('');

            // Test 3: Fetch jobs (limited)
            console.log('📦 Testing jobs endpoint...');
            const jobsResponse = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/jobs`, {
                headers: {
                    'Authorization': `JWT ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    depth: 1,
                    limit: 5,
                    'where[status][equals]': 'Closed Job'
                }
            });

            const jobs = jobsResponse.data?.docs || [];
            console.log(`✅ Jobs endpoint working!`);
            console.log(`   Found closed jobs (showing first 5):`);
            jobs.slice(0, 5).forEach((job, index) => {
                console.log(`   ${index + 1}. ${job.name || 'Unnamed'} (Status: ${job.status || 'N/A'})`);
            });
            console.log('');

            console.log('==============================================');
            console.log('✅ ALL TESTS PASSED!');
            console.log('   The Closed Jobs Report script should work correctly.');
            console.log('==============================================\n');

        } else {
            console.log('❌ Login failed: No token received\n');
        }

    } catch (error) {
        console.error('\n❌ TEST FAILED:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Status Text:', error.response.statusText);
            if (error.response.data) {
                console.error('   Response:', JSON.stringify(error.response.data, null, 2));
            }
        }
        console.log('\n==============================================');
        console.log('❌ TESTS FAILED');
        console.log('   Please check your credentials and internet connection.');
        console.log('==============================================\n');
        process.exit(1);
    }
}

// Ejecutar test
testConnection();

