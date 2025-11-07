const { Branch, PerformanceSyncJob, SheetColumnMap, BuilderTrendShift } = require('../models');
const { Op } = require('sequelize');
const { logger } = require('../utils/logger');
const makeWebhookService = require('../services/makeWebhook.service');
const builderTrendParserService = require('../services/builderTrendParser.service');
const { getMatchingStats } = require('../utils/jobMatcher');
const { aggregateShiftsByCrewAndJob } = require('../utils/timeConverter');
const { v4: uuidv4 } = require('uuid');
const { sendBulkAutomaticOverrunAlerts } = require('./jobs.controller');

/**
 * Mapeo de nombres de branches: Base de Datos → Google Spreadsheet
 * Los nombres en el spreadsheet son diferentes a los de la BD
 */
const BRANCH_NAME_MAPPING = {
    'Orange County': 'Orange',
    'San Diego': 'San Diego',
    'Los Angeles': 'Los Angeles',
    'San Bernardino': 'San Bernardino',
    'Kent -WA': 'Kent',
    'Everett -WA': 'Everett'
};

/**
 * Controlador para la gestión de Performance y Jobs
 */
class PerformanceController {

    /**
     * Activar webhook de Make.com para traer jobs en estado "uploading shifts"
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async triggerJobsSync(req, res) {
        try {
            const { branch_id, status, sync_id } = req.body;

            // Validar que se envió el branch_id
            if (!branch_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Branch ID is required'
                });
            }

            // Validar que se envió el status
            if (!status) {
                return res.status(400).json({
                    success: false,
                    message: 'Status is required'
                });
            }

            // Validar que se envió el sync_id
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }

            // Validar que el status sea uno de los permitidos
            const validStatuses = ['Closed Job', 'Uploading Shifts', 'Missing Data to Close', 'In Payload'];
            if (!validStatuses.includes(status)) {
                return res.status(400).json({
                    success: false,
                    message: `Status must be one of: ${validStatuses.join(', ')}`
                });
            }

            // Buscar el branch en la base de datos
            const branch = await Branch.findByPk(branch_id);

            if (!branch) {
                return res.status(404).json({
                    success: false,
                    message: 'Branch not found'
                });
            }

            // Mapear el nombre del branch de DB a Spreadsheet
            const spreadsheetBranchName = BRANCH_NAME_MAPPING[branch.name] || branch.name;

            logger.info('Triggering performance jobs sync', {
                branchId: branch.id,
                branchNameDB: branch.name,
                branchNameSpreadsheet: spreadsheetBranchName,
                status: status,
                triggeredBy: req.user?.email || 'unknown'
            });

            // Enviar webhook a Make.com con el nombre mapeado
            const result = await makeWebhookService.sendPerformanceJobsRequest({
                branchId: branch.id,
                branchName: spreadsheetBranchName,
                status: status,
                syncId: sync_id
            });

            if (!result) {
                return res.status(500).json({
                    success: false,
                    message: 'Make.com webhook is not configured. Please set MAKE_PERFORMANCE_WEBHOOK_URL.'
                });
            }

            return res.status(200).json({
                success: true,
                message: `Jobs sync triggered successfully for branch: ${branch.name} (${spreadsheetBranchName}) with status: ${status}`,
                data: {
                    sync_id: req.body.sync_id, // Return the sync_id so frontend can query the results
                    branch: {
                        id: branch.id,
                        name_db: branch.name,
                        name_spreadsheet: spreadsheetBranchName
                    },
                    status: status,
                    webhook_response: result.data
                }
            });

        } catch (error) {
            logger.error('Error triggering jobs sync', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to trigger jobs sync',
                error: error.message
            });
        }
    }

    /**
     * Obtener todos los branches disponibles para el selector
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getBranches(req, res) {
        try {
            const branches = await Branch.findAll({
                where: {
                    name: {
                        [require('sequelize').Op.ne]: 'Corporate'
                    }
                },
                attributes: ['id', 'name', 'address'],
                order: [['name', 'ASC']]
            });

            return res.status(200).json({
                success: true,
                data: branches
            });

        } catch (error) {
            logger.error('Error fetching branches', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to fetch branches',
                error: error.message
            });
        }
    }

    /**
     * Obtener jobs desde el spreadsheet vía Make.com webhook
     * Envía el branch y el rango de fechas al webhook
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async fetchJobsFromSpreadsheet(req, res) {
        try {
            const { branchName, fromDate, toDate } = req.body;

            if (!branchName) {
                return res.status(400).json({
                    success: false,
                    message: 'Branch name is required'
                });
            }

            if (!fromDate || !toDate) {
                return res.status(400).json({
                    success: false,
                    message: 'From date and to date are required'
                });
            }

            const webhookUrl = process.env.MAKE_FETCH_JOBS_WEBHOOK_URL;

            if (!webhookUrl) {
                logger.error('MAKE_FETCH_JOBS_WEBHOOK_URL not configured');
                return res.status(500).json({
                    success: false,
                    message: 'Webhook URL not configured'
                });
            }

            // Convertir fechas de YYYY-MM-DD a MM/DD/YYYY
            const formatDate = (dateStr) => {
                const [year, month, day] = dateStr.split('-');
                return `${month}/${day}/${year}`;
            };

            const fromDateFormatted = formatDate(fromDate);
            const toDateFormatted = formatDate(toDate);

            // Generar sync_id único
            const { v4: uuidv4 } = require('uuid');
            const syncId = uuidv4();

            const payload = {
                sync_id: syncId,
                branch: branchName,
                fromDate: fromDateFormatted,
                toDate: toDateFormatted
            };

            logger.info('Triggering Make.com webhook to fetch jobs from spreadsheet', {
                syncId,
                branchName,
                fromDate: fromDateFormatted,
                toDate: toDateFormatted,
                webhookUrl: webhookUrl.substring(0, 50) + '...'
            });

            // Llamar al webhook de Make.com (fire and forget)
            // Make.com responderá "Accepted" y luego hará un HTTP Request de vuelta a /receive-jobs-from-spreadsheet
            const axios = require('axios');
            const response = await axios.post(webhookUrl, payload, {
                headers: {
                    'Content-Type': 'application/json'
                },
                timeout: 10000 // 10 segundos solo para confirmar que el webhook fue recibido
            });

            logger.info('Make.com webhook triggered successfully', {
                syncId,
                branchName,
                response: response.data
            });

            return res.status(200).json({
                success: true,
                sync_id: syncId,
                message: 'Webhook triggered successfully. Make.com will send jobs back.'
            });

        } catch (error) {
            logger.error('Error fetching jobs from spreadsheet', {
                error: error.message,
                stack: error.stack,
                response: error.response?.data
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to fetch jobs from spreadsheet',
                error: error.message
            });
        }
    }

    /**
     * Recibir array de jobs desde Make.com (HTTP Request response)
     * Cada elemento del array es un array que representa una fila
     * El nombre del job está en la posición [2]
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async receiveJobsFromSpreadsheet(req, res) {
        try {
            // Log completo del body para debug
            logger.info('Raw body received from Make.com', {
                bodyKeys: req.body ? Object.keys(req.body) : 'null',
                hasData: !!req.body?.data,
                hasArray: !!req.body?.data?.array
            });

            let dataArray;

            // Make.com puede enviar en diferentes formatos:
            // 1. { data: { array: [...] } } - formato con nested array
            // 2. { data: [...] } - formato directo (PREFERIDO)
            if (req.body?.data && Array.isArray(req.body.data)) {
                dataArray = req.body.data;
                logger.info('Using data format (direct array)');
            } else if (req.body?.data?.array && Array.isArray(req.body.data.array)) {
                dataArray = req.body.data.array;
                logger.info('Using data.array format from Make.com');
            } else {
                logger.error('Invalid data format', {
                    receivedBody: req.body,
                    dataType: typeof req.body?.data,
                    hasData: !!req.body?.data
                });
                return res.status(400).json({
                    success: false,
                    message: 'Invalid data format. Expected { data: [...] } or { data: { array: [...] } }',
                    receivedKeys: req.body ? Object.keys(req.body) : []
                });
            }

            logger.info('Receiving jobs array from Make.com', {
                rowsCount: dataArray.length,
                firstRowKeys: dataArray[0] ? Object.keys(dataArray[0]).slice(0, 10) : [],
                firstRowSample: dataArray[0]
            });

            // Obtener sync_id del body (Make.com debe enviarlo de vuelta)
            const syncId = req.body.sync_id;
            const branchName = req.body.branch || req.body.branchName || 'unknown';

            if (!syncId) {
                logger.error('No sync_id provided in request', {
                    receivedBody: req.body
                });
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }

            // Buscar branch_id en la BD
            let branchId = null;
            try {
                const branch = await Branch.findOne({
                    where: {
                        name: {
                            [Op.iLike]: branchName
                        }
                    }
                });
                if (branch) {
                    branchId = branch.id;
                    logger.info('Branch found for spreadsheet jobs', {
                        branchName,
                        branchId
                    });
                } else {
                    logger.warn('Branch not found for spreadsheet jobs', {
                        branchName
                    });
                }
            } catch (error) {
                logger.error('Error finding branch', {
                    branchName,
                    error: error.message
                });
            }

            // Determinar el índice del crew leader según el estado del branch
            // CA branches: crew_leader en columna H (índice 7)
            // WA branches: crew_leader en columna I (índice 8)
            const caBranches = ['Riverside', 'San Diego', 'San Bernardino', 'Orange County', 'Los Angeles'];
            const waBranches = ['Kent', 'Everett', 'Seattle'];
            
            let crewLeaderIndex = 8; // Default WA
            if (caBranches.some(ca => branchName.includes(ca))) {
                crewLeaderIndex = 7; // CA
            }

            logger.info('Crew leader column index determined', {
                branchName,
                crewLeaderIndex,
                state: crewLeaderIndex === 7 ? 'CA' : 'WA'
            });

            // Convertir objetos con claves numéricas a arrays y crear registros para la BD
            const PerformanceSyncJob = require('../models/PerformanceSyncJob');
            
            const jobRecords = [];
            
            for (let index = 0; index < dataArray.length; index++) {
                const row = dataArray[index];
                
                // Si row es un objeto con claves numéricas, convertir a array
                let rowArray;
                if (Array.isArray(row)) {
                    rowArray = row;
                } else if (typeof row === 'object' && row !== null) {
                    // Convertir objeto {"0": "val", "1": "val", "2": "val"} a array
                    const keys = Object.keys(row).filter(k => !isNaN(k)).sort((a, b) => Number(a) - Number(b));
                    rowArray = keys.map(k => row[k]);
                } else {
                    continue; // Skip invalid rows
                }

                // Validar que tenga al menos 3 elementos
                if (!rowArray || rowArray.length < 3) {
                    continue;
                }

                const jobName = rowArray[2] || '';
                
                // Filtrar jobs sin nombre
                if (!jobName || jobName.trim() === '') {
                    continue;
                }

                // Extraer más campos del array (basado en posiciones conocidas del spreadsheet)
                // Posición [1] = Job Closing Date (columna B)
                // Posición [2] = Job Name (columna C)
                // Posición [3] = Estimator (columna D - opcional)
                // Posición [7] = Crew Leader (columna H - CA)
                // Posición [8] = Crew Leader (columna I - WA)
                
                // Parsear fecha de cierre de la columna B (índice 1)
                let finishDate = null;
                if (rowArray[1]) {
                    try {
                        // Intentar parsear la fecha (puede venir en varios formatos)
                        const dateStr = rowArray[1].toString().trim();
                        
                        // Log para debug
                        logger.info('Parsing finish_date from spreadsheet', {
                            job_name: jobName,
                            raw_date_value: dateStr,
                            raw_date_type: typeof rowArray[1],
                            raw_date_raw: rowArray[1]
                        });
                        
                        if (dateStr) {
                            // Intentar parsear diferentes formatos de fecha
                            // Formato común: "MM/DD/YYYY" o "YYYY-MM-DD" o ISO string con timezone
                            let parsedDate = null;
                            
                            // Intentar formato MM/DD/YYYY
                            const mmddyyyyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
                            if (mmddyyyyMatch) {
                                const [, month, day, year] = mmddyyyyMatch;
                                // Crear fecha en hora local (no UTC) para evitar problemas de timezone
                                parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                logger.info('Parsed as MM/DD/YYYY', {
                                    job_name: jobName,
                                    month, day, year,
                                    parsed_date: parsedDate.toISOString(),
                                    local_date: `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
                                });
                            } else {
                                // Intentar formato YYYY-MM-DD
                                const yyyymmddMatch = dateStr.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
                                if (yyyymmddMatch) {
                                    const [, year, month, day] = yyyymmddMatch;
                                    // Crear fecha en hora local (no UTC) para evitar problemas de timezone
                                    parsedDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
                                    logger.info('Parsed as YYYY-MM-DD', {
                                        job_name: jobName,
                                        year, month, day,
                                        parsed_date: parsedDate.toISOString(),
                                        local_date: `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
                                    });
                                } else {
                                    // Fallback: si viene como ISO string con timezone, extraer solo la fecha
                                    const tempDate = new Date(dateStr);
                                    if (!isNaN(tempDate.getTime())) {
                                        // Usar los componentes de fecha local (no UTC) para evitar problemas de timezone
                                        parsedDate = new Date(tempDate.getFullYear(), tempDate.getMonth(), tempDate.getDate());
                                        logger.info('Parsed as ISO/Other format', {
                                            job_name: jobName,
                                            original_string: dateStr,
                                            temp_date_utc: tempDate.toISOString(),
                                            parsed_date_local: parsedDate.toISOString(),
                                            local_date: `${parsedDate.getFullYear()}-${String(parsedDate.getMonth() + 1).padStart(2, '0')}-${String(parsedDate.getDate()).padStart(2, '0')}`
                                        });
                                    }
                                }
                            }
                            
                            // Validar que sea una fecha válida
                            if (parsedDate && !isNaN(parsedDate.getTime())) {
                                finishDate = parsedDate;
                            } else {
                                logger.warn('Invalid finish_date format', { 
                                    job_name: jobName,
                                    raw_date: dateStr 
                                });
                                finishDate = null;
                            }
                        }
                    } catch (error) {
                        logger.error('Error parsing finish_date', {
                            job_name: jobName,
                            raw_date: rowArray[1],
                            error: error.message
                        });
                    }
                }
                
                const jobRecord = {
                    sync_id: syncId,
                    branch_name: branchName,
                    branch_id: branchId, // Agregar branch_id
                    status_filter: 'spreadsheet',
                    row_number: index + 1,
                    sheet_name: 'Performance Spreadsheet',
                    job_name: jobName,
                    finish_date: finishDate, // Fecha de cierre del job (columna B)
                    estimator: rowArray[3] || null,
                    crew_leader: rowArray[crewLeaderIndex] || null,
                    raw_data: rowArray // Guardar el array completo
                };

                jobRecords.push(jobRecord);
            }

            if (jobRecords.length === 0) {
                logger.warn('No valid jobs found in spreadsheet data', {
                    syncId,
                    totalRows: dataArray.length
                });
                return res.status(400).json({
                    success: false,
                    message: 'No valid jobs found in spreadsheet data'
                });
            }

            // Guardar todos los jobs en la base de datos
            await PerformanceSyncJob.bulkCreate(jobRecords);

            logger.info('Jobs saved to database', {
                syncId,
                branchName,
                totalRows: dataArray.length,
                validJobs: jobRecords.length,
                sampleJobNames: jobRecords.slice(0, 5).map(j => j.job_name)
            });

            return res.status(200).json({
                success: true,
                sync_id: syncId,
                totalRows: dataArray.length,
                validJobs: jobRecords.length,
                message: `${jobRecords.length} jobs saved successfully`
            });

        } catch (error) {
            logger.error('Error receiving jobs from spreadsheet', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to process jobs from spreadsheet',
                error: error.message
            });
        }
    }

    /**
     * Obtener jobs de la base de datos (polling endpoint para el frontend)
     * Devuelve el mismo formato que getSyncJobs para compatibilidad
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getSpreadsheetJobsFromCache(req, res) {
        try {
            const { syncId } = req.query;

            logger.info('Polling for jobs', {
                syncId,
                queryParams: req.query
            });

            if (!syncId) {
                logger.warn('No syncId provided in query');
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }

            const PerformanceSyncJob = require('../models/PerformanceSyncJob');
            
            // Buscar jobs en la base de datos con los mismos campos que getSyncJobs
            const jobs = await PerformanceSyncJob.findAll({
                where: { sync_id: syncId },
                order: [['row_number', 'ASC']],
                attributes: [
                    'id',
                    'sync_id',
                    'branch_name',
                    'branch_id',
                    'status_filter',
                    'row_number',
                    'job_name',
                    'job_status',
                    'start_date',
                    'finish_date',
                    'estimator',
                    'crew_leader',
                    'at_estimated_hours',
                    'cl_estimated_hours',
                    'percent_planned_to_save',
                    'actual_percent_saved',
                    'job_bonus_pool',
                    'match_status',
                    'match_confidence',
                    'matched_job_id',
                    'created_at'
                ]
            });

            if (!jobs || jobs.length === 0) {
                logger.info('No jobs found yet for sync_id', {
                    syncId,
                    searchedSyncId: syncId
                });
                return res.status(404).json({
                    success: false,
                    message: 'No jobs found for this sync_id',
                    ready: false
                });
            }

            logger.info('Jobs retrieved from database', {
                syncId,
                jobsCount: jobs.length,
                firstJobSyncId: jobs[0]?.sync_id
            });

            // Devolver en el mismo formato que getSyncJobs
            return res.status(200).json({
                success: true,
                ready: true,
                data: {
                    sync_id: syncId,
                    count: jobs.length,
                    jobs
                }
            });

        } catch (error) {
            logger.error('Error retrieving jobs from database', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve jobs from database',
                error: error.message
            });
        }
    }

    /**
     * Recibir job individual desde Make.com
     * Make.com enviará toda la fila y usamos sheet_column_map para mapear los campos
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async receiveJob(req, res) {
        try {
            const {
                sync_id,
                branch_id,
                branch_name,
                status_filter,
                sheet_name,
                row_data // Toda la fila del spreadsheet
            } = req.body;

            // Validaciones básicas
            if (!sync_id || !branch_name || !status_filter || !row_data) {
                return res.status(400).json({
                    success: false,
                    message: 'Missing required fields: sync_id, branch_name, status_filter, row_data'
                });
            }

            // Parse row_data si viene como string
            let parsedData = row_data;
            if (typeof row_data === 'string') {
                try {
                    parsedData = JSON.parse(row_data);
                } catch (e) {
                    parsedData = row_data;
                }
            }

            // Extraer row_number del parsedData
            const row_number = parsedData['__ROW_NUMBER__'] || parsedData['row_number'] || 0;

            // Obtener el mapeo de columnas para este sheet
            const effectiveSheetName = sheet_name || branch_name;
            const columnMaps = await SheetColumnMap.findAll({
                where: {
                    sheet_name: effectiveSheetName
                }
            });

            if (columnMaps.length === 0) {
                logger.warn('No column map found for sheet', {
                    sheet_name: effectiveSheetName,
                    branch_name
                });
            }

            // Crear un helper para obtener valores por field_name
            const getValueByFieldName = (fieldName) => {
                const columnMap = columnMaps.find(cm => 
                    cm.field_name && cm.field_name.toLowerCase() === fieldName.toLowerCase()
                );
                if (!columnMap) return null;
                
                const value = parsedData[columnMap.column_index];
                return value !== undefined && value !== null && value !== '' ? value : null;
            };

            // Helper para parsear fechas
            const parseDate = (dateStr) => {
                if (!dateStr) return null;
                try {
                    const date = new Date(dateStr);
                    return isNaN(date.getTime()) ? null : date;
                } catch (e) {
                    return null;
                }
            };

            // Helper para parsear números
            const parseFloatSafe = (value) => {
                if (!value) return null;
                try {
                    const num = parseFloat(value);
                    return isNaN(num) ? null : num;
                } catch (e) {
                    return null;
                }
            };

            // Mapear los campos usando el column_map
            const jobData = {
                sync_id,
                branch_id: branch_id || null,
                branch_name,
                status_filter,
                row_number: parseInt(row_number),
                sheet_name: effectiveSheetName,
                
                // Mapeo automático usando sheet_column_map
                job_name: getValueByFieldName('Job Name'),
                job_status: getValueByFieldName('Status'),
                start_date: parseDate(getValueByFieldName('Start Date')),
                finish_date: parseDate(getValueByFieldName('Finish Date')),
                estimator: getValueByFieldName('Estimator'),
                crew_leader: getValueByFieldName('Crew Lead'),
                at_estimated_hours: parseFloatSafe(getValueByFieldName('AT Estimated Hours')),
                cl_estimated_hours: parseFloatSafe(getValueByFieldName('CL Estimated Plan Hours')),
                percent_planned_to_save: parseFloatSafe(getValueByFieldName('% Planed to save')),
                actual_percent_saved: parseFloatSafe(getValueByFieldName('Actual % Saved')),
                job_bonus_pool: parseFloatSafe(getValueByFieldName('Job Bonus pool')),
                
                // Guardar toda la data raw para referencia
                raw_data: parsedData
            };

            logger.info('Processing job with mapped fields', {
                sync_id,
                row_number,
                job_name: jobData.job_name,
                mapped_fields: Object.keys(jobData).filter(k => jobData[k] !== null).length
            });

            // Crear o actualizar el job
            const [job, created] = await PerformanceSyncJob.upsert(jobData, {
                conflictFields: ['sync_id', 'row_number']
            });

            logger.info('Performance job received from Make.com', {
                sync_id,
                row_number,
                job_name: jobData.job_name,
                created
            });

            return res.status(200).json({
                success: true,
                message: created ? 'Job created successfully' : 'Job updated successfully',
                data: {
                    id: job.id,
                    sync_id: job.sync_id,
                    row_number: job.row_number,
                    job_name: job.job_name
                }
            });

        } catch (error) {
            logger.error('Error receiving job from Make.com', {
                error: error.message,
                stack: error.stack,
                body: req.body
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to save job',
                error: error.message
            });
        }
    }

    /**
     * Obtener todos los jobs de un sync_id específico
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getSyncJobs(req, res) {
        try {
            const { sync_id } = req.params;

            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }

            const jobs = await PerformanceSyncJob.findAll({
                where: { sync_id },
                order: [['row_number', 'ASC']],
                attributes: [
                    'id',
                    'sync_id',
                    'branch_name',
                    'branch_id',
                    'status_filter',
                    'row_number',
                    'job_name',
                    'job_status',
                    'start_date',
                    'finish_date',
                    'estimator',
                    'crew_leader',
                    'at_estimated_hours',
                    'cl_estimated_hours',
                    'percent_planned_to_save',
                    'actual_percent_saved',
                    'job_bonus_pool',
                    'match_status',
                    'match_confidence',
                    'matched_job_id',
                    'created_at'
                ]
            });

            logger.info('Sync jobs retrieved', {
                sync_id,
                count: jobs.length
            });

            return res.status(200).json({
                success: true,
                data: {
                    sync_id,
                    count: jobs.length,
                    jobs
                }
            });

        } catch (error) {
            logger.error('Error retrieving sync jobs', {
                error: error.message,
                stack: error.stack,
                sync_id: req.params.sync_id
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve sync jobs',
                error: error.message
            });
        }
    }

    /**
     * Procesar upload de Excel de BuilderTrend
     * @param {Object} req - Request object con el archivo
     * @param {Object} res - Response object
     */
    async uploadBuilderTrendExcel(req, res) {
        try {
            const { sync_id } = req.body;
            
            // Validar que se envió el sync_id
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }
            
            // Validar que se envió un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Excel file is required'
                });
            }
            
            logger.info('Processing BuilderTrend Excel upload', {
                sync_id,
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });
            
            // Verificar que existen jobs en este sync
            const syncJobsCount = await PerformanceSyncJob.count({
                where: { sync_id }
            });
            
            if (syncJobsCount === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No jobs found for this sync_id. Please trigger a sync first.'
                });
            }
            
            // Parsear el Excel
            const { rawShifts } = await builderTrendParserService.parseBuilderTrendExcel(
                req.file.buffer,
                sync_id
            );
            
            // Generar un upload_id único para este batch
            const uploadId = uuidv4();
            
            // Procesar y guardar shifts (SIN matching - solo agrupar)
            const result = await builderTrendParserService.processAndSaveShifts(
                rawShifts,
                sync_id,
                uploadId
            );
            
            // Obtener los jobs del spreadsheet (sincronizados previamente)
            const spreadsheetJobs = await PerformanceSyncJob.findAll({
                where: { sync_id },
                order: [['row_number', 'ASC']],
                attributes: ['id', 'job_name', 'job_status', 'crew_leader', 'estimator', 'at_estimated_hours', 'cl_estimated_hours', 'branch_id', 'branch_name']
            });
            
            logger.info('BuilderTrend Excel processed - ready for manual matching', {
                sync_id,
                upload_id: uploadId,
                excel_jobs: result.excel_jobs.length,
                spreadsheet_jobs: spreadsheetJobs.length
            });
            
            return res.status(200).json({
                success: true,
                message: 'Excel processed. Please confirm job matches.',
                data: {
                    upload_id: uploadId,
                    sync_id,
                    total_shifts: result.totalShifts,
                    excel_jobs: result.excel_jobs, // Jobs del Excel agrupados
                    spreadsheet_jobs: spreadsheetJobs // Jobs del spreadsheet
                }
            });
            
        } catch (error) {
            logger.error('Error uploading BuilderTrend Excel', {
                error: error.message,
                stack: error.stack,
                sync_id: req.body.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to process Excel file',
                error: error.message
            });
        }
    }
    
    /**
     * Obtener shifts procesados para un sync_id
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getProcessedShifts(req, res) {
        try {
            const { sync_id } = req.params;
            const { upload_id, aggregated } = req.query;
            
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }
            
            const whereClause = { sync_id };
            if (upload_id) {
                whereClause.upload_id = upload_id;
            }
            
            // Obtener shifts con información del job matched
            const shifts = await BuilderTrendShift.findAll({
                where: whereClause,
                include: [
                    {
                        model: PerformanceSyncJob,
                        as: 'matchedSyncJob',
                        required: false,
                        attributes: ['id', 'job_name', 'row_number', 'crew_leader', 'estimator']
                    }
                ],
                order: [['excel_row_number', 'ASC']]
            });
            
            logger.info('Retrieved processed shifts', {
                sync_id,
                upload_id,
                count: shifts.length
            });
            
            // Si se pide agregado, agrupar por crew member y job
            let responseData = shifts;
            if (aggregated === 'true') {
                responseData = aggregateShiftsByCrewAndJob(shifts.map(s => s.toJSON()));
            }
            
            // Obtener estadísticas
            const stats = getMatchingStats(shifts.map(s => s.toJSON()));
            
            return res.status(200).json({
                success: true,
                data: {
                    sync_id,
                    upload_id: upload_id || 'all',
                    count: shifts.length,
                    shifts: responseData,
                    stats
                }
            });
            
        } catch (error) {
            logger.error('Error retrieving processed shifts', {
                error: error.message,
                stack: error.stack,
                sync_id: req.params.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve processed shifts',
                error: error.message
            });
        }
    }

    /**
     * Confirmar matches de jobs manualmente (desde el modal)
     * Recibe array de { job_name_excel, matched_sync_job_id }
     * Actualiza todos los shifts de ese job_name_excel
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async confirmJobMatches(req, res) {
        try {
            const { sync_id, matches } = req.body;
            
            if (!sync_id || !matches || !Array.isArray(matches)) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id and matches array are required'
                });
            }
            
            logger.info('Processing manual job matches', {
                sync_id,
                matches_count: matches.length,
                matches
            });
            
            const updateResults = [];
            
            // Para cada match confirmado, actualizar todos sus shifts
            for (const match of matches) {
                const { job_name_excel, matched_sync_job_id } = match;
                
                if (!job_name_excel) {
                    logger.warn('Skipping match without job_name_excel', { match });
                    continue;
                }
                
                // Actualizar todos los shifts de este job
                const [affectedRows] = await BuilderTrendShift.update(
                    {
                        matched_sync_job_id: matched_sync_job_id || null,
                        match_status: matched_sync_job_id ? 'matched' : 'no_match',
                        match_confidence: matched_sync_job_id ? 100 : 0, // 100% porque es manual
                        needs_human_review: false,
                        processed_at: new Date()
                    },
                    {
                        where: {
                            sync_id,
                            job_name_raw: job_name_excel
                        }
                    }
                );
                
                updateResults.push({
                    job_name_excel,
                    matched_sync_job_id,
                    shifts_updated: affectedRows
                });
                
                logger.info('Updated shifts for job match', {
                    job_name_excel,
                    matched_sync_job_id,
                    shifts_updated: affectedRows
                });
            }
            
            logger.info('Manual job matches confirmed', {
                sync_id,
                total_jobs_processed: updateResults.length,
                total_shifts_updated: updateResults.reduce((sum, r) => sum + r.shifts_updated, 0)
            });
            
            return res.status(200).json({
                success: true,
                message: 'Job matches confirmed successfully',
                data: {
                    sync_id,
                    results: updateResults
                }
            });
            
        } catch (error) {
            logger.error('Error confirming job matches', {
                error: error.message,
                stack: error.stack,
                sync_id: req.body.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to confirm job matches',
                error: error.message
            });
        }
    }
    
    /**
     * Obtener shifts agregados por crew member y job
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getAggregatedShifts(req, res) {
        try {
            const { sync_id } = req.params;
            
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }
            
            // Obtener shifts aprobados (matched) con sus jobs
            const shifts = await BuilderTrendShift.findAll({
                where: {
                    sync_id,
                    match_status: 'matched',
                    matched_sync_job_id: { [require('sequelize').Op.ne]: null }
                },
                include: [
                    {
                        model: PerformanceSyncJob,
                        as: 'matchedSyncJob',
                        required: true,
                        attributes: ['id', 'job_name', 'row_number', 'crew_leader', 'estimator', 'finish_date']
                    }
                ],
                order: [['matched_sync_job_id', 'ASC'], ['crew_member_name', 'ASC']]
            });
            
            // Helper para detectar tipo de shift especial
            const { hasQCTag, hasDeliveryDropTag } = require('../utils/timeConverter');
            
            // Agrupar por job y crew member, SEPARANDO special shifts de regulares
            const aggregated = {};
            
            shifts.forEach(shift => {
                const jobId = shift.matched_sync_job_id;
                const crewMember = shift.crew_member_name;
                
                // Detectar si es QC o Delivery Drop desde tags
                // is_qc puede venir de la BD, pero Delivery Drop solo desde tags
                const isQC = shift.is_qc || hasQCTag(shift.tags || '');
                const isDeliveryDrop = hasDeliveryDropTag(shift.tags || '');
                const isSpecialShift = isQC || isDeliveryDrop;
                
                // Crear clave de agregación que INCLUYE el tipo de shift
                // Para special shifts, usar un nombre único y tipo separado
                // Para regulares, usar el nombre del crew member
                let aggregationKey;
                let displayName;
                
                if (isSpecialShift) {
                    // Special shifts se agrupan por tipo (QC o Delivery Drop), NO por crew member
                    if (isQC) {
                        aggregationKey = `${jobId}|QC_SPECIAL`;
                        displayName = 'QC Special Shift';
                    } else if (isDeliveryDrop) {
                        aggregationKey = `${jobId}|DELIVERY_DROP_SPECIAL`;
                        displayName = 'Job Delivery Special Shift';
                    } else {
                        // Fallback (no debería pasar)
                        aggregationKey = `${jobId}|SPECIAL|${crewMember}`;
                        displayName = 'Special Shift';
                    }
                } else {
                    // Regular shifts se agrupan por crew member
                    aggregationKey = `${jobId}|REGULAR|${crewMember}`;
                    displayName = crewMember;
                }
                
                if (!aggregated[aggregationKey]) {
                    aggregated[aggregationKey] = {
                        job_id: jobId,
                        job_name: shift.matchedSyncJob.job_name,
                        crew_member_name: displayName, // Nombre a mostrar
                        closing_date: shift.matchedSyncJob.finish_date, // Fecha de cierre del job (columna B del spreadsheet)
                        shifts_count: 0,
                        regular_hours: 0,
                        ot_hours: 0,
                        ot2_hours: 0,
                        total_hours: 0,
                        has_qc: false,
                        tags: []
                    };
                }
                
                aggregated[aggregationKey].shifts_count += 1;
                
                // Para QC shifts: cada shift cuenta como 3 horas fijas, sin importar las horas reales
                if (isQC) {
                    // No sumar horas reales, se calcularán al final multiplicando shifts_count * 3
                    aggregated[aggregationKey].has_qc = true;
                } else if (isDeliveryDrop) {
                    // Delivery Drop también tiene 3 horas fijas por shift
                    // No sumar horas reales aquí tampoco
                } else {
                    // Para shifts regulares, sumar las horas reales
                    aggregated[aggregationKey].regular_hours += parseFloat(shift.regular_hours || 0);
                    aggregated[aggregationKey].ot_hours += parseFloat(shift.ot_hours || 0);
                    aggregated[aggregationKey].ot2_hours += parseFloat(shift.ot2_hours || 0);
                    aggregated[aggregationKey].total_hours += parseFloat(shift.total_hours || 0);
                }
                
                if (shift.tags && shift.tags.trim() !== '') {
                    aggregated[aggregationKey].tags.push(shift.tags);
                }
            });
            
            // Convertir a array y calcular horas finales para QC/Delivery Drop
            const result = Object.values(aggregated).map(item => {
                // Si es QC o Delivery Drop, calcular horas como shifts_count * 3
                const isQC = item.has_qc || item.crew_member_name === 'QC Special Shift';
                const isDeliveryDrop = item.crew_member_name === 'Job Delivery Special Shift';
                
                if (isQC || isDeliveryDrop) {
                    // Cada shift QC/Delivery Drop es exactamente 3 horas
                    item.regular_hours = item.shifts_count * 3;
                    item.ot_hours = 0;
                    item.ot2_hours = 0;
                    item.total_hours = item.shifts_count * 3;
                }
                
                // Formatear closing_date como string YYYY-MM-DD para evitar problemas de timezone
                let closingDateStr = null;
                if (item.closing_date) {
                    try {
                        // Si viene como Date object, extraer componentes de fecha local
                        const dateObj = item.closing_date instanceof Date 
                            ? item.closing_date 
                            : new Date(item.closing_date);
                        
                        if (!isNaN(dateObj.getTime())) {
                            // Usar componentes de fecha local (no UTC)
                            const year = dateObj.getFullYear();
                            const month = String(dateObj.getMonth() + 1).padStart(2, '0');
                            const day = String(dateObj.getDate()).padStart(2, '0');
                            closingDateStr = `${year}-${month}-${day}`;
                            
                            logger.info('Formatting closing_date for frontend', {
                                job_name: item.job_name,
                                original_date: item.closing_date,
                                date_type: typeof item.closing_date,
                                formatted_date: closingDateStr,
                                local_components: { year, month, day }
                            });
                        }
                    } catch (error) {
                        logger.error('Error formatting closing_date', {
                            job_name: item.job_name,
                            closing_date: item.closing_date,
                            error: error.message
                        });
                    }
                }
                
                return {
                ...item,
                regular_hours: parseFloat(item.regular_hours.toFixed(2)),
                ot_hours: parseFloat(item.ot_hours.toFixed(2)),
                ot2_hours: parseFloat(item.ot2_hours.toFixed(2)),
                total_hours: parseFloat(item.total_hours.toFixed(2)),
                    closing_date: closingDateStr || item.closing_date, // Usar string formateado si está disponible
                tags: [...new Set(item.tags)].join(', ') // Unique tags
                };
            });
            
            logger.info('Retrieved aggregated shifts', {
                sync_id,
                total_entries: result.length
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    sync_id,
                    count: result.length,
                    aggregated_shifts: result
                }
            });
            
        } catch (error) {
            logger.error('Error retrieving aggregated shifts', {
                error: error.message,
                stack: error.stack,
                sync_id: req.params.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to retrieve aggregated shifts',
                error: error.message
            });
        }
    }

    /**
     * Enviar shifts procesados a Make.com para escribir en spreadsheet
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async sendShiftsToSpreadsheet(req, res) {
        try {
            const { sync_id, selected_job_names } = req.body;
            
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }
            
            logger.info('Preparing shifts data for spreadsheet write', { 
                sync_id,
                selected_job_names: selected_job_names || 'all'
            });
            
            // 1. Construir where clause base
            const whereClause = {
                sync_id,
                match_status: 'matched',
                matched_sync_job_id: { [require('sequelize').Op.ne]: null }
            };
            
            // 2. Si se especificaron job names, filtrar por ellos
            let jobIdsToInclude = null;
            if (selected_job_names && Array.isArray(selected_job_names) && selected_job_names.length > 0) {
                // Obtener los IDs de los jobs seleccionados por nombre
                const selectedJobs = await PerformanceSyncJob.findAll({
                    where: {
                        sync_id,
                        job_name: { [require('sequelize').Op.in]: selected_job_names }
                    },
                    attributes: ['id']
                });
                
                jobIdsToInclude = selectedJobs.map(j => j.id);
                
                if (jobIdsToInclude.length === 0) {
                    return res.status(404).json({
                        success: false,
                        message: 'No jobs found matching the selected names'
                    });
                }
                
                whereClause.matched_sync_job_id = { [require('sequelize').Op.in]: jobIdsToInclude };
                
                logger.info('Filtering by selected jobs', {
                    selected_count: selected_job_names.length,
                    job_ids: jobIdsToInclude
                });
            }
            
            // 3. Obtener shifts agregados con sus jobs
            const shifts = await BuilderTrendShift.findAll({
                where: whereClause,
                include: [
                    {
                        model: PerformanceSyncJob,
                        as: 'matchedSyncJob',
                        required: true,
                        attributes: ['id', 'job_name', 'row_number', 'branch_id']
                    }
                ],
                order: [['matched_sync_job_id', 'ASC'], ['crew_member_name', 'ASC']]
            });
            
            if (shifts.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: 'No matched shifts found for this sync_id'
                });
            }
            
            // 2. Agrupar shifts por job
            const jobsMap = {};
            
            shifts.forEach(shift => {
                const jobId = shift.matched_sync_job_id;
                
                if (!jobsMap[jobId]) {
                    jobsMap[jobId] = {
                        job_name: shift.matchedSyncJob.job_name,
                        row_number: shift.matchedSyncJob.row_number,
                        branch_id: shift.matchedSyncJob.branch_id,
                        crew_members: {}
                    };
                }
                
                const crewMember = shift.crew_member_name;
                
                if (!jobsMap[jobId].crew_members[crewMember]) {
                    jobsMap[jobId].crew_members[crewMember] = {
                        crew_member_name: crewMember,
                        shifts_count: 0,
                        regular_hours: 0,
                        ot_hours: 0,
                        ot2_hours: 0,
                        total_hours: 0,
                        has_qc: false
                    };
                }
                
                const member = jobsMap[jobId].crew_members[crewMember];
                member.shifts_count += 1;
                member.regular_hours += parseFloat(shift.regular_hours) || 0;
                member.ot_hours += parseFloat(shift.ot_hours) || 0;
                member.ot2_hours += parseFloat(shift.ot2_hours) || 0;
                member.total_hours += parseFloat(shift.total_hours) || 0;
                member.has_qc = member.has_qc || shift.has_qc;
            });
            
            // 3. Obtener branch info del primer job
            const firstJob = await PerformanceSyncJob.findOne({
                where: { sync_id },
                attributes: ['branch_id', 'branch_name', 'sheet_name']
            });
            
            if (!firstJob) {
                return res.status(404).json({
                    success: false,
                    message: 'Branch information not found'
                });
            }
            
            const branchName = firstJob.branch_name;
            const sheetName = firstJob.sheet_name;
            
            // 4. Obtener columnas de crew members del spreadsheet
            const SheetColumnMap = require('../models/SheetColumnMap');
            const crewColumns = await SheetColumnMap.findAll({
                where: {
                    sheet_name: sheetName,
                    type: 'crew_member'
                },
                order: [['column_index', 'ASC']]
            });
            
            if (crewColumns.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No crew member columns found in sheet_column_map for this branch'
                });
            }
            
            logger.info('Found crew member columns from spreadsheet', {
                sheet_name: sheetName,
                crew_columns_count: crewColumns.length,
                crew_names: crewColumns.map(c => c.field_name),
                first_column: crewColumns[0]?.field_name,
                last_column: crewColumns[crewColumns.length - 1]?.field_name
            });
            
            // 5. Función helper para convertir índice a letra de columna (A, B, ..., Z, AA, AB, ...)
            const getColumnLetter = (index) => {
                let letter = '';
                let num = index;
                while (num >= 0) {
                    letter = String.fromCharCode((num % 26) + 65) + letter;
                    num = Math.floor(num / 26) - 1;
                }
                return letter;
            };
            
            // 6. Crear mapa de crew members con sus columnas
            const crewColumnMap = {};
            crewColumns.forEach(col => {
                const columnLetter = getColumnLetter(col.column_index);
                crewColumnMap[col.field_name] = {
                    column_index: col.column_index,
                    column_letter: columnLetter,
                    spreadsheet_name: col.field_name
                };
            });
            
            // 7. Obtener TODAS las columnas del spreadsheet en orden para construir el array de valores
            const allColumns = await SheetColumnMap.findAll({
                where: { sheet_name: sheetName },
                order: [['column_index', 'ASC']]
            });
            
            logger.info('All spreadsheet columns loaded', {
                sheet_name: sheetName,
                total_columns: allColumns.length
            });
            
            // 8. Determinar el rango de columnas de crew members (primera y última)
            if (crewColumns.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No crew member columns found in spreadsheet'
                });
            }
            
            const firstCrewColumnIndex = Math.min(...crewColumns.map(c => c.column_index));
            const lastCrewColumnIndex = Math.max(...crewColumns.map(c => c.column_index));
            const firstCrewColumnLetter = getColumnLetter(firstCrewColumnIndex);
            const lastCrewColumnLetter = getColumnLetter(lastCrewColumnIndex);
            
            logger.info('Crew member columns range determined', {
                first_column: `${firstCrewColumnLetter} (${firstCrewColumnIndex})`,
                last_column: `${lastCrewColumnLetter} (${lastCrewColumnIndex})`,
                total_crew_columns: crewColumns.length
            });
            
            // 9. Hacer matching de crew members y construir arrays de valores para cada job
            const { findBestMatch } = require('../utils/jobMatcher');
            
            // Calcular el tamaño exacto del rango (número de columnas entre primera y última)
            const rangeSize = lastCrewColumnIndex - firstCrewColumnIndex + 1;
            
            logger.info('Range size calculated', {
                first_column_index: firstCrewColumnIndex,
                last_column_index: lastCrewColumnIndex,
                range_size: rangeSize,
                crew_columns_count: crewColumns.length
            });
            
            const jobsArray = Object.values(jobsMap).map(job => {
                // Crear un array con 0 para TODAS las columnas en el rango (no solo crew members)
                const rowValues = new Array(rangeSize).fill(0);
                let mappedCount = 0;
                let unmappedCount = 0;
                
                // Procesar cada crew member que trabajó en este job
                Object.values(job.crew_members).forEach(member => {
                    // Buscar columna del crew member en el spreadsheet
                    const crewCandidates = crewColumns.map(col => ({ job_name: col.field_name }));
                    const match = findBestMatch(member.crew_member_name, crewCandidates, 70);
                    
                    if (match && match.job_name) {
                        const columnInfo = crewColumnMap[match.job_name];
                        
                        if (columnInfo) {
                            // Calcular la posición en el array relativa al inicio del rango
                            const absoluteColumnIndex = columnInfo.column_index;
                            const relativePosition = absoluteColumnIndex - firstCrewColumnIndex;
                            
                            // Validar que la posición está dentro del rango
                            if (relativePosition >= 0 && relativePosition < rangeSize) {
                                // Asignar las horas totales (redondeadas a 2 decimales) en la posición correcta
                                const hours = parseFloat(member.total_hours) || 0;
                                rowValues[relativePosition] = Math.round(hours * 100) / 100;
                                mappedCount++;
                                
                                logger.info('✅ Crew member mapped', {
                                    job: job.job_name,
                                    buildertrend_name: member.crew_member_name,
                                    spreadsheet_name: match.job_name,
                                    column_letter: columnInfo.column_letter,
                                    column_index: absoluteColumnIndex,
                                    array_position: relativePosition,
                                    total_hours: member.total_hours,
                                    similarity: match.similarity_score
                                });
                            } else {
                                logger.warn('Column outside of range', {
                                    crew_member: member.crew_member_name,
                                    column_index: absoluteColumnIndex,
                                    relative_position: relativePosition,
                                    range_size: rangeSize
                                });
                                unmappedCount++;
                            }
                        } else {
                            unmappedCount++;
                        }
                    } else {
                        unmappedCount++;
                        logger.warn('⚠️ No column found for crew member', {
                            job: job.job_name,
                            crew_member: member.crew_member_name
                        });
                    }
                });
                
                // Construir el rango específico para esta fila (sin el nombre del sheet/tab, solo coordenadas)
                const range = `${firstCrewColumnLetter}${job.row_number}:${lastCrewColumnLetter}${job.row_number}`;
                
                // Limpiar y redondear todos los valores del array a 2 decimales
                const cleanedValues = rowValues.map(value => {
                    const num = parseFloat(value) || 0;
                    return Math.round(num * 100) / 100;
                });
                
                // Envolver en array de arrays para Google Sheets Bulk Update
                const rowsFormatted = [cleanedValues];
                
                logger.info('Row prepared for Google Sheets', {
                    job: job.job_name,
                    range: range,
                    array_length: cleanedValues.length,
                    expected_length: rangeSize,
                    match: cleanedValues.length === rangeSize ? '✅' : '❌',
                    rows_formatted_length: rowsFormatted.length
                });
                
                return {
                    job_name: job.job_name,
                    row_number: job.row_number,
                    range: range,
                    rows: rowsFormatted, // Array de arrays: [[0, 0, 12.32, ...]]
                    mapped_crew_count: mappedCount,
                    unmapped_crew_count: unmappedCount
                };
            });
            
            // 10. Enviar a Make.com
            const result = await makeWebhookService.sendPerformanceShiftsToSpreadsheet({
                syncId: sync_id,
                branchName,
                branchId: firstJob.branch_id,
                sheetName: sheetName,
                crewColumnsRange: `${firstCrewColumnLetter}:${lastCrewColumnLetter}`,
                jobs: jobsArray
            });
            
            if (result.success) {
                const mappedCrewMembers = jobsArray.reduce((sum, job) => sum + job.mapped_crew_count, 0);
                const unmappedCrewMembers = jobsArray.reduce((sum, job) => sum + job.unmapped_crew_count, 0);
                
                logger.info('Shifts data sent to Make.com successfully', {
                    sync_id,
                    jobs_count: jobsArray.length,
                    crew_columns_range: `${firstCrewColumnLetter}:${lastCrewColumnLetter}`,
                    mapped_crew_members: mappedCrewMembers,
                    unmapped_crew_members: unmappedCrewMembers
                });
                
                return res.status(200).json({
                    success: true,
                    message: 'Shifts data sent to Make.com for spreadsheet write',
                    data: {
                        sync_id,
                        branch: branchName,
                        sheet_name: sheetName,
                        jobs_count: jobsArray.length,
                        crew_columns_range: `${firstCrewColumnLetter}:${lastCrewColumnLetter}`,
                        mapped_crew_members: mappedCrewMembers,
                        unmapped_crew_members: unmappedCrewMembers
                    }
                });
            } else {
                return res.status(500).json({
                    success: false,
                    message: 'Failed to send data to Make.com',
                    error: result.message
                });
            }
            
        } catch (error) {
            logger.error('Error sending shifts to spreadsheet', {
                error: error.message,
                stack: error.stack,
                sync_id: req.body.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send shifts to spreadsheet',
                error: error.message
            });
        }
    }

    /**
     * Guardar datos de Performance permanentemente
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async savePerformanceDataPermanently(req, res) {
        try {
            const { sync_id, selected_job_names, auto_approve, modified_shifts } = req.body;
            
            if (!sync_id) {
                return res.status(400).json({
                    success: false,
                    message: 'sync_id is required'
                });
            }
            
            logger.info('Saving Performance data permanently', { 
                sync_id,
                selected_jobs_count: selected_job_names?.length || 'all',
                auto_approve: auto_approve || false,
                has_modified_shifts: !!modified_shifts
            });
            
            const performancePersistenceService = require('../services/performancePersistence.service');
            const result = await performancePersistenceService.savePerformanceDataPermanently(
                sync_id, 
                selected_job_names,
                auto_approve || false,
                modified_shifts || null
            );
            
            return res.status(200).json({
                success: true,
                message: 'Performance data saved permanently',
                data: result.data
            });
            
        } catch (error) {
            logger.error('Error saving Performance data permanently', {
                error: error.message,
                stack: error.stack,
                sync_id: req.body.sync_id
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to save Performance data permanently',
                error: error.message
            });
        }
    }

    /**
     * Helper function para parsear fechas
     * @param {string} dateStr - Fecha en formato string
     * @returns {Date|null}
     */
    parseDate(dateStr) {
        if (!dateStr) return null;
        
        try {
            // Intenta parsear diferentes formatos de fecha
            const date = new Date(dateStr);
            return isNaN(date.getTime()) ? null : date;
        } catch (e) {
            return null;
        }
    }

    /**
     * Helper function para parsear números
     * @param {any} value - Valor a convertir
     * @returns {number|null}
     */
    parseFloat(value) {
        if (!value) return null;
        
        try {
            const num = parseFloat(value);
            return isNaN(num) ? null : num;
        } catch (e) {
            return null;
        }
    }

    /**
     * Obtener jobs y shifts pendientes de aprobación
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async getPendingApproval(req, res) {
        try {
            const { branch_id } = req.query;
            
            const { Job, Shift, Employee, Branch, JobStatus, Estimate, SalesPerson, JobSpecialShift, SpecialShift } = require('../models');
            
            // Construir filtro - Solo jobs pendientes de aprobación
            // NO mostrar jobs 'synced' (ya aprobados) ni 'approved' (ya procesados)
            const whereClause = {
                performance_status: 'pending_approval'
            };
            
            if (branch_id) {
                whereClause.branch_id = parseInt(branch_id);
            }
            
            logger.info('Fetching pending approval jobs', {
                branch_id: branch_id || 'all',
                whereClause
            });
            
            // Obtener jobs pendientes con sus shifts
            const pendingJobs = await Job.findAll({
                where: whereClause,
                include: [
                    {
                        model: Branch,
                        as: 'branch',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Employee,
                        as: 'crewLeader',
                        attributes: ['id', 'first_name', 'last_name', 'email']
                    },
                    {
                        model: JobStatus,
                        as: 'status',
                        attributes: ['id', 'name']
                    },
                    {
                        model: Estimate,
                        as: 'estimate',
                        attributes: ['id', 'name'],
                        include: [
                            {
                                model: SalesPerson,
                                as: 'salesperson',
                                attributes: ['id', 'name']
                            }
                        ]
                    },
                    {
                        model: Shift,
                        as: 'shifts',
                        where: {
                            performance_status: 'pending_approval'
                        },
                        required: false,
                        include: [
                            {
                                model: Employee,
                                as: 'employee',
                                attributes: ['id', 'first_name', 'last_name']
                            }
                        ]
                    },
                    {
                        model: JobSpecialShift,
                        as: 'jobSpecialShifts',
                        required: false,
                        include: [
                            {
                                model: SpecialShift,
                                as: 'specialShift',
                                attributes: ['id', 'name']
                            }
                        ]
                    }
                ],
                order: [
                    ['closing_date', 'DESC'],
                    ['name', 'ASC']
                ]
            });
            
            logger.info('Pending approval jobs found', {
                count: pendingJobs.length
            });
            
            // Formatear respuesta
            const formattedJobs = pendingJobs.map(job => {
                const shifts = job.shifts || [];
                const specialShifts = job.jobSpecialShifts || [];
                
                const totalHours = shifts.reduce((sum, shift) => sum + parseFloat(shift.hours || 0), 0);
                const specialShiftsHours = specialShifts.reduce((sum, ss) => sum + parseFloat(ss.hours || 0), 0);
                const crewCount = new Set(shifts.map(s => s.employee_id)).size;
                
                return {
                    id: job.id,
                    name: job.name,
                    closing_date: job.closing_date,
                    sold_price: job.sold_price,
                    branch: job.branch ? {
                        id: job.branch.id,
                        name: job.branch.name
                    } : null,
                    crew_leader: job.crewLeader ? {
                        id: job.crewLeader.id,
                        name: `${job.crewLeader.first_name} ${job.crewLeader.last_name}`
                    } : null,
                    status: job.status ? {
                        id: job.status.id,
                        name: job.status.name
                    } : null,
                    estimator: job.estimate?.salesperson?.name || null,
                    shifts_count: shifts.length,
                    total_hours: totalHours + specialShiftsHours,
                    crew_count: crewCount,
                    shifts: [
                        ...shifts.map(shift => ({
                            type: 'regular',
                            crew_member_id: shift.crew_member_id,
                            employee_id: shift.employee_id,
                            employee_name: shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : 'Unknown',
                            hours: parseFloat(shift.hours),
                            performance_status: shift.performance_status
                        })),
                        ...specialShifts.map(ss => ({
                            type: 'special',
                            special_shift_id: ss.special_shift_id,
                            special_shift_name: ss.specialShift ? ss.specialShift.name : 'Unknown',
                            hours: parseFloat(ss.hours),
                            approved: ss.approved_shift,
                            performance_status: 'approved'
                        }))
                    ]
                };
            });
            
            return res.status(200).json({
                success: true,
                data: {
                    jobs: formattedJobs,
                    total_jobs: formattedJobs.length,
                    total_shifts: formattedJobs.reduce((sum, job) => sum + job.shifts_count, 0)
                }
            });
            
        } catch (error) {
            logger.error('Error getting pending approval jobs', {
                error: error.message,
                stack: error.stack
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to get pending approval jobs',
                error: error.message
            });
        }
    }

    /**
     * Aprobar jobs y sus shifts
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async approveJobs(req, res) {
        try {
            const { job_ids } = req.body;
            
            if (!job_ids || !Array.isArray(job_ids) || job_ids.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'job_ids array is required'
                });
            }
            
            const Job = require('../models/Job');
            const Shift = require('../models/Shift');
            const JobSpecialShift = require('../models/JobSpecialShift');
            const sequelize = require('../config/database');
            
            const transaction = await sequelize.transaction();
            
            try {
                // Actualizar jobs a 'synced' (ya están en el sistema permanentemente)
                const [jobsUpdated] = await Job.update(
                    { performance_status: 'synced' },
                    {
                        where: {
                            id: job_ids,
                            performance_status: 'pending_approval'
                        },
                        transaction
                    }
                );
                
                // Actualizar shifts a 'approved' y marcar como approved_shift
                // Incluir shifts que ya están en 'approved' pero con approved_shift: false
                const [shiftsUpdated] = await Shift.update(
                    { 
                        performance_status: 'approved',
                        approved_shift: true
                    },
                    {
                        where: {
                            job_id: job_ids,
                            [Op.or]: [
                                { performance_status: 'pending_approval' },
                                { approved_shift: false }
                            ]
                        },
                        transaction
                    }
                );
                
                // Actualizar special shifts (QC) a approved
                const [specialShiftsUpdated] = await JobSpecialShift.update(
                    { approved_shift: true },
                    {
                        where: {
                            job_id: job_ids,
                            approved_shift: false
                        },
                        transaction
                    }
                );
                
                await transaction.commit();
                
                // =====================================================
                // DESPUÉS DEL COMMIT: Verificar si cada job debe actualizarse a "Closed Job"
                // =====================================================
                let jobsUpdatedToClosedCount = 0;
                const JobStatus = require('../models/JobStatus');
                const closedJobsForOverrunAlert = []; // Acumular jobs cerrados para enviar alert en batch
                
                for (const jobId of job_ids) {
                    try {
                        // Contar shifts regulares pendientes
                        const pendingRegularShifts = await Shift.count({
                            where: {
                                job_id: jobId,
                                approved_shift: false
                            }
                        });

                        // Contar special shifts pendientes
                        const pendingSpecialShifts = await JobSpecialShift.count({
                            where: {
                                job_id: jobId,
                                approved_shift: false
                            }
                        });

                        // Si NO hay shifts pendientes, actualizar el job a "Closed Job" y marcar como "In Payload"
                        if (pendingRegularShifts === 0 && pendingSpecialShifts === 0) {
                            // Obtener el ID del estado "Closed Job"
                            const closedJobStatus = await JobStatus.findOne({
                                where: { name: 'Closed Job' }
                            });

                            if (closedJobStatus) {
                                const job = await Job.findByPk(jobId);
                                
                                if (job) {
                                    const updateData = {};
                                    let jobsUpdatedToClosed = false;
                                    
                                    // Si el job no está ya en "Closed Job", actualizar el status
                                    if (job.status_id !== closedJobStatus.id) {
                                        updateData.status_id = closedJobStatus.id;
                                        updateData.closing_date = job.closing_date || new Date(); // Mantener closing_date existente o asignar ahora
                                        jobsUpdatedToClosed = true;
                                    }
                                    
                                    // IMPORTANTE: Siempre marcar como "In Payload" cuando todos los shifts están aprobados
                                    // Incluso si el job ya estaba en "Closed Job"
                                    if (!job.in_payload) {
                                        updateData.in_payload = true;
                                    }
                                    
                                    // Solo actualizar si hay cambios
                                    if (Object.keys(updateData).length > 0) {
                                        await job.update(updateData);
                                        
                                        if (jobsUpdatedToClosed) {
                                    jobsUpdatedToClosedCount++;
                                        }
                                    
                                        logger.info(`✅ Job marked as "In Payload" after all shifts approved`, {
                                        job_id: jobId,
                                        job_name: job.name,
                                            status_changed: jobsUpdatedToClosed,
                                        previous_status_id: job.status_id,
                                            new_status_id: jobsUpdatedToClosed ? closedJobStatus.id : job.status_id,
                                        in_payload: true
                                    });
                                        
                                        // Acumular job para enviar alert en batch al final
                                        closedJobsForOverrunAlert.push(jobId);
                                    } else {
                                        // Si no hubo cambios pero el job ya está cerrado, también verificar overrun
                                        closedJobsForOverrunAlert.push(jobId);
                                    }
                                }
                            }
                        }
                    } catch (error) {
                        logger.error(`❌ Error updating job status for job_id ${jobId}:`, {
                            error: error.message,
                            job_id: jobId
                        });
                        // No lanzar error, continuar con otros jobs
                    }
                }
                
                // Enviar alert automático de overrun en batch para todos los jobs cerrados
                if (closedJobsForOverrunAlert.length > 0) {
                    try {
                        const alertResult = await sendBulkAutomaticOverrunAlerts(closedJobsForOverrunAlert);
                        if (alertResult.sent > 0) {
                            logger.info(`✅ Automatic overrun alerts sent in batch`, {
                                jobs_sent: alertResult.sent,
                                total_jobs_checked: alertResult.total,
                                job_ids: alertResult.jobs.map(j => j.job_id)
                            });
                        } else {
                            logger.info(`ℹ️  No overrun jobs found to send automatic alerts`, {
                                total_jobs_checked: alertResult.total
                            });
                        }
                    } catch (alertError) {
                        // No fallar la aprobación si el alert falla
                        logger.error(`Error sending bulk automatic overrun alerts`, {
                            error: alertError.message,
                            job_ids: closedJobsForOverrunAlert
                        });
                    }
                }
                
                logger.info('Jobs, shifts and special shifts approved', {
                    job_ids,
                    jobs_updated: jobsUpdated,
                    shifts_updated: shiftsUpdated,
                    special_shifts_updated: specialShiftsUpdated,
                    jobs_updated_to_closed: jobsUpdatedToClosedCount
                });
                
                return res.status(200).json({
                    success: true,
                    message: `Jobs, shifts and special shifts approved successfully. ${jobsUpdatedToClosedCount} job(s) updated to "Closed Job" status.`,
                    data: {
                        jobs_updated: jobsUpdated,
                        shifts_updated: shiftsUpdated,
                        special_shifts_updated: specialShiftsUpdated,
                        jobs_updated_to_closed: jobsUpdatedToClosedCount
                    }
                });
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
            
        } catch (error) {
            logger.error('Error approving jobs', {
                error: error.message,
                stack: error.stack,
                job_ids: req.body.job_ids
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to approve jobs',
                error: error.message
            });
        }
    }

    /**
     * Rechazar shifts específicos
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async rejectShifts(req, res) {
        try {
            const { shifts } = req.body;
            
            if (!shifts || !Array.isArray(shifts) || shifts.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'shifts array is required with format: [{ crew_member_id, job_id }]'
                });
            }
            
            const Shift = require('../models/Shift');
            const sequelize = require('../config/database');
            const { Op } = require('sequelize');
            
            const transaction = await sequelize.transaction();
            
            try {
                let totalRejected = 0;
                
                for (const shift of shifts) {
                    const { crew_member_id, job_id } = shift;
                    
                    if (!crew_member_id || !job_id) {
                        logger.warn('Invalid shift data', { shift });
                        continue;
                    }
                    
                    const [updated] = await Shift.update(
                        { performance_status: 'rejected' },
                        {
                            where: {
                                crew_member_id,
                                job_id,
                                performance_status: 'pending_approval'
                            },
                            transaction
                        }
                    );
                    
                    totalRejected += updated;
                }
                
                await transaction.commit();
                
                logger.info('Shifts rejected', {
                    shifts_rejected: totalRejected,
                    total_requested: shifts.length
                });
                
                return res.status(200).json({
                    success: true,
                    message: 'Shifts rejected successfully',
                    data: {
                        shifts_rejected: totalRejected
                    }
                });
                
            } catch (error) {
                await transaction.rollback();
                throw error;
            }
            
        } catch (error) {
            logger.error('Error rejecting shifts', {
                error: error.message,
                stack: error.stack
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to reject shifts',
                error: error.message
            });
        }
    }
}

module.exports = new PerformanceController();

