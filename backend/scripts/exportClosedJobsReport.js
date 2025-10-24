#!/usr/bin/env node

/**
 * Script para exportar Closed Jobs de Attic Tech a Excel
 * 
 * Este script:
 * 1. Muestra los branches disponibles para seleccionar
 * 2. Pide un rango de fechas (mm/dd/yyyy)
 * 3. Genera un Excel con los jobs en estado "Closed Job" filtrados por branch y fechas
 * 4. Incluye: job name, scheduled_date, AT Estimated hours, Final price
 * 
 * Uso: node exportClosedJobsReport.js
 */

const axios = require('axios');
const ExcelJS = require('exceljs');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

// ==================== CONFIGURACIÓN ====================
const ATTIC_TECH_CONFIG = {
    email: 'marcelosz.office@gmail.com',
    password: 'Fideo2022!',
    baseUrl: 'https://www.attic-tech.com/api'
};

// ==================== UTILIDADES ====================

// Interfaz para input del usuario
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Promisificar readline.question
const question = (query) => new Promise((resolve) => rl.question(query, resolve));

// Formatear fecha para display
const formatDateDisplay = (dateString) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
};

// Validar formato de fecha mm/dd/yyyy
const validateDateFormat = (dateString) => {
    const regex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12][0-9]|3[01])\/\d{4}$/;
    if (!regex.test(dateString)) {
        return false;
    }
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.getMonth() === month - 1 && date.getDate() === day;
};

// Convertir fecha mm/dd/yyyy a ISO string para API
const convertToISO = (dateString) => {
    const [month, day, year] = dateString.split('/').map(Number);
    const date = new Date(year, month - 1, day);
    return date.toISOString();
};

// ==================== API FUNCTIONS ====================

/**
 * Login a Attic Tech API
 */
async function loginToAtticTech() {
    try {
        console.log('🔑 Logging into Attic Tech...');
        const response = await axios.post(`${ATTIC_TECH_CONFIG.baseUrl}/users/login`, {
            email: ATTIC_TECH_CONFIG.email,
            password: ATTIC_TECH_CONFIG.password
        });

        if (response.data && response.data.token) {
            console.log('✅ Successfully logged in to Attic Tech\n');
            return response.data.token;
        } else {
            throw new Error('No token received from Attic Tech');
        }
    } catch (error) {
        console.error('❌ Login failed:', error.message);
        throw error;
    }
}

/**
 * Obtener todos los branches disponibles
 */
