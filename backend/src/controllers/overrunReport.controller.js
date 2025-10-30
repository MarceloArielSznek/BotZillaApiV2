const { logger } = require('../utils/logger');
const axios = require('axios');

class OverrunReportController {
    /**
     * Enviar múltiples jobs a Make.com para generar reportes en batch
     * @param {Object} req - Request object
     * @param {Object} res - Response object
     */
    async sendBulkToMake(req, res) {
        try {
            const { jobs } = req.body;

            if (!jobs || !Array.isArray(jobs) || jobs.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Jobs array is required and must not be empty'
                });
            }

            logger.info('Sending bulk jobs to Make.com', {
                jobs_count: jobs.length,
                job_ids: jobs.map(j => j.job_id)
            });

            // URL del webhook de Make.com
            const makeWebhookUrl = process.env.MAKE_OVERRUN_ALERT_WEBHOOK_URL;

            if (!makeWebhookUrl) {
                logger.error('Make.com webhook URL not configured');
                return res.status(500).json({
                    success: false,
                    message: 'Make.com webhook URL not configured. Please set MAKE_OVERRUN_ALERT_WEBHOOK_URL in .env'
                });
            }

            // Formatear los números a 2 decimales para mejor legibilidad
            // Valores vacíos = 0 para campos numéricos, '' para campos de texto
            const formattedJobs = jobs.map(job => ({
                job_id: job.job_id || 0,
                branch: job.branch || '',
                job_name: job.job_name || '',
                sales_person: job.sales_person || '',
                crew_leader: job.crew_leader || '',
                closing_date: job.closing_date || '',
                at_estimated_hours: job.at_estimated_hours ? parseFloat(job.at_estimated_hours.toFixed(2)) : 0,
                total_hours_worked: job.total_hours_worked ? parseFloat(job.total_hours_worked.toFixed(2)) : 0,
                hours_saved: job.hours_saved ? parseFloat(job.hours_saved.toFixed(2)) : 0
            }));

            // Garantizar que SIEMPRE sea un array (incluso con 1 job)
            const jobsArray = Array.isArray(formattedJobs) ? formattedJobs : [formattedJobs];

            logger.info('Payload prepared for Make.com', {
                is_array: Array.isArray(jobsArray),
                jobs_count: jobsArray.length
            });

            // Enviar el array de jobs a Make.com
            // El iterator de Make.com procesará cada job individualmente
            const response = await axios.post(makeWebhookUrl, {
                jobs: jobsArray
            });

            logger.info('Successfully sent jobs to Make.com', {
                jobs_count: jobs.length,
                response_status: response.status
            });

            return res.status(200).json({
                success: true,
                message: `Successfully sent ${jobs.length} job(s) to Make.com`,
                data: {
                    jobs_sent: jobs.length,
                    webhook_response_status: response.status
                }
            });

        } catch (error) {
            logger.error('Error sending bulk jobs to Make.com', {
                error: error.message,
                stack: error.stack
            });
            
            return res.status(500).json({
                success: false,
                message: 'Failed to send jobs to Make.com',
                error: error.message
            });
        }
    }
}

module.exports = new OverrunReportController();

