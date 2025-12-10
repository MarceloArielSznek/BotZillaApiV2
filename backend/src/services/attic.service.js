/**
 * Servicio para consultar la base de datos de Attic/BuilderTrend (MS SQL Server)
 * Proporciona métodos para obtener shifts, jobs y revenue data
 */

const { executeQuery, sql } = require('../config/mssql');
const { logger } = require('../utils/logger');

class AtticService {
    /**
     * Obtener shifts de una fecha específica
     * @param {Date} date - Fecha a consultar
     * @param {number|null} branchId - ID del branch (opcional)
     * @returns {Promise<Array>}
     */
    async getShiftsByDate(date, branchId = null) {
        try {
            // Formatear fecha como YYYY-MM-DD
            const dateStr = date.toISOString().split('T')[0];
            
            let query = `
                SELECT 
                    b.branch_id,
                    b.branch_desc,
                    b.branch_short_name,
                    j.job_gk,
                    j.job_name,
                    j.job_id,
                    j.job_status,
                    t.name AS employee_name,
                    t.report_date,
                    t.clocked_in_at,
                    t.clocked_out_at,
                    t.regular_time,
                    t.minutes_overtime,
                    t.minutes_double_overtime,
                    t.Actual_Reg_Hrs,
                    t.Actual_OT_Hrs,
                    t.Actual_double_OT_Hrs,
                    (t.regular_time + ISNULL(t.minutes_overtime, 0)) AS total_minutes,
                    (t.regular_time + ISNULL(t.minutes_overtime, 0)) / 60.0 AS total_hours
                FROM dbo.fact_time_clock AS t
                INNER JOIN dbo.dim_attic_branch AS b
                    ON t.branch_id = b.branch_id
                LEFT JOIN dbo.dim_jobsite AS j
                    ON t.job_gk = j.job_gk
                WHERE 
                    CAST(t.report_date AS date) = @date
            `;
            
            const params = { date: dateStr };
            
            // Filtrar por branch si se especifica
            if (branchId) {
                query += ` AND t.branch_id = @branchId`;
                params.branchId = branchId;
            }
            
            query += `
                ORDER BY 
                    b.branch_desc ASC,
                    j.job_name ASC,
                    t.name ASC
            `;
            
            logger.info('Fetching shifts from Attic DB', { 
                date: dateStr, 
                branchId: branchId || 'all' 
            });
            
            const result = await executeQuery(query, params);
            
            logger.info('Shifts fetched successfully', { 
                count: result.recordset.length,
                date: dateStr
            });
            
            return result.recordset;
            
        } catch (error) {
            logger.error('Error fetching shifts from Attic DB', {
                error: error.message,
                stack: error.stack,
                date,
                branchId
            });
            throw error;
        }
    }
    
    /**
     * Obtener shifts en un rango de fechas
     * @param {Date} fromDate - Fecha inicial
     * @param {Date} toDate - Fecha final
     * @param {number|null} branchId - ID del branch (opcional)
     * @returns {Promise<Array>}
     */
    async getShiftsByDateRange(fromDate, toDate, branchId = null) {
        try {
            const fromDateStr = fromDate.toISOString().split('T')[0];
            const toDateStr = toDate.toISOString().split('T')[0];
            
            let query = `
                SELECT 
                    b.branch_id,
                    b.branch_desc,
                    b.branch_short_name,
                    j.job_gk,
                    j.job_name,
                    j.job_id,
                    j.job_status,
                    t.name AS employee_name,
                    t.report_date,
                    t.clocked_in_at,
                    t.clocked_out_at,
                    t.regular_time,
                    t.minutes_overtime,
                    t.minutes_double_overtime,
                    t.Actual_Reg_Hrs,
                    t.Actual_OT_Hrs,
                    t.Actual_double_OT_Hrs,
                    (t.regular_time + ISNULL(t.minutes_overtime, 0)) AS total_minutes,
                    (t.regular_time + ISNULL(t.minutes_overtime, 0)) / 60.0 AS total_hours
                FROM dbo.fact_time_clock AS t
                INNER JOIN dbo.dim_attic_branch AS b
                    ON t.branch_id = b.branch_id
                LEFT JOIN dbo.dim_jobsite AS j
                    ON t.job_gk = j.job_gk
                WHERE 
                    CAST(t.report_date AS date) >= @fromDate
                    AND CAST(t.report_date AS date) <= @toDate
            `;
            
            const params = { fromDate: fromDateStr, toDate: toDateStr };
            
            if (branchId) {
                query += ` AND t.branch_id = @branchId`;
                params.branchId = branchId;
            }
            
            query += `
                ORDER BY 
                    t.report_date DESC,
                    b.branch_desc ASC,
                    j.job_name ASC,
                    t.name ASC
            `;
            
            logger.info('Fetching shifts by date range from Attic DB', { 
                fromDate: fromDateStr, 
                toDate: toDateStr,
                branchId: branchId || 'all'
            });
            
            const result = await executeQuery(query, params);
            
            logger.info('Shifts fetched successfully', { 
                count: result.recordset.length,
                fromDate: fromDateStr,
                toDate: toDateStr
            });
            
            return result.recordset;
            
        } catch (error) {
            logger.error('Error fetching shifts by date range from Attic DB', {
                error: error.message,
                stack: error.stack,
                fromDate,
                toDate,
                branchId
            });
            throw error;
        }
    }
    
