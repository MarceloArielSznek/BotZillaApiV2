/**
 * Utilidades para convertir tiempo en formato HH:MM a decimal
 * y calcular totales de shifts de BuilderTrend
 */

/**
 * Convierte tiempo en formato HH:MM a horas decimales
 * @param {string} timeStr - Tiempo en formato "HH:MM" (e.g., "08:30", "1:45")
 * @returns {number} - Horas en formato decimal (e.g., 8.5, 1.75)
 */
function convertTimeToDecimal(timeStr) {
    if (!timeStr || timeStr.trim() === '' || timeStr === '0' || timeStr === '00:00') {
        return 0;
    }

    // Limpiar el string
    timeStr = timeStr.trim();

    // Intentar parsear diferentes formatos
    // Formato HH:MM o H:MM
    const timeMatch = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    
    if (timeMatch) {
        const hours = parseInt(timeMatch[1], 10);
        const minutes = parseInt(timeMatch[2], 10);
        
        if (isNaN(hours) || isNaN(minutes)) {
            return 0;
        }
        
        // Convertir minutos a decimal
        const decimalHours = hours + (minutes / 60);
        return parseFloat(decimalHours.toFixed(2));
    }

    // Si no coincide con el formato, intentar parsear como número decimal directo
    const numericValue = parseFloat(timeStr);
    if (!isNaN(numericValue)) {
        return parseFloat(numericValue.toFixed(2));
    }

    // Si todo falla, retornar 0
    console.warn(`Could not parse time string: "${timeStr}"`);
    return 0;
}

/**
 * Convierte tiempo regular (HH:MM) a horas decimales
 * @param {string} timeStr - Tiempo en formato "HH:MM"
 * @returns {number} - Horas decimales sin multiplicador
 */
function convertRegularTime(timeStr) {
    return convertTimeToDecimal(timeStr);
}

/**
 * Convierte overtime (HH:MM) a horas decimales y multiplica por 1.5
 * @param {string} timeStr - Tiempo en formato "HH:MM"
 * @returns {number} - Horas decimales multiplicadas por 1.5
 */
function convertOvertimeX1_5(timeStr) {
    const decimal = convertTimeToDecimal(timeStr);
    return parseFloat((decimal * 1.5).toFixed(2));
}

/**
 * Convierte double overtime (HH:MM) a horas decimales y multiplica por 2
 * @param {string} timeStr - Tiempo en formato "HH:MM"
 * @returns {number} - Horas decimales multiplicadas por 2
 */
function convertOvertimeX2(timeStr) {
    const decimal = convertTimeToDecimal(timeStr);
    return parseFloat((decimal * 2).toFixed(2));
}

/**
 * Calcula el total de horas de un shift
 * @param {Object} shift - Objeto con regular_time_raw, ot_raw, ot2_raw, pto_raw
 * @returns {Object} - Objeto con todas las conversiones y el total
 */
function calculateShiftTotals(shift) {
    const regularHours = convertRegularTime(shift.regular_time_raw);
    const otHours = convertOvertimeX1_5(shift.ot_raw);
    const ot2Hours = convertOvertimeX2(shift.ot2_raw);
    const ptoHours = convertRegularTime(shift.pto_raw); // PTO no se multiplica

    const totalHours = regularHours + otHours + ot2Hours + ptoHours;

    return {
        regular_hours: regularHours,
        ot_hours: otHours,
        ot2_hours: ot2Hours,
        pto_hours: ptoHours,
        total_hours: parseFloat(totalHours.toFixed(2))
    };
}

/**
 * Detecta si un shift tiene tag de QC (Quality Control)
 * @param {string} tagsStr - String con los tags separados por comas o espacios
 * @returns {boolean} - true si contiene "QC"
 */
function hasQCTag(tagsStr) {
    if (!tagsStr || tagsStr.trim() === '') {
        return false;
    }
    
    // Buscar "QC" como palabra completa (case insensitive)
    const qcPattern = /\bQC\b/i;
    return qcPattern.test(tagsStr);
}

/**
 * Agrega shifts por crew member y job
 * @param {Array} shifts - Array de shifts procesados
 * @returns {Array} - Array de shifts agregados por crew_member_name y job_name_raw
 */
function aggregateShiftsByCrewAndJob(shifts) {
    const aggregated = {};

    shifts.forEach(shift => {
        const key = `${shift.crew_member_name}|${shift.job_name_raw}|${shift.matched_sync_job_id || 'unmatched'}`;
        
        if (!aggregated[key]) {
            aggregated[key] = {
                crew_member_name: shift.crew_member_name,
                job_name_raw: shift.job_name_raw,
                matched_sync_job_id: shift.matched_sync_job_id,
                match_status: shift.match_status,
                match_confidence: shift.match_confidence,
                needs_human_review: shift.needs_human_review,
                shifts_count: 0,
                regular_hours: 0,
                ot_hours: 0,
                ot2_hours: 0,
                pto_hours: 0,
                total_hours: 0,
                has_qc: false,
                tags_combined: []
            };
        }

        // Sumar horas
        aggregated[key].shifts_count += 1;
        aggregated[key].regular_hours += shift.regular_hours || 0;
        aggregated[key].ot_hours += shift.ot_hours || 0;
        aggregated[key].ot2_hours += shift.ot2_hours || 0;
        aggregated[key].pto_hours += shift.pto_hours || 0;
        aggregated[key].total_hours += shift.total_hours || 0;
        
        // Acumular tags
        if (shift.tags && shift.tags.trim() !== '') {
            aggregated[key].tags_combined.push(shift.tags);
        }
        
        // Si alguno tiene QC, marcar como QC
        if (shift.is_qc) {
            aggregated[key].has_qc = true;
        }
    });

    // Convertir a array y redondear valores
    return Object.values(aggregated).map(agg => ({
        ...agg,
        regular_hours: parseFloat(agg.regular_hours.toFixed(2)),
        ot_hours: parseFloat(agg.ot_hours.toFixed(2)),
        ot2_hours: parseFloat(agg.ot2_hours.toFixed(2)),
        pto_hours: parseFloat(agg.pto_hours.toFixed(2)),
        total_hours: parseFloat(agg.total_hours.toFixed(2)),
        tags_combined: agg.tags_combined.join(', ')
    }));
}

module.exports = {
    convertTimeToDecimal,
    convertRegularTime,
    convertOvertimeX1_5,
    convertOvertimeX2,
    calculateShiftTotals,
    hasQCTag,
    aggregateShiftsByCrewAndJob
};

