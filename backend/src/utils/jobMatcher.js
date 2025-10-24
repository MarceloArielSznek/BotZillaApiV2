/**
 * Utilidades para matching de job names entre BuilderTrend y Performance Spreadsheet
 * Utiliza fuzzy matching para encontrar coincidencias incluso con nombres similares
 */

const fuzz = require('fuzzball');

/**
 * Normaliza un nombre de job para mejorar el matching
 * - Remueve espacios extras
 * - Convierte a minúsculas
 * - Remueve caracteres especiales comunes
 * @param {string} jobName - Nombre del job a normalizar
 * @returns {string} - Nombre normalizado
 */
function normalizeJobName(jobName) {
    if (!jobName) return '';
    
    return jobName
        .toLowerCase()
        .trim()
        .replace(/\s+/g, ' ') // Múltiples espacios a uno
        .replace(/[^\w\s-]/g, '') // Remover caracteres especiales excepto guiones
        .replace(/\b(warehouse|office|hours|service|calls)\b/gi, ''); // Remover palabras comunes que no son parte del job name
}

/**
 * Extrae el nombre principal y código de área de un job name
 * Ejemplos:
 * - "Dale Fairchild - ORA" → { name: "dale fairchild", code: "ora" }
 * - "Dale Fairchild-ORG" → { name: "dale fairchild", code: "org" }
 * - "Lorie Scholten" → { name: "lorie scholten", code: "" }
 * @param {string} jobName - Nombre del job
 * @returns {Object} - { name: string, code: string }
 */
function parseJobName(jobName) {
    if (!jobName) return { name: '', code: '' };
    
    // PRIMERO parsear ANTES de normalizar, para preservar guiones
    const trimmed = jobName.toLowerCase().trim();
    
    // Buscar el último guion o espacio seguido de 2-5 caracteres (código de área)
    // Patrones: "Name - CODE", "Name-CODE", "Name CODE"
    const match = trimmed.match(/^(.+?)[\s\-]+([a-z]{2,5})$/i);
    
    if (match) {
        const name = normalizeJobName(match[1]);
        const code = match[2].trim().toLowerCase();
        return {
            name,
            code
        };
    }
    
    // Si no hay código de área, normalizar todo
    return {
        name: normalizeJobName(trimmed),
        code: ''
    };
}

/**
 * SIMPLIFICADO: Calcula similitud básica entre nombres
 * @param {string} name1 - Primer nombre
 * @param {string} name2 - Segundo nombre
 * @returns {number} - Score de 0 a 100
 */
function calculateSimilarity(name1, name2) {
    if (!name1 || !name2) return 0;
    
    // Simplemente usar fuzzball con todos sus algoritmos
    const ratio = fuzz.ratio(name1, name2);
    const partialRatio = fuzz.partial_ratio(name1, name2);
    const tokenSortRatio = fuzz.token_sort_ratio(name1, name2);
    const tokenSetRatio = fuzz.token_set_ratio(name1, name2);
    
    // Tomar el máximo
    return Math.max(ratio, partialRatio, tokenSortRatio, tokenSetRatio);
}

/**
 * Encuentra el mejor match para un job name en una lista de jobs candidatos
 * @param {string} jobName - Nombre del job a buscar
 * @param {Array} candidateJobs - Array de jobs candidatos (deben tener .job_name)
 * @param {number} minConfidence - Score mínimo para considerar un match (default 80)
 * @returns {Object|null} - Mejor match o null si no hay match suficiente
 */
function findBestMatch(jobName, candidateJobs, minConfidence = 80) {
    if (!jobName || !candidateJobs || candidateJobs.length === 0) {
        return null;
    }
    
    const logger = require('./logger').logger;
    
    let bestMatch = null;
    let bestScore = 0;
    
    candidateJobs.forEach(candidate => {
        const score = calculateSimilarity(jobName, candidate.job_name);
        
        if (score > bestScore && score >= minConfidence) {
            bestScore = score;
            // Convertir Sequelize model a objeto plano
            const plainCandidate = candidate.toJSON ? candidate.toJSON() : candidate;
            bestMatch = {
                ...plainCandidate,
                similarity_score: score,
                match_confidence: score,
                needs_human_review: score < 95
            };
        }
    });
    
    // SOLO loguear si hay match
    if (bestMatch) {
        logger.info(`✅ MATCH: "${jobName}" → "${bestMatch.job_name}" (${bestScore}%) ID: ${bestMatch.id}`);
    }
    
    return bestMatch;
}

/**
 * Determina el match status basado en el score
 * @param {number} score - Score de similitud (0-100)
 * @returns {string} - 'matched', 'needs_review', 'no_match'
 */
function getMatchStatus(score) {
    if (!score || score < 80) return 'no_match';
    if (score >= 95) return 'matched';
    return 'needs_review';
}

/**
 * Procesa múltiples shifts y encuentra sus matches
 * @param {Array} shifts - Array de shifts con job_name_raw
 * @param {Array} syncJobs - Array de jobs del sync (performance_sync_jobs)
 * @returns {Array} - Array de shifts con información de matching
 */
async function matchShiftsToJobs(shifts, syncJobs) {
    const matchedShifts = [];
    
    for (const shift of shifts) {
        const bestMatch = findBestMatch(shift.job_name_raw, syncJobs);
        
        if (bestMatch) {
            matchedShifts.push({
                ...shift,
                matched_sync_job_id: bestMatch.id,
                match_confidence: bestMatch.match_confidence,
                similarity_score: bestMatch.similarity_score,
                needs_human_review: bestMatch.needs_human_review,
                match_status: getMatchStatus(bestMatch.similarity_score)
            });
        } else {
            matchedShifts.push({
                ...shift,
                matched_sync_job_id: null,
                match_confidence: 0,
                similarity_score: 0,
                needs_human_review: true,
                match_status: 'no_match'
            });
        }
    }
    
    return matchedShifts;
}

/**
 * Obtiene estadísticas de matching para un batch de shifts
 * @param {Array} matchedShifts - Array de shifts con información de matching
 * @returns {Object} - Estadísticas del matching
 */
function getMatchingStats(matchedShifts) {
    const total = matchedShifts.length;
    const matched = matchedShifts.filter(s => s.match_status === 'matched').length;
    const needsReview = matchedShifts.filter(s => s.match_status === 'needs_review').length;
    const noMatch = matchedShifts.filter(s => s.match_status === 'no_match').length;
    
    return {
        total,
        matched,
        needs_review: needsReview,
        no_match: noMatch,
        match_rate: total > 0 ? ((matched / total) * 100).toFixed(2) : 0
    };
}

module.exports = {
    normalizeJobName,
    parseJobName,
    calculateSimilarity,
    findBestMatch,
    getMatchStatus,
    matchShiftsToJobs,
    getMatchingStats
};

