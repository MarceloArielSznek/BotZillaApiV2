#!/usr/bin/env node

/**
 * Script para verificar que las variables de entorno se cargan correctamente
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

console.log('🔧 Environment Variables Test:');
console.log('');

const requiredVars = [
    'DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD', 'DB_SCHEMA',
    'JWT_SECRET', 'ATTIC_TECH_EMAIL', 'ATTIC_TECH_PASSWORD'
];

let allValid = true;

for (const varName of requiredVars) {
    const value = process.env[varName];
    const status = value ? '✅' : '❌';
    const displayValue = value ? 
        (varName.includes('PASSWORD') || varName.includes('SECRET') ? 
            '*'.repeat(Math.min(value.length, 8)) : value) : 
        'NOT SET';
    
    console.log(`${status} ${varName}: ${displayValue}`);
    
    if (!value) allValid = false;
}

console.log('');
console.log(`📊 Result: ${allValid ? '✅ All variables loaded successfully!' : '❌ Some variables are missing!'}`);

if (!allValid) {
    console.log('');
    console.log('💡 Make sure your .env file exists at: backend/.env');
    console.log('   And contains all the required variables.');
    process.exit(1);
}

console.log('');
console.log('🎉 Environment configuration is ready!'); 