#!/usr/bin/env node

/**
 * Script para actualizar salespersons con datos del CSV
 * Actualiza telegram_id y warning_count basándose en el nombre
 */

// Cargar variables de entorno desde .env
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const { SalesPerson } = require('../models');
const { Op } = require('sequelize');

// Datos del CSV
const csvData = [
    { id: 1, name: "William Gwinn", telegramid: "6810097763", warning_count: 0, is_manager: false, branch_id: 1 },
    { id: 2, name: "Dan Howard ", telegramid: "5292106374", warning_count: 0, is_manager: false, branch_id: 2 },
    { id: 3, name: "Adam Alex", telegramid: null, warning_count: 2, is_manager: false, branch_id: 3 },
    { id: 4, name: "Richard Ellgen", telegramid: null, warning_count: 2, is_manager: false, branch_id: 4 },
    { id: 5, name: "Vincent Lee", telegramid: null, warning_count: 0, is_manager: false, branch_id: 3 },
    { id: 6, name: "Patrick Smith", telegramid: "7808790070", warning_count: 0, is_manager: false, branch_id: 1 },
    { id: 7, name: "Nathan Woods", telegramid: "7547615975", warning_count: 1, is_manager: false, branch_id: 1 },
    { id: 8, name: "Brian Rayburn", telegramid: null, warning_count: 0, is_manager: false, branch_id: 5 },
    { id: 9, name: "Mathew Stevenson", telegramid: null, warning_count: 0, is_manager: false, branch_id: 4 },
    { id: 10, name: "Mike Mayfield", telegramid: "7471814544", warning_count: 3, is_manager: false, branch_id: 2 },
    { id: 11, name: "Paul Lang", telegramid: null, warning_count: 2, is_manager: false, branch_id: 4 },
    { id: 12, name: "Eben W", telegramid: null, warning_count: 2, is_manager: false, branch_id: 5 },
    { id: 13, name: "Joe Guerra", telegramid: null, warning_count: 2, is_manager: false, branch_id: 3 },
    { id: 14, name: "Derek Gibbs", telegramid: null, warning_count: 0, is_manager: false, branch_id: 4 },
    { id: 15, name: "Richard Barnes", telegramid: "5177575436", warning_count: 1, is_manager: false, branch_id: 1 },
    { id: 16, name: "Eli Musch", telegramid: null, warning_count: 2, is_manager: false, branch_id: 5 },
    { id: 17, name: "Brandon LaDue", telegramid: null, warning_count: 2, is_manager: false, branch_id: 5 },
    { id: 18, name: "Blaine Horowitz", telegramid: "7040800313", warning_count: 0, is_manager: false, branch_id: 2 },
    { id: 19, name: "Robert Montanez", telegramid: null, warning_count: 0, is_manager: false, branch_id: 3 },
    { id: 20, name: "Kevin Enz", telegramid: null, warning_count: 0, is_manager: false, branch_id: 4 },
    { id: 21, name: "Mason Huston", telegramid: "5977444414", warning_count: 8, is_manager: false, branch_id: 1 },
    { id: 22, name: "David Cortez", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 23, name: "Rick Apodaca", telegramid: null, warning_count: 0, is_manager: false, branch_id: 5 },
    { id: 24, name: "Aaron Gutierrez", telegramid: null, warning_count: 0, is_manager: false, branch_id: 5 },
    { id: 25, name: "Tyson Johnson", telegramid: "1460991674", warning_count: 0, is_manager: false, branch_id: 5 },
    { id: 26, name: "Evelyn", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 27, name: "Matthew Brown ", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 28, name: "Shawn Domianus", telegramid: "7228935628", warning_count: 0, is_manager: true, branch_id: 2 },
    { id: 29, name: "Branden Vaughan", telegramid: "6888616957", warning_count: 0, is_manager: true, branch_id: 1 },
    { id: 30, name: "Nave Black ", telegramid: "535146353", warning_count: 0, is_manager: true, branch_id: 1 },
    { id: 31, name: "RKhan", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 32, name: "Matt Hatcher Mays ", telegramid: "5019484428", warning_count: 0, is_manager: true, branch_id: 1 },
    { id: 33, name: "Ian Pryor", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 34, name: "Joe Johnson", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 35, name: "Mark Edward ", telegramid: null, warning_count: 0, is_manager: false, branch_id: null },
    { id: 36, name: "Raf Khan", telegramid: "", warning_count: 0, is_manager: false, branch_id: null },
    { id: 38, name: "Eido Einav", telegramid: "866327624", warning_count: 0, is_manager: true, branch_id: 1 },
    { id: 39, name: "Marcelo Sznek", telegramid: "1940630658", warning_count: 0, is_manager: true, branch_id: 1 }
];

