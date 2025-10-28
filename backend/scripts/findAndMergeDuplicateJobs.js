/**
 * Script para encontrar y consolidar jobs duplicados
 * 
 * Uso:
 *   node scripts/findAndMergeDuplicateJobs.js --dry-run  (solo mostrar duplicados)
 *   node scripts/findAndMergeDuplicateJobs.js --merge    (consolidar duplicados)
 */

const { Job, Shift, JobSpecialShift } = require('../src/models');
const sequelize = require('../src/config/database');
const { Op } = require('sequelize');
const fuzz = require('fuzzball');

// Función para normalizar nombres (igual que en performancePersistence.service.js)
const normalizeJobName = (name) => {
    if (!name) return '';
    return name
        .replace(/\s*-\s*(ARL|REVISED|SM|CLI|PM|SD|LAK|WA|CA)\s*$/i, '')
        .replace(/\s+/g, ' ')
        .trim();
};

async function findDuplicates() {
    console.log('🔍 Buscando jobs duplicados...\n');
    
    const allJobs = await Job.findAll({
        attributes: ['id', 'name', 'branch_id', 'closing_date', 'performance_status'],
        order: [['branch_id', 'ASC'], ['id', 'ASC']] // id más bajo = más antiguo
    });
    
    const duplicateGroups = [];
    const processedIds = new Set();
    
    for (let i = 0; i < allJobs.length; i++) {
        const job = allJobs[i];
        
        if (processedIds.has(job.id)) continue;
        
        const normalizedName = normalizeJobName(job.name);
        const group = [job];
        processedIds.add(job.id);
        
        // Buscar duplicados en el mismo branch
        for (let j = i + 1; j < allJobs.length; j++) {
            const otherJob = allJobs[j];
            
            if (processedIds.has(otherJob.id)) continue;
            if (job.branch_id !== otherJob.branch_id) continue;
            
            const otherNormalizedName = normalizeJobName(otherJob.name);
            
            // Calcular similitud
            const ratio = fuzz.ratio(normalizedName, otherNormalizedName);
            const partialRatio = fuzz.partial_ratio(normalizedName, otherNormalizedName);
            const tokenSortRatio = fuzz.token_sort_ratio(normalizedName, otherNormalizedName);
            const tokenSetRatio = fuzz.token_set_ratio(normalizedName, otherNormalizedName);
            
            const score = Math.max(ratio, partialRatio, tokenSortRatio, tokenSetRatio);
            
            // Si similitud >= 85%, es duplicado
            if (score >= 85) {
                group.push(otherJob);
                processedIds.add(otherJob.id);
            }
        }
        
        // Si hay más de 1 job en el grupo, es un grupo de duplicados
        if (group.length > 1) {
            duplicateGroups.push(group);
        }
    }
    
    return duplicateGroups;
}

async function displayDuplicates(duplicateGroups) {
    console.log(`\n📊 Encontrados ${duplicateGroups.length} grupos de duplicados:\n`);
    
    for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i];
        console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        console.log(`Grupo ${i + 1} (${group.length} duplicados):`);
        console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        
        for (const job of group) {
            const shiftsCount = await Shift.count({ where: { job_id: job.id } });
            const specialShiftsCount = await JobSpecialShift.count({ where: { job_id: job.id } });
            
            console.log(`  ID: ${job.id}`);
            console.log(`  Name: "${job.name}"`);
            console.log(`  Normalized: "${normalizeJobName(job.name)}"`);
            console.log(`  Status: ${job.performance_status}`);
            console.log(`  Shifts: ${shiftsCount} regular, ${specialShiftsCount} special`);
            console.log(`  Closing Date: ${job.closing_date || 'N/A'}`);
            console.log(`  ---`);
        }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

