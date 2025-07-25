const https = require('https');
const {
    Op
} = require('sequelize');
const {
    SalesPerson,
    Branch,
    EstimateStatus,
    Estimate,
    SalesPersonBranch,
    SheetColumnMap,
    CrewMember,
    Job,
    Shift,
    SpecialShift,
    JobSpecialShift,
    AutomationErrorLog,
    CrewMemberBranch
} = require('../models');
const {
    logger
} = require('../utils/logger');
require('dotenv').config();
const sequelize = require('../config/database');

// --- Lógica de Sincronización (se ejecutará en segundo plano) ---

async function runSync() {
    const logMessages = [];
    try {
        logMessages.push('🚀 Starting external estimates synchronization...');
        console.log('🚀 Starting external estimates synchronization...');

        const apiKey = await loginToAtticTech(logMessages);

        // Fecha de inicio fija, como se requirió.
        const startDate = '2025-06-15'; 
        const endDate = new Date().toISOString().split('T')[0];

        const allLeads = await fetchAllEstimatesFromAtticTech(apiKey, startDate, endDate, logMessages);
        const mappedEstimates = mapAtticTechDataToEstimates(allLeads);
        const { newCount, updatedCount } = await saveEstimatesToDb(mappedEstimates, logMessages);

        const summary = {
            message: `✅ Background synchronization finished. New: ${newCount}, Updated: ${updatedCount}.`,
            newEstimatesCount: newCount,
            updatedEstimatesCount: updatedCount,
            logs: logMessages
        };

        console.log(summary.message);
        return summary;

    } catch (error) {
        const errorSummary = {
            message: `❌ A critical error occurred during sync: ${error.message}`,
            error: error.message,
            logs: logMessages
        };
        console.error('Sync Error:', errorSummary);
        // Re-throw the error so the controller can catch it and send a 500 response
        throw error;
    }
}


// --- Funciones auxiliares para la sincronización con Attic Tech ---

