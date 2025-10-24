#!/usr/bin/env node

/**
 * Script para verificar qué estados de jobs existen en Attic Tech
 * Uso: node testJobStatuses.js
 */

const axios = require('axios');

const ATTIC_TECH_CONFIG = {
    email: 'marcelosz.office@gmail.com',
    password: 'Fideo2022!',
    baseUrl: 'https://www.attic-tech.com/api'
};

async function testJobStatuses() {
    try {
        console.log('\n==============================================');
        console.log('   JOB STATUSES DISCOVERY');
        console.log('==============================================\n');

        // Login
        console.log('🔑 Logging in...');
        const loginResponse = await axios.post(`${ATTIC_TECH_CONFIG.baseUrl}/users/login`, {
            email: ATTIC_TECH_CONFIG.email,
            password: ATTIC_TECH_CONFIG.password
        });

        const apiKey = loginResponse.data.token;
        console.log('✅ Login successful!\n');

        // Fetch jobs sin filtro de estado
        console.log('📦 Fetching jobs (without status filter)...');
        const jobsResponse = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/jobs`, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                depth: 2,
                limit: 50
            }
        });

        const jobs = jobsResponse.data?.docs || [];
        console.log(`✅ Found ${jobs.length} jobs\n`);

        // Extraer todos los estados únicos
        const statuses = new Set();
        jobs.forEach(job => {
            if (job.status) {
                statuses.add(job.status);
            }
        });

        console.log('📊 Unique job statuses found:');
        Array.from(statuses).sort().forEach((status, index) => {
            const count = jobs.filter(j => j.status === status).length;
            console.log(`   ${index + 1}. "${status}" (${count} jobs)`);
        });

        console.log('\n📋 Sample jobs with their statuses:');
        jobs.slice(0, 10).forEach((job, index) => {
            console.log(`   ${index + 1}. ${job.name || 'Unnamed'}`);
            console.log(`      Status: "${job.status || 'N/A'}"`);
            console.log(`      Scheduled: ${job.scheduled_date ? new Date(job.scheduled_date).toLocaleDateString('en-US') : 'N/A'}`);
            console.log('');
        });

        console.log('==============================================');
        console.log('✅ STATUS DISCOVERY COMPLETE!');
        console.log('==============================================\n');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Response:', JSON.stringify(error.response.data, null, 2));
        }
        process.exit(1);
    }
}

testJobStatuses();