async function mergeDuplicates(duplicateGroups) {
    console.log('\n🔄 Iniciando consolidación de duplicados...\n');
    
    let totalMerged = 0;
    let totalDeleted = 0;
    
    for (let i = 0; i < duplicateGroups.length; i++) {
        const group = duplicateGroups[i];
        
        // Determinar el job "principal" (el más antiguo o el que tenga más shifts)
        let mainJob = group[0];
        let maxShifts = await Shift.count({ where: { job_id: mainJob.id } });
        
        for (const job of group) {
            const shiftsCount = await Shift.count({ where: { job_id: job.id } });
            // Priorizar: más shifts, o si igual, el ID más bajo (más antiguo)
            if (shiftsCount > maxShifts || (shiftsCount === maxShifts && job.id < mainJob.id)) {
                mainJob = job;
                maxShifts = shiftsCount;
            }
        }
        
        console.log(`\nGrupo ${i + 1}: Manteniendo job ID ${mainJob.id} "${mainJob.name}"`);
        
        // Consolidar duplicados
        const transaction = await sequelize.transaction();
        
        try {
            for (const duplicateJob of group) {
                if (duplicateJob.id === mainJob.id) continue; // Skip el principal
                
                console.log(`  Consolidando job ID ${duplicateJob.id} "${duplicateJob.name}"...`);
                
                // Mover shifts del duplicado al principal
                const shiftsToMove = await Shift.findAll({
                    where: { job_id: duplicateJob.id },
                    transaction
                });
                
                for (const shift of shiftsToMove) {
                    // Verificar si ya existe un shift para este employee en el job principal
                    const existingShift = await Shift.findOne({
                        where: {
                            job_id: mainJob.id,
                            employee_id: shift.employee_id
                        },
                        transaction
                    });
                    
                    if (existingShift) {
                        // Si existe, sumar las horas
                        await existingShift.update({
                            hours: existingShift.hours + shift.hours
                        }, { transaction });
                        console.log(`    Shift de employee ${shift.employee_id}: ${existingShift.hours - shift.hours}h → ${existingShift.hours}h (sumado)`);
                    } else {
                        // Si no existe, mover el shift
                        await shift.update({ job_id: mainJob.id }, { transaction });
                        console.log(`    Shift de employee ${shift.employee_id}: movido (${shift.hours}h)`);
                    }
                }
                
                // Mover special shifts (QC)
                const specialShiftsToMove = await JobSpecialShift.findAll({
                    where: { job_id: duplicateJob.id },
                    transaction
                });
                
                for (const specialShift of specialShiftsToMove) {
                    const existingSpecialShift = await JobSpecialShift.findOne({
                        where: {
                            job_id: mainJob.id,
                            special_shift_id: specialShift.special_shift_id
                        },
                        transaction
                    });
                    
                    if (existingSpecialShift) {
                        // Si existe, sumar las horas
                        await existingSpecialShift.update({
                            hours: existingSpecialShift.hours + specialShift.hours
                        }, { transaction });
                        console.log(`    Special shift: ${existingSpecialShift.hours - specialShift.hours}h → ${existingSpecialShift.hours}h (sumado)`);
                    } else {
                        // Si no existe, mover
                        await specialShift.update({ job_id: mainJob.id }, { transaction });
                        console.log(`    Special shift: movido (${specialShift.hours}h)`);
                    }
                }
                
                // Eliminar el job duplicado
                await duplicateJob.destroy({ transaction });
                console.log(`    ✅ Job ID ${duplicateJob.id} eliminado`);
                totalDeleted++;
            }
            
            await transaction.commit();
            totalMerged++;
            console.log(`  ✅ Grupo ${i + 1} consolidado exitosamente`);
            
        } catch (error) {
            await transaction.rollback();
            console.error(`  ❌ Error consolidando grupo ${i + 1}:`, error.message);
        }
    }
    
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`✅ Consolidación completada:`);
    console.log(`   ${totalMerged} grupos consolidados`);
    console.log(`   ${totalDeleted} jobs duplicados eliminados`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);
}

async function main() {
    const args = process.argv.slice(2);
    const dryRun = args.includes('--dry-run');
    const merge = args.includes('--merge');
    
    if (!dryRun && !merge) {
        console.log('❌ Debes especificar --dry-run o --merge');
        console.log('\nUso:');
        console.log('  node scripts/findAndMergeDuplicateJobs.js --dry-run  (solo mostrar duplicados)');
        console.log('  node scripts/findAndMergeDuplicateJobs.js --merge    (consolidar duplicados)');
        process.exit(1);
    }
    
    try {
        const duplicateGroups = await findDuplicates();
        
        if (duplicateGroups.length === 0) {
            console.log('✅ No se encontraron jobs duplicados. Todo limpio! 🎉\n');
            process.exit(0);
        }
        
        await displayDuplicates(duplicateGroups);
        
        if (dryRun) {
            console.log('ℹ️  Modo DRY-RUN: No se realizaron cambios.');
            console.log('   Para consolidar duplicados, ejecuta con --merge\n');
        }
        
        if (merge) {
            console.log('⚠️  ADVERTENCIA: Estás a punto de consolidar y eliminar jobs duplicados.');
            console.log('   Esta operación NO es reversible.\n');
            
            // En un entorno de producción, podrías agregar confirmación aquí
            await mergeDuplicates(duplicateGroups);
        }
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

main();