async function loginToAtticTech(logMessages = []) {
    logMessages.push('🔑 Starting dynamic API login to Attic Tech...');
    
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    
    if (!API_USER_EMAIL || !API_USER_PASSWORD) {
        const errorMsg = `ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in environment variables`;
        logMessages.push(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
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
            'User-Agent': 'BotZilla API v2.0'
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
                            logMessages.push(`❌ Login JSON Parse Error: ${e.message}`);
                            reject(e); 
                        }
                    } else {
                        logMessages.push(`❌ Login API Error. Status: ${res.statusCode}, Data: ${data.substring(0, 200)}`);
                        reject(new Error(`Login request failed: ${res.statusCode} - ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => { 
                logMessages.push(`❌ Login Request Error: ${e.message}`);
                reject(e); 
            });
            
            req.write(loginData);
            req.end();
        });

        if (response.token) {
            logMessages.push('✅ Successfully logged in to Attic Tech');
            logMessages.push(`👤 Logged in as: ${response.user?.email || 'Unknown'}`);
            return response.token;
        } else {
            throw new Error('No token received in login response');
        }
    } catch (error) {
        logMessages.push(`❌ Login to Attic Tech failed: ${error.message}`);
        throw error;
    }
}

async function fetchAllEstimatesFromAtticTech(apiKey, fechaInicio, fechaFin, logMessages = []) {
    let allLeads = [];
    let page = 1;
    let hasMore = true;
    const pageSize = 100;

    logMessages.push(`📊 Starting to fetch estimates from ${fechaInicio} to ${fechaFin}`);

    while (hasMore) {
        let queryString = `limit=${pageSize}&page=${page}&depth=2&sort=-updatedAt`;
        if (fechaInicio) {
            queryString += `&where[createdAt][greater_than]=${encodeURIComponent(fechaInicio)}`;
        }
        if (fechaFin) {
            queryString += `&where[createdAt][less_than]=${encodeURIComponent(fechaFin)}`;
        }

        const options = {
            hostname: 'www.attic-tech.com',
            path: `/api/job-estimates?${queryString}`,
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Accept': 'application/json',
                'User-Agent': 'BotZilla API v2.0'
            }
        };

        try {
            const leads = await new Promise((resolve, reject) => {
                const req = https.request({ ...options, timeout: 300000 }, (resApi) => {
                    let data = '';
                    resApi.on('data', chunk => { data += chunk; });
                    resApi.on('end', () => {
                        if (resApi.statusCode === 200) {
                            try {
                                const json = JSON.parse(data);
                                resolve(json.docs || []);
                                hasMore = page < (json.totalPages || 1);
                            } catch (e) {
                                reject(new Error('Error parsing Attic Tech API response'));
                            }
                        } else {
                            reject(new Error(`Attic Tech API error: ${resApi.statusCode}`));
                        }
                    });
                });
                req.on('error', reject);
                req.on('timeout', () => {
                    req.destroy();
                    reject(new Error('Request to Attic Tech API timed out (5 minutes)'));
                });
                req.end();
            });

            allLeads = allLeads.concat(leads);
            logMessages.push(`📄 Fetched page ${page}: ${leads.length} estimates`);
            
            if (leads.length < pageSize) {
                hasMore = false;
            } else {
                page++;
            }
        } catch (error) {
            logMessages.push(`❌ Error fetching page ${page}: ${error.message}`);
            throw error;
        }
    }

    logMessages.push(`✅ Total estimates fetched: ${allLeads.length}`);
    return allLeads;
}

function mapAtticTechDataToEstimates(leads) {
    return leads.map(lead => {
        const customerName = (lead.customer_info?.firstName || lead.customer_info?.lastName)
            ? `${lead.customer_info.firstName || ''} ${lead.customer_info.lastName || ''}`.trim()
            : null;
        
        return {
            attic_tech_estimate_id: lead.id,
            name: lead.name || 'Unnamed Estimate',
            branchName: lead.branch?.name || null,
            atCreatedDate: lead.createdAt ? new Date(lead.createdAt) : null,
            atUpdatedDate: lead.updatedAt ? new Date(lead.updatedAt) : null,
            status: lead.status || 'pending',
            salespersonName: lead.user?.name || null,
            price: lead.true_cost,
            retail_cost: lead.retail_cost,
            final_price: lead.final_price,
            sub_service_retail_cost: lead.sub_services_retail_cost,
            discount: lead.discount_provided,
            attic_tech_hours: lead.labor_hours,
            customer_name: customerName,
            customer_address: lead.address,
            crew_notes: lead.crew_notes
        };
    });
}

async function findOrCreateSalesPerson(name, branchName = null, logMessages = []) {
    if (!name) return null;
    
    let [salesPerson, created] = await SalesPerson.findOrCreate({
        where: { name },
        defaults: { name, warning_count: 0 }
    });

    if (created) {
        logMessages.push(`🌱 Created new salesperson: ${name}`);
    }

    if (branchName && salesPerson) {
        const [branch, branchCreated] = await Branch.findOrCreate({
            where: { name: branchName },
            defaults: { name: branchName }
        });

        if (branchCreated) {
            logMessages.push(`🏢 Created new branch: ${branchName}`);
        }
        
        const existingRelation = await SalesPersonBranch.findOne({
            where: {
                sales_person_id: salesPerson.id,
                branch_id: branch.id
            }
        });
        
        if (!existingRelation) {
            await SalesPersonBranch.create({
                sales_person_id: salesPerson.id,
                branch_id: branch.id
            });
        }
    }

    return salesPerson;
}

async function findOrCreateBranch(name, logMessages = []) {
    if (!name) return null;
    
    const [branch, created] = await Branch.findOrCreate({
        where: { name },
        defaults: { name }
    });

    if (created) {
        logMessages.push(`🏢 Created new branch: ${name}`);
    }

    return branch;
}

async function findOrCreateEstimateStatus(name, logMessages = []) {
    if (!name) return null;
    
    const [status, created] = await EstimateStatus.findOrCreate({
        where: { name },
        defaults: { name }
    });

    if (created) {
        logMessages.push(`🔖 Created new status: ${name}`);
    }

    return status;
}

async function saveEstimatesToDb(estimatesData, logMessages = []) {
    let newCount = 0;
    let updatedCount = 0;

    for (const data of estimatesData) {
        const salesPerson = await findOrCreateSalesPerson(data.salespersonName, data.branchName, logMessages);
        const branch = await findOrCreateBranch(data.branchName, logMessages);
        const status = await findOrCreateEstimateStatus(data.status, logMessages);

        const estimatePayload = {
            name: data.name,
            attic_tech_estimate_id: data.attic_tech_estimate_id,
            at_created_date: data.atCreatedDate,
            at_updated_date: data.atUpdatedDate,
            price: data.price,
            retail_cost: data.retail_cost,
            final_price: data.final_price,
            sub_service_retail_cost: data.sub_service_retail_cost,
            discount: data.discount,
            attic_tech_hours: data.attic_tech_hours ? Math.round(data.attic_tech_hours) : null, // <-- Cambio aquí
            customer_name: data.customer_name,
            customer_address: data.customer_address,
            crew_notes: data.crew_notes,
            sales_person_id: salesPerson ? salesPerson.id : null,
            branch_id: branch ? branch.id : null,
            status_id: status ? status.id : null
        };

        const [estimate, created] = await Estimate.findOrCreate({
            where: { attic_tech_estimate_id: data.attic_tech_estimate_id },
            defaults: estimatePayload
        });

        if (created) {
            newCount++;
            logMessages.push(`✨ Created new estimate: ${estimate.name} (#${estimate.attic_tech_estimate_id})`);
        } else {
            await estimate.update(estimatePayload);
            updatedCount++;
            logMessages.push(`🔄 Updated estimate: ${estimate.name} (#${estimate.attic_tech_estimate_id})`);
        }
    }
    
    logMessages.push(`💾 Database persistence complete. New: ${newCount}, Updated: ${updatedCount}.`);
    return { newCount, updatedCount };
}

// --- Controlador Principal (ahora asíncrono) ---

class AutomationsController {

    async syncExternalEstimates(req, res) {
        console.log('[AUTOMATION] Received request to sync external estimates.');
        
        try {
            // Execute the sync process and wait for it to complete.
            const syncResult = await runSync();

            res.status(200).json({
                message: syncResult.message,
                data: {
                    newEstimatesCount: syncResult.newEstimatesCount,
                    updatedEstimatesCount: syncResult.updatedEstimatesCount
                }
            });

        } catch (error) {
            console.error('[AUTOMATION] Sync process failed:', error);
            res.status(500).json({
                message: 'Internal server error during the synchronization process.',
                error: error.message
            });
        }
    }

    /**
     * @description Syncs the column mapping from a spreadsheet header.
     * Accepts two formats:
     * 1. { sheet_name: string, header_row: string[] } (Legacy)
     * 2. { name: string, columns: object } (Preferred for Make.com)
     */
    async syncColumnMap(req, res) {
      const { sheet_name, header_row, name, columns } = req.body;
      const { dryRun } = req.query;

      let effectiveSheetName;
      let effectiveHeaderRow;

      // Handle the new, preferred format (columns as a direct JSON object)
      if (name && columns && typeof columns === 'object' && !Array.isArray(columns)) {
        effectiveSheetName = name;
        effectiveHeaderRow = Object.values(columns);
      } 
      // Handle the original format
      else if (sheet_name && header_row && Array.isArray(header_row)) {
        effectiveSheetName = sheet_name;
        effectiveHeaderRow = header_row;
      } 
      // If neither format is valid
      else {
        return res.status(400).json({
          success: false,
          message: 'Request body must match one of the supported formats.'
        });
      }

      // Validation on the processed data
      if (!effectiveSheetName || !effectiveHeaderRow || !Array.isArray(effectiveHeaderRow)) {
        return res.status(400).json({
          success: false,
          message: 'Processed data is invalid. `sheet_name` must be a string and `header_row` must be an array.'
        });
      }

      try {
        const recordsToSync = [];
        const seenFieldNames = new Set();
 
        effectiveHeaderRow.forEach((fieldName, index) => {
            if (!fieldName || typeof fieldName !== 'string' || fieldName.trim() === '') {
                return;
            }
            const trimmedFieldName = fieldName.trim();
            if (trimmedFieldName.startsWith('__') || seenFieldNames.has(trimmedFieldName)) {
                return;
            }
            seenFieldNames.add(trimmedFieldName);
 
            const techHoursIndex = effectiveHeaderRow.findIndex(h => h && h.trim() === 'Techs hours');
            const unbillableHoursIndex = effectiveHeaderRow.findIndex(h => h && h.trim() === 'Unbillable Job Hours');
 
            let fieldType = 'field'; // Default to 'field'
 
            // Check if markers were found and the current index is between them
            if (techHoursIndex !== -1 && unbillableHoursIndex !== -1 && index > techHoursIndex && index < unbillableHoursIndex) {
                fieldType = 'crew_member';
            }
 
            recordsToSync.push({
                sheet_name: effectiveSheetName.trim(),
                field_name: trimmedFieldName,
                column_index: index,
                type: fieldType
            });
        });
 
        if (recordsToSync.length === 0) {
            return res.status(400).json({
              success: false,
              message: 'No valid columns to sync.',
              created: 0,
              updated: 0
            });
        }

        logger.info(`[syncColumnMap] Preparing to sync ${recordsToSync.length} records for sheet: ${effectiveSheetName}`, {
          sheet_name: effectiveSheetName,
          records: JSON.stringify(recordsToSync, null, 2)
        });

        if (dryRun === 'true') {
          return res.status(200).json({
            success: true,
            message: `[DRY RUN] Successfully processed ${recordsToSync.length} columns for sheet "${effectiveSheetName}". No data was saved.`,
            syncedRecords: 0,
            processedRecords: recordsToSync.length,
            dataThatWouldBeSaved: recordsToSync
          });
        }

        const result = await SheetColumnMap.bulkCreate(recordsToSync, {
          updateOnDuplicate: ['column_index', 'type']
        });

        console.log(`✅ Column map for sheet "${effectiveSheetName}" synced successfully.`);

        res.status(200).json({
          success: true,
          message: `Successfully synced ${result.length} columns for sheet "${effectiveSheetName}".`,
          syncedRecords: result.length
        });

      } catch (error) {
        console.error(`❌ Error syncing column map for sheet "${effectiveSheetName}":`, error);
        res.status(500).json({
          success: false,
          message: 'An internal server error occurred during the sync.',
          error: error.message
        });
      }
    }

    /**
     * Process a single row of data from a spreadsheet.
     * @param {import('express').Request} req - The Express request object.
     * @param {import('express').Response} res - The Express response object.
     */
    async processRow(req, res) {
        const { sheet_name, row_data, row_number } = req.body;
        const { dryRun } = req.query;

        // 1. Validation
        if (!sheet_name || !row_data || !row_number) {
            return res.status(400).json({
                success: false,
                message: '`sheet_name`, `row_data`, and `row_number` are required.'
            });
        }

        let effectiveRowData;
        if (typeof row_data === 'string') {
            effectiveRowData = row_data.split(',');
        } else if (Array.isArray(row_data)) {
            effectiveRowData = row_data;
        } else {
            return res.status(400).json({
                success: false,
                message: '`row_data` must be an array or a comma-separated string.'
            });
        }

        try {
            const columnMap = await SheetColumnMap.findAll({
                where: { sheet_name },
                order: [['column_index', 'ASC']]
            });

            if (columnMap.length === 0) {
                logger.warn(`[processRow] No column map found for sheet: ${sheet_name}. Cannot process row ${row_number}.`);
                return res.status(404).json({
                    success: false,
                    message: `No column map found for sheet "${sheet_name}". Please sync the header row first.`
                });
            }

            const structuredData = {};
            columnMap.forEach(mapItem => {
                const { field_name, column_index } = mapItem;
                if (column_index < effectiveRowData.length) {
                    const value = effectiveRowData[column_index];
                    if (value !== null && value !== undefined && String(value).trim() !== '') {
                        structuredData[field_name] = String(value).trim();
                    }
                }
            });
            
            logger.info(`[processRow] Successfully processed row ${row_number} from sheet "${sheet_name}".`, {
                sheet_name,
                row_number,
                processed_data: JSON.stringify(structuredData, null, 2)
            });

            const dryRunReport = [];

            if (dryRun === 'true') {
                // Dry run logic here...
                // (The previous dry run logic can be placed here)
                return res.status(200).json({
                    success: true,
                    message: `[Dry Run] Simulation complete for row ${row_number}.`,
                    report: dryRunReport
                });
            } else {
                // Production logic with transaction
                const transaction = await sequelize.transaction();
                try {
                    const estimate = await Estimate.findOne({
                        where: {
                            name: { [Op.iLike]: `%${structuredData['Job Name']}%` },
                            status_id: 4 // 'Sold'
                        }
                    });

                    if (!estimate) {
                        await transaction.commit();
                        logger.warn(`[processRow] No 'Sold' estimate found for '${structuredData['Job Name']}'. Skipping row ${row_number}.`);
                        return res.status(200).json({ message: `Skipped row ${row_number}: No matching estimate found.` });
                    }
                    
                    const crewMemberFields = columnMap.filter(c => c.type === 'crew_member');
                    const crewMemberFullNames = crewMemberFields.map(c => c.field_name);
                    const crewLeadPartialName = structuredData['Crew Lead']?.trim();

                    let crewLeadFullName = null;
                    if (crewLeadPartialName) {
                        crewLeadFullName = crewMemberFullNames.find(fullName =>
                            fullName.toLowerCase().startsWith(crewLeadPartialName.toLowerCase())
                        );
                    }

                    const crewMemberInstances = {};
                    for (const memberName of crewMemberFullNames) {
                        const isLeader = (memberName === crewLeadFullName);
                        const [crewMember, created] = await CrewMember.findOrCreate({
                            where: { name: memberName },
                            defaults: { name: memberName, is_leader: isLeader },
                            transaction
                        });

                        // If a new crew member is created, associate them with the job's branch
                        if (created) {
                            await CrewMemberBranch.create({
                                crew_member_id: crewMember.id,
                                branch_id: estimate.branch_id
                            }, { transaction });
                        }

                        if (!created && isLeader && !crewMember.is_leader) {
                            crewMember.is_leader = true;
                            await crewMember.save({ transaction });
                        }
                        crewMemberInstances[memberName] = crewMember;
                    }

                    const crewLeaderId = crewLeadFullName ? crewMemberInstances[crewLeadFullName]?.id : null;

                    const jobData = {
                        name: structuredData['Job Name'],
                        closing_date: structuredData['Finish Date'] ? new Date(structuredData['Finish Date']) : new Date(),
                        estimate_id: estimate.id,
                        branch_id: estimate.branch_id,
                        note: structuredData['Branch notes'],
                        attic_tech_hours: parseFloat(structuredData['AT Estimated Hours']) || 0,
                        crew_leader_hours: parseFloat(structuredData['CL Estimated Plan Hours']) || 0,
                        crew_leader_id: crewLeaderId,
                    };

                    const [job, jobCreated] = await Job.findOrCreate({
                        where: { estimate_id: estimate.id },
                        defaults: jobData,
                        transaction
                    });

                    if (!jobCreated) {
                        await job.update(jobData, { transaction });
                        await Shift.destroy({ where: { job_id: job.id }, transaction });
                        await JobSpecialShift.destroy({ where: { job_id: job.id }, transaction });
                    }

                    const shiftsToCreate = [];
                    for (const memberName of crewMemberFullNames) {
                        const hours = parseFloat(structuredData[memberName]);
                        if (crewMemberInstances[memberName] && !isNaN(hours) && hours > 0) {
                            shiftsToCreate.push({
                                job_id: job.id,
                                crew_member_id: crewMemberInstances[memberName].id,
                                hours: hours,
                            });
                        }
                    }
                    if (shiftsToCreate.length > 0) {
                        await Shift.bulkCreate(shiftsToCreate, { transaction });
                    }

                    const specialShiftNamesToFind = ['qc', 'job delivery', 'visit 1', 'visit 2', 'visit 3', 'subcontractor converted to shift hours'];
                    for (const fieldName in structuredData) {
                        const normalizedFieldName = fieldName.toLowerCase().replace(/\s+/g, ' ').trim();
                        if (specialShiftNamesToFind.includes(normalizedFieldName)) {
                            const hours = parseFloat(structuredData[fieldName]);
                            if (!isNaN(hours) && hours > 0) {
                                const [specialShift] = await SpecialShift.findOrCreate({
                                    where: { name: fieldName.trim() },
                                    defaults: { name: fieldName.trim() },
                                    transaction
                                });
                                await JobSpecialShift.create({
                                    job_id: job.id,
                                    special_shift_id: specialShift.id,
                                    hours: hours,
                                    date: job.closing_date
                                }, { transaction });
                            }
                        }
                    }

                    await transaction.commit();
                    
                    res.status(200).json({ message: `Successfully processed row ${row_number} from sheet "${sheet_name}".` });

                } catch (dbError) {
                    await transaction.rollback();
                    logger.error(`[processRow] Database transaction failed for row ${row_number} from sheet "${sheet_name}": ${dbError.message}`, {
                        stack: dbError.stack,
                        structuredData
                    });
                    return res.status(500).json({ message: 'Internal server error during database operation.' });
                }
            }
        } catch (error) {
            logger.error(`[processRow] Error processing row ${row_number} from sheet "${sheet_name}": ${error.message}`);
            res.status(500).json({
                success: false,
                message: error.message
            });
        }
    }
}

module.exports = new AutomationsController(); 