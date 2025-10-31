/**
 * Servicio para parsear Excel de BuilderTrend (Time Clock Report)
 */

const xlsx = require('xlsx');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');
const { calculateShiftTotals, hasQCTag, hasDeliveryDropTag } = require('../utils/timeConverter');
const { matchShiftsToJobs } = require('../utils/jobMatcher');
const BuilderTrendShift = require('../models/BuilderTrendShift');
const PerformanceSyncJob = require('../models/PerformanceSyncJob');

/**
 * Parsea un archivo Excel de BuilderTrend y extrae los shifts
 * @param {Buffer} fileBuffer - Buffer del archivo Excel
 * @param {string} syncId - UUID del sync al que pertenecen estos shifts
 * @returns {Object} - { uploadId, shifts, stats }
 */
async function parseBuilderTrendExcel(fileBuffer, syncId) {
    try {
        // Leer el archivo Excel
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        
        // Obtener la primera hoja
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Convertir a JSON (header en fila 2, típicamente)
        const jsonData = xlsx.utils.sheet_to_json(worksheet, { 
            header: 1,
            defval: '',
            blankrows: false
        });
        
        if (jsonData.length < 2) {
            throw new Error('Excel file has insufficient data');
        }
        
        // Identificar las columnas (fila 2 es el header normalmente)
        const headerRowIndex = findHeaderRow(jsonData);
        const headers = jsonData[headerRowIndex];
        
        logger.info('Excel headers detected', { headers, headerRowIndex });
        
        // Mapear índices de columnas
        const columnMap = mapColumns(headers);
        
        // Parsear las filas de datos
        const rawShifts = [];
        for (let i = headerRowIndex + 1; i < jsonData.length; i++) {
            const row = jsonData[i];
            
            // Verificar que la fila tenga datos
            if (!row || row.length === 0 || !row[columnMap.Job]) {
                continue;
            }
            
            const shift = {
                excel_row_number: i + 1, // 1-based row number
                date: parseExcelDate(row[columnMap.Date]),
                job_name_raw: String(row[columnMap.Job] || '').trim(),
                crew_member_name: String(row[columnMap.Name] || '').trim(),
                tags: String(row[columnMap.Tags] || '').trim(),
                regular_time_raw: String(row[columnMap['Regular Time']] || '').trim(),
                ot_raw: String(row[columnMap.OT] || '').trim(),
                ot2_raw: String(row[columnMap['2OT']] || '').trim(),
                pto_raw: String(row[columnMap.PTO] || '').trim(),
                total_work_time_raw: String(row[columnMap['Total Work Time']] || '').trim(),
                notes: String(row[columnMap.Notes] || '').trim()
            };
            
            // Debug: Log first shift to see what's being parsed
            if (i === headerRowIndex + 1) {
                logger.info('🔍 FIRST SHIFT PARSED (DEBUG)', {
                    excel_row: i + 1,
                    columnMap: columnMap,
                    raw_row: row,
                    parsed_shift: shift
                });
            }
            
            // Skip if job name is empty or is a header-like value
            if (!shift.job_name_raw || shift.job_name_raw.toLowerCase() === 'job') {
                continue;
            }
            
            // Calcular horas decimales
            const totals = calculateShiftTotals(shift);
            shift.regular_hours = totals.regular_hours;
            shift.ot_hours = totals.ot_hours;
            shift.ot2_hours = totals.ot2_hours;
            shift.pto_hours = totals.pto_hours;
            shift.total_hours = totals.total_hours;
            
            // Detectar QC
            shift.is_qc = hasQCTag(shift.tags);
            
            // Detectar Delivery Drop
            shift.is_delivery_drop = hasDeliveryDropTag(shift.tags);
            
            // Log detallado para debugging QC
            if (shift.is_qc) {
                logger.info('🔍 QC TAG DETECTED IN EXCEL', {
                    crew_member: shift.crew_member_name,
                    job: shift.job_name_raw,
                    tags: shift.tags,
                    is_qc: shift.is_qc
                });
            }
            
            // Log detallado para debugging Delivery Drop
            if (shift.is_delivery_drop) {
                logger.info('📦 DELIVERY DROP TAG DETECTED IN EXCEL', {
                    crew_member: shift.crew_member_name,
                    job: shift.job_name_raw,
                    tags: shift.tags,
                    is_delivery_drop: shift.is_delivery_drop
                });
            }
            
            rawShifts.push(shift);
        }
        
        logger.info('Parsed raw shifts from Excel', {
            syncId,
            totalRows: jsonData.length,
            shiftsExtracted: rawShifts.length
        });
        
        if (rawShifts.length === 0) {
            throw new Error('No valid shifts found in Excel file');
        }
        
        return {
            rawShifts,
            columnMap,
            totalRows: jsonData.length
        };
        
    } catch (error) {
        logger.error('Error parsing BuilderTrend Excel', {
            syncId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Encuentra la fila del header en el Excel
 * @param {Array} jsonData - Datos del Excel en formato JSON
 * @returns {number} - Índice de la fila del header
 */
function findHeaderRow(jsonData) {
    for (let i = 0; i < Math.min(5, jsonData.length); i++) {
        const row = jsonData[i];
        if (row && row.length > 0) {
            const firstCell = String(row[0]).toLowerCase();
            // Buscar fila que contenga "date" o similar
            if (firstCell.includes('date') || firstCell.includes('day')) {
                return i;
            }
        }
    }
    // Por defecto, asumir fila 1 (índice 0 es el título)
    return 1;
}

/**
 * Mapea las columnas del Excel a sus índices
 * @param {Array} headers - Fila de headers
 * @returns {Object} - Mapa de columna -> índice
 */
function mapColumns(headers) {
    const columnMap = {};
    
    headers.forEach((header, index) => {
        const normalizedHeader = String(header).trim();
        columnMap[normalizedHeader] = index;
    });
    
    logger.info('Column mapping', { columnMap });
    
    return columnMap;
}

/**
 * Parsea una fecha de Excel (puede venir como número serial o string)
 * @param {any} excelDate - Valor de fecha del Excel
 * @returns {Date|null} - Fecha parseada o null
 */
function parseExcelDate(excelDate) {
    if (!excelDate) return null;
    
    try {
        // Si es un número (serial de Excel)
        if (typeof excelDate === 'number') {
            const date = xlsx.SSF.parse_date_code(excelDate);
            return new Date(date.y, date.m - 1, date.d);
        }
        
        // Si es un string, intentar parsearlo
        if (typeof excelDate === 'string') {
            const parsed = new Date(excelDate);
            return isNaN(parsed.getTime()) ? null : parsed;
        }
        
        return null;
    } catch (error) {
        logger.warn('Failed to parse Excel date', { excelDate });
        return null;
    }
}

/**
 * Procesa shifts del Excel y los agrupa por job name
 * NO hace matching automático - eso lo hace el usuario en el modal
 * @param {Array} rawShifts - Shifts parseados del Excel
 * @param {string} syncId - UUID del sync
 * @param {string} uploadId - UUID del upload
 * @returns {Object} - Resultado del procesamiento con jobs agrupados
 */
async function processAndSaveShifts(rawShifts, syncId, uploadId) {
    try {
        // PASO 1: Agrupar shifts por job name (tal como vienen del Excel)
        const shiftsGroupedByJob = {};
        const uniqueJobNames = [];
        
        rawShifts.forEach(shift => {
            const jobName = shift.job_name_raw;
            
            if (!shiftsGroupedByJob[jobName]) {
                shiftsGroupedByJob[jobName] = [];
                uniqueJobNames.push(jobName);
            }
            
            shiftsGroupedByJob[jobName].push(shift);
        });
        
        logger.info('Shifts grouped by job', {
            syncId,
            uniqueJobs: uniqueJobNames.length,
            totalShifts: rawShifts.length,
            jobNames: uniqueJobNames
        });
        
        // PASO 2: Guardar todos los shifts SIN matching (pending)
        const shiftsToInsert = rawShifts.map(shift => ({
            ...shift,
            sync_id: syncId,
            upload_id: uploadId,
            matched_sync_job_id: null, // Sin match hasta que usuario confirme
            match_confidence: 0,
            similarity_score: 0,
            needs_human_review: true, // Todos requieren revisión manual
            match_status: 'pending',
            processed_at: null // No procesado hasta confirmación
        }));
        
        // Insertar en batch
        const createdShifts = await BuilderTrendShift.bulkCreate(shiftsToInsert);
        
        // PASO 3: Obtener los jobs del spreadsheet para hacer matching
        const syncJobs = await PerformanceSyncJob.findAll({
            where: { sync_id: syncId }
        });
        
        logger.info('Sync jobs retrieved for matching', {
            syncId,
            syncJobsCount: syncJobs.length
        });
        
        // PASO 4: INVERTIR LÓGICA - Partir de Spreadsheet jobs (fuente de verdad)
        const { findBestMatch } = require('../utils/jobMatcher');
        
        // Crear lista de jobs del Excel para buscar matches
        const excelJobsList = uniqueJobNames.map(jobName => ({
            job_name: jobName,
            shifts: shiftsGroupedByJob[jobName]
        }));
        
        // Para cada job del SPREADSHEET, buscar su match en el EXCEL
        const spreadsheetJobsWithMatches = syncJobs.map(syncJob => {
            // Buscar el mejor match en los jobs del Excel
            const suggestedMatch = findBestMatch(syncJob.job_name, excelJobsList, 80); // 80% mínimo
            
            let shiftsCount = 0;
            let totalHours = 0;
            let crewMembers = 0;
            
            if (suggestedMatch) {
                const matchedShifts = shiftsGroupedByJob[suggestedMatch.job_name];
                shiftsCount = matchedShifts.length;
                totalHours = matchedShifts.reduce((sum, s) => sum + (s.total_hours || 0), 0);
                crewMembers = [...new Set(matchedShifts.map(s => s.crew_member_name))].length;
            }
            
            return {
                job_name_excel: suggestedMatch?.job_name || null, // Nombre del Excel matched (o null)
                shifts_count: shiftsCount,
                total_hours: totalHours,
                crew_members: crewMembers,
                suggested_match_id: syncJob.id, // ID del job del spreadsheet (fuente de verdad)
                suggested_match_name: syncJob.job_name, // Nombre del spreadsheet
                similarity_score: suggestedMatch?.similarity_score || 0
            };
        });
        
        // TODOS los jobs del spreadsheet se devuelven (con o sin match)
        const excelJobs = spreadsheetJobsWithMatches;
        
        logger.info('📊 RESUMEN FINAL (Spreadsheet → Excel):', {
            totalSpreadsheetJobs: syncJobs.length,
            jobsConMatch: excelJobs.filter(j => j.job_name_excel !== null).length,
            jobsSinMatch: excelJobs.filter(j => j.job_name_excel === null).length,
            matchesDetalle: excelJobs.map(j => ({
                spreadsheet: j.suggested_match_name,
                excel: j.job_name_excel || 'NO MATCH',
                score: j.similarity_score,
                id: j.suggested_match_id
            }))
        });
        
        return {
            success: true,
            uploadId,
            totalShifts: createdShifts.length,
            excel_jobs: excelJobs // Jobs del Excel con matches sugeridos
        };
        
    } catch (error) {
        logger.error('Error processing shifts', {
            syncId,
            uploadId,
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

module.exports = {
    parseBuilderTrendExcel,
    processAndSaveShifts
};