async function fetchBranches(apiKey) {
    try {
        console.log('🏢 Fetching branches...');
        const response = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/branches`, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                limit: 1000,
                depth: 1
            }
        });

        const branches = response.data?.docs || [];
        console.log(`✅ Found ${branches.length} branches\n`);
        return branches;
    } catch (error) {
        console.error('❌ Error fetching branches:', error.message);
        throw error;
    }
}

/**
 * Obtener jobs filtrados por branch, fecha y estado "Closed Jobs"
 */
async function fetchClosedJobs(apiKey, branchId, startDate, endDate) {
    try {
        console.log('📦 Fetching closed jobs...');
        console.log(`   Branch ID: ${branchId}`);
        console.log(`   Date Range: ${formatDateDisplay(startDate)} - ${formatDateDisplay(endDate)}\n`);

        let allJobs = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            const response = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/jobs`, {
                headers: {
                    'Authorization': `JWT ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                params: {
                    depth: 2,
                    limit: 100,
                    page: page,
                    'where[status][equals]': 'Closed Job',
                    'where[job_estimate.branch][equals]': branchId,
                    'where[scheduled_date][greater_than_equal]': startDate,
                    'where[scheduled_date][less_than_equal]': endDate
                }
            });

            const jobs = response.data?.docs || [];
            allJobs = allJobs.concat(jobs);
            
            console.log(`   📄 Fetched page ${page}: ${jobs.length} jobs`);

            if (jobs.length < 100 || page >= (response.data?.totalPages || 1)) {
                hasMore = false;
            } else {
                page++;
            }
        }

        console.log(`✅ Total closed jobs found: ${allJobs.length}\n`);
        return allJobs;
    } catch (error) {
        console.error('❌ Error fetching jobs:', error.message);
        if (error.response) {
            console.error('   Status:', error.response.status);
            console.error('   Data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

/**
 * Obtener detalles completos de un estimate
 */
async function fetchEstimateDetails(apiKey, estimateId) {
    try {
        const response = await axios.get(`${ATTIC_TECH_CONFIG.baseUrl}/job-estimates/${estimateId}`, {
            headers: {
                'Authorization': `JWT ${apiKey}`,
                'Content-Type': 'application/json'
            },
            params: {
                depth: 2
            }
        });

        return response.data;
    } catch (error) {
        console.error(`⚠️  Warning: Could not fetch estimate ${estimateId}:`, error.message);
        return null;
    }
}

// ==================== EXCEL GENERATION ====================

/**
 * Generar archivo Excel con los datos de jobs
 */
async function generateExcel(jobs, branchName, startDateStr, endDateStr, apiKey) {
    try {
        console.log('📊 Generating Excel file...\n');

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Closed Jobs Report');

        // Configurar columnas
        worksheet.columns = [
            { header: 'Job Name', key: 'job_name', width: 40 },
            { header: 'Scheduled Date', key: 'scheduled_date', width: 20 },
            { header: 'AT Estimated Hours', key: 'estimated_hours', width: 20 },
            { header: 'Final Price', key: 'final_price', width: 20 }
        ];

        // Estilo del header
        worksheet.getRow(1).font = { bold: true, size: 12 };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' }
        };
        worksheet.getRow(1).font = { ...worksheet.getRow(1).font, color: { argb: 'FFFFFFFF' } };
        worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

        // Agregar datos
        let jobsWithData = 0;
        let jobsWithoutEstimate = 0;

        for (const job of jobs) {
            const estimateId = typeof job.job_estimate === 'object' ? job.job_estimate?.id : job.job_estimate;
            
            let estimatedHours = null;
            let finalPrice = null;

            if (estimateId) {
                // Si el job ya tiene los datos del estimate en depth 2, usarlos
                if (typeof job.job_estimate === 'object' && job.job_estimate.labor_hours !== undefined) {
                    estimatedHours = job.job_estimate.labor_hours;
                    finalPrice = job.job_estimate.final_price || job.job_estimate.tax_details?.final_price_after_taxes;
                } else {
                    // Sino, hacer una llamada adicional para obtener los detalles
                    console.log(`   🔍 Fetching estimate details for job: ${job.name}`);
                    const estimate = await fetchEstimateDetails(apiKey, estimateId);
                    if (estimate) {
                        estimatedHours = estimate.labor_hours;
                        // Priorizar final_price_after_taxes si existe (para Kent/Everett)
                        finalPrice = estimate.tax_details?.final_price_after_taxes || estimate.final_price;
                    }
                }
                jobsWithData++;
            } else {
                jobsWithoutEstimate++;
            }

            const row = worksheet.addRow({
                job_name: job.name || 'N/A',
                scheduled_date: formatDateDisplay(job.scheduled_date),
                estimated_hours: estimatedHours !== null ? estimatedHours : 'N/A',
                final_price: finalPrice !== null ? finalPrice : 'N/A'
            });

            // Aplicar formato de moneda a la columna de precio (columna D)
            if (finalPrice !== null) {
                row.getCell(4).numFmt = '$#,##0.00';
            }

            // Aplicar formato numérico a las horas (columna C)
            if (estimatedHours !== null) {
                row.getCell(3).numFmt = '0.00';
            }
        }

        // Agregar bordes a todas las celdas
        worksheet.eachRow((row, rowNumber) => {
            row.eachCell((cell) => {
                cell.border = {
                    top: { style: 'thin' },
                    left: { style: 'thin' },
                    bottom: { style: 'thin' },
                    right: { style: 'thin' }
                };
            });
        });

        // Crear nombre de archivo
        const timestamp = new Date().toISOString().split('T')[0];
        const sanitizedBranchName = branchName.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const fileName = `closed_jobs_${sanitizedBranchName}_${timestamp}.xlsx`;
        const exportsDir = path.join(__dirname, '..', 'exports');
        
        // Crear directorio exports si no existe
        if (!fs.existsSync(exportsDir)) {
            fs.mkdirSync(exportsDir, { recursive: true });
        }

        const filePath = path.join(exportsDir, fileName);

        // Guardar archivo
        await workbook.xlsx.writeFile(filePath);

        console.log('✅ Excel file generated successfully!\n');
        console.log('📊 Summary:');
        console.log(`   Branch: ${branchName}`);
        console.log(`   Date Range: ${startDateStr} - ${endDateStr}`);
        console.log(`   Total Jobs: ${jobs.length}`);
        console.log(`   Jobs with estimate data: ${jobsWithData}`);
        console.log(`   Jobs without estimate: ${jobsWithoutEstimate}`);
        console.log(`\n📁 File saved to: ${filePath}\n`);

        return filePath;
    } catch (error) {
        console.error('❌ Error generating Excel:', error.message);
        throw error;
    }
}

// ==================== MAIN FUNCTION ====================

async function main() {
    let apiKey = null;

    try {
        console.log('\n==============================================');
        console.log('   CLOSED JOBS REPORT GENERATOR');
        console.log('   Attic Tech API Export Tool');
        console.log('==============================================\n');

        // 1. Login
        apiKey = await loginToAtticTech();

        // 2. Obtener branches
        const branches = await fetchBranches(apiKey);

        if (branches.length === 0) {
            console.log('❌ No branches found. Exiting...\n');
            rl.close();
            return;
        }

        // 3. Mostrar branches disponibles
        console.log('📋 Available Branches:');
        branches.forEach((branch, index) => {
            console.log(`   ${index + 1}. ${branch.name} (ID: ${branch.id})`);
        });
        console.log('');

        // 4. Seleccionar branch
        let selectedBranch = null;
        while (!selectedBranch) {
            const branchInput = await question('🏢 Select a branch (enter number): ');
            const branchIndex = parseInt(branchInput) - 1;

            if (branchIndex >= 0 && branchIndex < branches.length) {
                selectedBranch = branches[branchIndex];
                console.log(`✅ Selected: ${selectedBranch.name}\n`);
            } else {
                console.log('❌ Invalid selection. Please try again.\n');
            }
        }

        // 5. Obtener fecha de inicio
        let startDateStr = null;
        let startDateISO = null;
        while (!startDateStr) {
            const input = await question('📅 Enter start date (mm/dd/yyyy): ');
            if (validateDateFormat(input)) {
                startDateStr = input;
                startDateISO = convertToISO(input);
                console.log(`✅ Start date: ${input}\n`);
            } else {
                console.log('❌ Invalid date format. Please use mm/dd/yyyy (e.g., 01/15/2025)\n');
            }
        }

        // 6. Obtener fecha de fin
        let endDateStr = null;
        let endDateISO = null;
        while (!endDateStr) {
            const input = await question('📅 Enter end date (mm/dd/yyyy): ');
            if (validateDateFormat(input)) {
                endDateStr = input;
                // Ajustar la fecha de fin al final del día
                const [month, day, year] = input.split('/').map(Number);
                const endDate = new Date(year, month - 1, day, 23, 59, 59, 999);
                endDateISO = endDate.toISOString();
                console.log(`✅ End date: ${input}\n`);
            } else {
                console.log('❌ Invalid date format. Please use mm/dd/yyyy (e.g., 12/31/2025)\n');
            }
        }

        // 7. Validar que la fecha de inicio sea anterior a la fecha de fin
        if (new Date(startDateISO) > new Date(endDateISO)) {
            console.log('❌ Error: Start date must be before end date. Exiting...\n');
            rl.close();
            return;
        }

        // 8. Buscar jobs
        const jobs = await fetchClosedJobs(apiKey, selectedBranch.id, startDateISO, endDateISO);

        if (jobs.length === 0) {
            console.log('⚠️  No closed jobs found for the selected criteria.\n');
            rl.close();
            return;
        }

        // 9. Generar Excel
        const filePath = await generateExcel(jobs, selectedBranch.name, startDateStr, endDateStr, apiKey);

        console.log('✅ Process completed successfully!\n');

    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        console.error('\nStack trace:', error.stack);
    } finally {
        rl.close();
    }
}

// ==================== EXECUTION ====================

// Ejecutar script
main().catch((error) => {
    console.error('❌ Unhandled error:', error);
    process.exit(1);
});

