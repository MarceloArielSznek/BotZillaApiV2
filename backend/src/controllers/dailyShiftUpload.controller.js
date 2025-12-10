'use strict';

const { logger } = require('../utils/logger');
const builderTrendParserService = require('../services/builderTrendParser.service');
const { hasQCTag, hasDeliveryDropTag } = require('../utils/timeConverter');

class DailyShiftUploadController {
    /**
     * Parsear Excel de BuilderTrend y devolver datos agrupados por job y crew member
     * NO guarda en BD, solo parsea y agrupa para visualización
     * @param {Object} req - Request object con el archivo
     * @param {Object} res - Response object
     */
    async parseDailyShifts(req, res) {
        try {
            // Validar que se envió un archivo
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Excel file is required'
                });
            }

            logger.info('Processing Daily Shift Excel upload', {
                filename: req.file.originalname,
                size: req.file.size,
                mimetype: req.file.mimetype
            });

            // Parsear el Excel (sin sync_id, solo para visualización)
            const { rawShifts } = await builderTrendParserService.parseBuilderTrendExcel(
                req.file.buffer,
                'daily-shift-upload' // sync_id temporal solo para logging
            );

            // Agrupar por job y crew member
            const groupedData = {};

            rawShifts.forEach(shift => {
                const jobName = shift.job_name_raw || 'Unknown Job';
                const crewMember = shift.crew_member_name || 'Unknown';

                // Detectar si es QC o Delivery Drop
                const isQC = shift.is_qc || hasQCTag(shift.tags || '');
                const isDeliveryDrop = hasDeliveryDropTag(shift.tags || '');
                const isSpecialShift = isQC || isDeliveryDrop;

                // Crear clave de agregación
                let aggregationKey;
                let displayName;

                if (isSpecialShift) {
                    if (isQC) {
                        aggregationKey = `${jobName}|QC_SPECIAL`;
                        displayName = 'QC Special Shift';
                    } else if (isDeliveryDrop) {
                        aggregationKey = `${jobName}|DELIVERY_DROP_SPECIAL`;
                        displayName = 'Job Delivery Special Shift';
                    } else {
                        aggregationKey = `${jobName}|SPECIAL|${crewMember}`;
                        displayName = 'Special Shift';
                    }
                } else {
                    aggregationKey = `${jobName}|REGULAR|${crewMember}`;
                    displayName = crewMember;
                }

                if (!groupedData[aggregationKey]) {
                    groupedData[aggregationKey] = {
                        job_name: jobName,
                        crew_member_name: displayName,
                        shifts_count: 0,
                        regular_hours: 0,
                        ot_hours: 0,
                        ot2_hours: 0,
                        total_hours: 0,
                        has_qc: false,
                        tags: []
                    };
                }

                groupedData[aggregationKey].shifts_count += 1;

                // Para QC/Delivery Drop: cada shift es 3 horas fijas
                if (isQC) {
                    groupedData[aggregationKey].has_qc = true;
                } else if (isDeliveryDrop) {
                    // Delivery Drop también tiene 3 horas fijas
                } else {
                    // Para shifts regulares, sumar las horas reales
                    groupedData[aggregationKey].regular_hours += parseFloat(shift.regular_hours || 0);
                    groupedData[aggregationKey].ot_hours += parseFloat(shift.ot_hours || 0);
                    groupedData[aggregationKey].ot2_hours += parseFloat(shift.ot2_hours || 0);
                    groupedData[aggregationKey].total_hours += parseFloat(shift.total_hours || 0);
                }

                if (shift.tags && shift.tags.trim() !== '') {
                    groupedData[aggregationKey].tags.push(shift.tags);
                }
            });

            // Convertir a array y calcular horas finales para QC/Delivery Drop
            const result = Object.values(groupedData).map(item => {
                const isQC = item.has_qc || item.crew_member_name === 'QC Special Shift';
                const isDeliveryDrop = item.crew_member_name === 'Job Delivery Special Shift';

                if (isQC || isDeliveryDrop) {
                    // Cada shift QC/Delivery Drop es exactamente 3 horas
                    item.regular_hours = item.shifts_count * 3;
                    item.ot_hours = 0;
                    item.ot2_hours = 0;
                    item.total_hours = item.shifts_count * 3;
                }

                return {
                    ...item,
                    regular_hours: parseFloat(item.regular_hours.toFixed(2)),
                    ot_hours: parseFloat(item.ot_hours.toFixed(2)),
                    ot2_hours: parseFloat(item.ot2_hours.toFixed(2)),
                    total_hours: parseFloat(item.total_hours.toFixed(2)),
                    tags: [...new Set(item.tags)].join(', ') // Unique tags
                };
            });

            // Agrupar por job para la respuesta final
            const jobsGrouped = {};
            result.forEach(item => {
                if (!jobsGrouped[item.job_name]) {
                    jobsGrouped[item.job_name] = [];
                }
                jobsGrouped[item.job_name].push(item);
            });

            logger.info('Daily Shift Excel processed', {
                totalShifts: rawShifts.length,
                uniqueJobs: Object.keys(jobsGrouped).length,
                totalEntries: result.length
            });

            return res.status(200).json({
                success: true,
                message: 'Excel processed successfully',
                data: {
                    jobs: jobsGrouped,
                    shifts: result,
                    stats: {
                        totalShifts: rawShifts.length,
                        uniqueJobs: Object.keys(jobsGrouped).length,
                        totalCrewMembers: result.length
                    }
                }
            });

        } catch (error) {
            logger.error('Error processing Daily Shift Excel', {
                error: error.message,
                stack: error.stack
            });

            return res.status(500).json({
                success: false,
                message: 'Failed to process Excel file',
                error: error.message
            });
        }
    }
}

module.exports = new DailyShiftUploadController();