    /**
     * Obtener jobs cerrados en un rango de fechas (basado en paid_date)
     * @param {Date} fromDate - Fecha inicial
     * @param {Date} toDate - Fecha final
     * @param {number|null} branchId - ID del branch (opcional)
     * @returns {Promise<Array>}
     */
    async getClosedJobsByDateRange(fromDate, toDate, branchId = null) {
        try {
            const fromDateStr = fromDate.toISOString().split('T')[0];
            const toDateStr = toDate.toISOString().split('T')[0];
            
            let query = `
                SELECT
                    b.branch_desc,
                    b.branch_short_name,
                    j.branch_id,
                    j.job_gk,
                    j.job_id,
                    j.job_name,
                    j.job_status,
                    j.date_opened,
                    SUM(i.total_with_tax) AS job_total_with_tax,
                    MAX(i.paid_date) AS last_paid_date
                FROM dbo.dim_jobsite AS j
                INNER JOIN dbo.fact_invoice_items AS i
                    ON j.job_gk = i.job_gk
                INNER JOIN dbo.dim_attic_branch AS b
                    ON j.branch_id = b.branch_id
                WHERE
                    j.job_status = 'Closed'
                    AND CAST(i.paid_date AS date) >= @fromDate
                    AND CAST(i.paid_date AS date) <= @toDate
            `;
            
            const params = { fromDate: fromDateStr, toDate: toDateStr };
            
            if (branchId) {
                query += ` AND j.branch_id = @branchId`;
                params.branchId = branchId;
            }
            
            query += `
                GROUP BY
                    b.branch_desc,
                    b.branch_short_name,
                    j.branch_id,
                    j.job_gk,
                    j.job_id,
                    j.job_name,
                    j.job_status,
                    j.date_opened
                ORDER BY
                    b.branch_desc,
                    last_paid_date DESC,
                    j.job_name
            `;
            
            logger.info('Fetching closed jobs from Attic DB', { 
                fromDate: fromDateStr, 
                toDate: toDateStr,
                branchId: branchId || 'all'
            });
            
            const result = await executeQuery(query, params);
            
            logger.info('Closed jobs fetched successfully', { 
                count: result.recordset.length,
                fromDate: fromDateStr,
                toDate: toDateStr
            });
            
            return result.recordset;
            
        } catch (error) {
            logger.error('Error fetching closed jobs from Attic DB', {
                error: error.message,
                stack: error.stack,
                fromDate,
                toDate,
                branchId
            });
            throw error;
        }
    }
    
    /**
     * Obtener todos los branches de Attic
     * @returns {Promise<Array>}
     */
    async getBranches() {
        try {
            const query = `
                SELECT 
                    branch_id,
                    branch_desc,
                    branch_short_name,
                    Sort_order
                FROM dbo.dim_attic_branch
                ORDER BY Sort_order ASC, branch_desc ASC
            `;
            
            logger.info('Fetching branches from Attic DB');
            
            const result = await executeQuery(query);
            
            logger.info('Branches fetched successfully', { 
                count: result.recordset.length
            });
            
            return result.recordset;
            
        } catch (error) {
            logger.error('Error fetching branches from Attic DB', {
                error: error.message,
                stack: error.stack
            });
            throw error;
        }
    }
    
    /**
     * Obtener información de un job específico por job_gk
     * @param {number} jobGk - Job global key
     * @returns {Promise<Object|null>}
     */
    async getJobByGk(jobGk) {
        try {
            const query = `
                SELECT 
                    j.job_gk,
                    j.job_id,
                    j.job_name,
                    j.job_status,
                    j.branch_id,
                    j.date_opened,
                    j.street,
                    j.city,
                    j.state,
                    j.zip,
                    b.branch_desc,
                    b.branch_short_name
                FROM dbo.dim_jobsite AS j
                INNER JOIN dbo.dim_attic_branch AS b
                    ON j.branch_id = b.branch_id
                WHERE j.job_gk = @jobGk
            `;
            
            const result = await executeQuery(query, { jobGk });
            
            return result.recordset.length > 0 ? result.recordset[0] : null;
            
        } catch (error) {
            logger.error('Error fetching job by GK from Attic DB', {
                error: error.message,
                jobGk
            });
            throw error;
        }
    }
    
    /**
     * Buscar job por nombre (fuzzy search)
     * @param {string} jobName - Nombre del job
     * @param {number|null} branchId - ID del branch (opcional)
     * @returns {Promise<Array>}
     */
    async searchJobsByName(jobName, branchId = null) {
        try {
            let query = `
                SELECT 
                    j.job_gk,
                    j.job_id,
                    j.job_name,
                    j.job_status,
                    j.branch_id,
                    j.date_opened,
                    b.branch_desc,
                    b.branch_short_name
                FROM dbo.dim_jobsite AS j
                INNER JOIN dbo.dim_attic_branch AS b
                    ON j.branch_id = b.branch_id
                WHERE j.job_name LIKE @jobName
            `;
            
            const params = { jobName: `%${jobName}%` };
            
            if (branchId) {
                query += ` AND j.branch_id = @branchId`;
                params.branchId = branchId;
            }
            
            query += `
                ORDER BY j.job_name ASC
            `;
            
            const result = await executeQuery(query, params);
            
            return result.recordset;
            
        } catch (error) {
            logger.error('Error searching jobs by name from Attic DB', {
                error: error.message,
                jobName,
                branchId
            });
            throw error;
        }
    }
}

module.exports = new AtticService();

