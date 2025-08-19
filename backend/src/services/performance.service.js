const { Job, Estimate, Shift, JobSpecialShift } = require('../models');

async function calculateJobPerformance(jobId) {
    const job = await Job.findByPk(jobId, {
        include: [
            { model: Estimate, as: 'estimate', attributes: ['attic_tech_hours'] },
            { model: Shift, as: 'shifts' },
            { model: JobSpecialShift, as: 'jobSpecialShifts' }
        ]
    });

    if (!job) {
        throw new Error('Job not found');
    }

    const atHours = parseFloat(job.attic_tech_hours || job.estimate?.attic_tech_hours || 0);
    const clPlanHours = parseFloat(job.cl_estimated_plan_hours || job.crew_leader_hours) || 0;

    const regularHours = job.shifts.reduce((acc, shift) => acc + parseFloat(shift.hours), 0);
    const specialHours = job.jobSpecialShifts.reduce((acc, shift) => acc + parseFloat(shift.hours), 0);
    const totalWorkedHours = regularHours + specialHours;

    const totalSavedHours = atHours - totalWorkedHours;
    
    // Usamos las fórmulas que ya definimos
    const jobBonusPool = totalSavedHours * 31 * 0.25; 
    const potentialBonusPool = (atHours - clPlanHours) * 31 * 0.3;
    
    // Nuevas fórmulas según especificación:
    // 1. Planned to save = 1 - (cl_estimated_plan_hours / at_estimated_hours)
    const plannedToSavePercent = atHours > 0 ? (1 - (clPlanHours / atHours)) : 0;
    
    // 2. Actual Saved = (at_estimated_hours - total_worked_hours) / at_estimated_hours
    // Nota: totalWorkedHours ya incluye regularHours + specialHours (unbillables)
    const actualSavedPercent = atHours > 0 ? ((atHours - totalWorkedHours) / atHours) : 0;

    return {
        atHours,
        clPlanHours,
        totalWorkedHours,
        totalSavedHours,
        jobBonusPool,
        plannedToSavePercent,
        potentialBonusPool,
        actualSavedPercent
    };
}

module.exports = {
    calculateJobPerformance
}; 