async function updateSalespersonsFromCSV() {
    try {
        console.log('🚀 Starting salespersons update from CSV data...');
        
        // Verificar que las variables de entorno están cargadas
        if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
            console.error('❌ Missing database environment variables!');
            console.error('Make sure your .env file contains: DB_NAME, DB_USER, DB_PASSWORD');
            process.exit(1);
        }
        
        console.log('✅ Environment variables loaded successfully');
        console.log(`📊 Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
        
        let updated = 0;
        let notFound = 0;
        let errors = 0;
        
        for (const csvRow of csvData) {
            try {
                // Limpiar el nombre (quitar espacios extra)
                const cleanName = csvRow.name.trim();
                
                // Buscar el salesperson por nombre (búsqueda flexible)
                const salesperson = await SalesPerson.findOne({
                    where: {
                        name: {
                            [Op.iLike]: `%${cleanName}%`
                        }
                    }
                });
                
                if (salesperson) {
                    // Preparar los datos a actualizar
                    const updateData = {
                        warning_count: csvRow.warning_count
                    };
                    
                    // Solo actualizar telegram_id si no está vacío en el CSV
                    if (csvRow.telegramid && csvRow.telegramid.trim() !== '') {
                        updateData.telegram_id = csvRow.telegramid.trim();
                    }
                    
                    // Actualizar el salesperson
                    await salesperson.update(updateData);
                    
                    console.log(`✅ Updated: ${salesperson.name} (ID: ${salesperson.id})`);
                    console.log(`   - Warning count: ${csvRow.warning_count}`);
                    if (updateData.telegram_id) {
                        console.log(`   - Telegram ID: ${updateData.telegram_id}`);
                    }
                    
                    updated++;
                } else {
                    console.log(`❌ Not found: ${cleanName}`);
                    notFound++;
                }
                
            } catch (error) {
                console.error(`💥 Error processing ${csvRow.name}:`, error.message);
                errors++;
            }
        }
        
        console.log('\n📊 Summary:');
        console.log(`✅ Updated: ${updated} salespersons`);
        console.log(`❌ Not found: ${notFound} salespersons`);
        console.log(`💥 Errors: ${errors} salespersons`);
        console.log(`📋 Total processed: ${csvData.length} rows`);
        
        if (notFound > 0) {
            console.log('\n🔍 Salespersons not found in database:');
            for (const csvRow of csvData) {
                const cleanName = csvRow.name.trim();
                const found = await SalesPerson.findOne({
                    where: {
                        name: {
                            [Op.iLike]: `%${cleanName}%`
                        }
                    }
                });
                if (!found) {
                    console.log(`   - ${cleanName}`);
                }
            }
        }
        
        console.log('\n🎉 Update process completed!');
        
    } catch (error) {
        console.error('💥 Fatal error during update:', error);
        process.exit(1);
    }
}

// Función para listar todos los salespersons actuales (para comparación)
async function listCurrentSalespersons() {
    try {
        // Verificar que las variables de entorno están cargadas
        if (!process.env.DB_NAME || !process.env.DB_USER || !process.env.DB_PASSWORD) {
            console.error('❌ Missing database environment variables!');
            console.error('Make sure your .env file contains: DB_NAME, DB_USER, DB_PASSWORD');
            process.exit(1);
        }
        
        console.log('📋 Current salespersons in database:');
        console.log(`📊 Database: ${process.env.DB_NAME} @ ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}\n`);
        
        const salespersons = await SalesPerson.findAll({
            order: [['name', 'ASC']]
        });
        
        salespersons.forEach(sp => {
            console.log(`${sp.id}: ${sp.name} (warnings: ${sp.warning_count}, telegram: ${sp.telegram_id || 'N/A'})`);
        });
        
    } catch (error) {
        console.error('Error listing salespersons:', error);
    }
}

// Verificar argumentos de línea de comandos
const args = process.argv.slice(2);

if (args.includes('--help') || args.includes('-h')) {
    console.log(`
📋 Salespersons CSV Update Script

Usage:
  node update-salespersons-from-csv.js [options]

Options:
  --list, -l     List current salespersons in database
  --help, -h     Show this help message

Default action: Update salespersons with CSV data
    `);
    process.exit(0);
}

if (args.includes('--list') || args.includes('-l')) {
    listCurrentSalespersons();
} else {
    updateSalespersonsFromCSV();
} 