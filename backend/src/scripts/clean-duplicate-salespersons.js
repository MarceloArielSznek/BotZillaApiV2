const { SalesPerson, SalesPersonBranch, Estimate, EstimateStatus } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { logger } = require('../utils/logger');
const path = require('path');

// Configurar dotenv para buscar el archivo .env en el directorio correcto
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

/**
 * Script para limpiar duplicados de salespersons y marcar como inactivos los que no se usan
 */
async function cleanDuplicateSalesPersons() {
    const logMessages = [];
    
    try {
        logMessages.push('🧹 Iniciando limpieza de salespersons duplicados...');
        console.log('🧹 Iniciando limpieza de salespersons duplicados...');

        // Función helper para normalizar nombres (igual que en automations.controller.js)
        const normalizeName = (name) => {
            return name.toLowerCase()
                .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
                .replace(/[^\w\s]/g, '') // Remover puntuación
                .trim();
        };

        // Función helper para calcular similitud entre nombres (versión mejorada)
        const calculateNameSimilarity = (name1, name2) => {
            const normalized1 = normalizeName(name1);
            const normalized2 = normalizeName(name2);
            
            // Si son exactamente iguales después de normalizar
            if (normalized1 === normalized2) return 1.0;
            
            // Si uno contiene al otro (ej: "Eben W" vs "Eben Woodbell")
            if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
                return 0.9;
            }
            
            // Calcular similitud por palabras
            const words1 = normalized1.split(' ');
            const words2 = normalized2.split(' ');
            
            let commonWords = 0;
            let totalWords = Math.max(words1.length, words2.length);
            
            for (const word1 of words1) {
                for (const word2 of words2) {
                    if (word1 === word2 || 
                        word1.startsWith(word2) || 
                        word2.startsWith(word1)) {
                        commonWords++;
                        break;
                    }
                }
            }
            
            const wordSimilarity = commonWords / totalWords;
            
            // Calcular similitud de caracteres para casos como "Woodall" vs "Woodbell"
            const calculateCharacterSimilarity = (str1, str2) => {
                const longer = str1.length > str2.length ? str1 : str2;
                const shorter = str1.length > str2.length ? str2 : str1;
                
                if (longer.length === 0) return 1.0;
                
                // Calcular distancia de Levenshtein simplificada
                let distance = 0;
                for (let i = 0; i < shorter.length; i++) {
                    if (longer[i] !== shorter[i]) {
                        distance++;
                    }
                }
                distance += longer.length - shorter.length;
                
                return 1 - (distance / longer.length);
            };
            
            // Calcular similitud de caracteres para cada palabra
            let maxCharSimilarity = 0;
            for (const word1 of words1) {
                for (const word2 of words2) {
                    if (word1.length >= 3 && word2.length >= 3) { // Solo palabras de 3+ caracteres
                        const charSimilarity = calculateCharacterSimilarity(word1, word2);
                        if (charSimilarity > maxCharSimilarity) {
                            maxCharSimilarity = charSimilarity;
                        }
                    }
                }
            }
            
            // Combinar similitud de palabras y caracteres
            const combinedSimilarity = (wordSimilarity * 0.6) + (maxCharSimilarity * 0.4);
            
            return combinedSimilarity;
        };

        // 1. Encontrar salespersons con nombres similares usando el algoritmo de similitud
        const allSalesPersons = await SalesPerson.findAll({
            order: [['name', 'ASC']]
        });

        const duplicates = [];
        const processed = new Set();

        for (let i = 0; i < allSalesPersons.length; i++) {
            if (processed.has(allSalesPersons[i].id)) continue;

            const currentSalesPerson = allSalesPersons[i];
            const similarNames = [];

            // Buscar salespersons similares
            for (let j = i + 1; j < allSalesPersons.length; j++) {
                if (processed.has(allSalesPersons[j].id)) continue;

                const similarity = calculateNameSimilarity(currentSalesPerson.name, allSalesPersons[j].name);
                
                // Si la similitud es alta (>= 0.7), considerarlos duplicados
                if (similarity >= 0.7) {
                    if (similarNames.length === 0) {
                        similarNames.push(currentSalesPerson);
                    }
                    similarNames.push(allSalesPersons[j]);
                }
                
                // Log para debugging de similitudes altas pero no duplicados
                if (similarity >= 0.6 && similarity < 0.7) {
                    console.log(`🔍 High similarity but below threshold: "${currentSalesPerson.name}" vs "${allSalesPersons[j].name}" (similarity: ${similarity.toFixed(2)})`);
                }
            }

            if (similarNames.length > 1) {
                duplicates.push(similarNames);
                similarNames.forEach(sp => processed.add(sp.id));
                
                // Log para debugging
                const names = similarNames.map(sp => sp.name).join(', ');
                const similarity = calculateNameSimilarity(similarNames[0].name, similarNames[1].name);
                console.log(`🔍 Found duplicate group: ${names} (similarity: ${similarity.toFixed(2)})`);
            }
        }

        logMessages.push(`📊 Encontrados ${duplicates.length} grupos de duplicados`);
        console.log(`📊 Encontrados ${duplicates.length} grupos de duplicados`);

        let totalMerged = 0;
        let totalDeactivated = 0;

        // 2. Procesar cada grupo de duplicados
        for (const duplicateGroup of duplicates) {
            logMessages.push(`\n🔄 Procesando grupo: ${duplicateGroup.map(sp => sp.name).join(', ')}`);
            console.log(`🔄 Procesando grupo: ${duplicateGroup.map(sp => sp.name).join(', ')}`);

            // Ordenar por prioridad: 1) Tiene telegram_id, 2) Tiene más estimates activos, 3) Tiene más warnings, 4) ID más bajo
            const sortedGroup = await Promise.all(duplicateGroup.map(async (sp) => {
                // Contar estimates activos para cada salesperson
                const activeEstimatesCount = await Estimate.count({
                    where: { 
                        sales_person_id: sp.id 
                    },
                    include: [{
                        model: EstimateStatus,
                        as: 'status',
                        where: {
                            name: { [Op.in]: ['In Progress', 'Released'] }
                        }
                    }]
                });

                return {
                    ...sp.toJSON(),
                    activeEstimatesCount
                };
            }));

            sortedGroup.sort((a, b) => {
                // 1. Priorizar los que tienen telegram_id
                const aHasTelegram = a.telegram_id && a.telegram_id.trim() !== '';
                const bHasTelegram = b.telegram_id && b.telegram_id.trim() !== '';
                
                if (aHasTelegram && !bHasTelegram) return -1;
                if (!aHasTelegram && bHasTelegram) return 1;

                // 2. Si ambos tienen o no tienen telegram_id, priorizar por estimates activos
                if (a.activeEstimatesCount !== b.activeEstimatesCount) {
                    return b.activeEstimatesCount - a.activeEstimatesCount; // Más estimates primero
                }

                // 3. Si tienen la misma cantidad de estimates, priorizar por warnings
                if (a.warning_count !== b.warning_count) {
                    return b.warning_count - a.warning_count; // Más warnings primero (indica más actividad)
                }

                // 4. Si todo es igual, priorizar por ID más bajo
                return a.id - b.id;
            });

            const primary = sortedGroup[0];
            const duplicates = sortedGroup.slice(1);

            logMessages.push(`   ✅ Salesperson principal: ${primary.name} (ID: ${primary.id})`);
            console.log(`   ✅ Salesperson principal: ${primary.name} (ID: ${primary.id})`);

            // 3. Transferir branches de los duplicados al principal
            for (const duplicate of duplicates) {
                const duplicateBranches = await SalesPersonBranch.findAll({
                    where: { sales_person_id: duplicate.id }
                });

                for (const branchRelation of duplicateBranches) {
                    await SalesPersonBranch.findOrCreate({
                        where: { 
                            sales_person_id: primary.id, 
                            branch_id: branchRelation.branch_id 
                        },
                        defaults: { 
                            sales_person_id: primary.id, 
                            branch_id: branchRelation.branch_id 
                        }
                    });
                }

                logMessages.push(`   🔗 Transferidas ${duplicateBranches.length} branches de ${duplicate.name} a ${primary.name}`);
                console.log(`   🔗 Transferidas ${duplicateBranches.length} branches de ${duplicate.name} a ${primary.name}`);
            }

            // 4. Actualizar estimates para usar el salesperson principal
            for (const duplicate of duplicates) {
                const updatedEstimates = await Estimate.update(
                    { sales_person_id: primary.id },
                    { where: { sales_person_id: duplicate.id } }
                );

                if (updatedEstimates[0] > 0) {
                    logMessages.push(`   📝 Actualizados ${updatedEstimates[0]} estimates de ${duplicate.name} a ${primary.name}`);
                    console.log(`   📝 Actualizados ${updatedEstimates[0]} estimates de ${duplicate.name} a ${primary.name}`);
                }
            }

            // 5. Marcar duplicados como inactivos
            for (const duplicate of duplicates) {
                // Buscar el objeto original de Sequelize para poder usar update()
                const originalSalesPerson = await SalesPerson.findByPk(duplicate.id);
                if (originalSalesPerson) {
                    await originalSalesPerson.update({ is_active: false });
                    logMessages.push(`   ❌ Marcado como inactivo: ${duplicate.name} (ID: ${duplicate.id})`);
                    console.log(`   ❌ Marcado como inactivo: ${duplicate.name} (ID: ${duplicate.id})`);
                    totalDeactivated++;
                }
            }

            totalMerged += duplicates.length;
        }

        // 6. Encontrar salespersons sin estimates y marcarlos como inactivos (SOLO si no tienen datos importantes)
        logMessages.push('\n🔍 Buscando salespersons sin estimates...');
        console.log('\n🔍 Buscando salespersons sin estimates...');

        const salesPersonsWithoutEstimates = await SalesPerson.findAll({
            include: [{
                model: Estimate,
                as: 'estimates',
                required: false
            }],
            where: {
                is_active: true
            }
        });

        const inactiveCandidates = salesPersonsWithoutEstimates.filter(sp => 
            !sp.estimates || sp.estimates.length === 0
        );

        logMessages.push(`📊 Encontrados ${inactiveCandidates.length} salespersons sin estimates`);
        console.log(`📊 Encontrados ${inactiveCandidates.length} salespersons sin estimates`);

        for (const candidate of inactiveCandidates) {
            // Verificar si tiene branches asignadas
            const branchCount = await SalesPersonBranch.count({
                where: { sales_person_id: candidate.id }
            });

            // Verificar si tiene datos importantes que proteger
            const hasImportantData = (
                candidate.telegram_id && candidate.telegram_id.trim() !== '' ||
                candidate.warning_count > 0 ||
                branchCount > 0
            );

            if (!hasImportantData) {
                await candidate.update({ is_active: false });
                logMessages.push(`   ❌ Marcado como inactivo (sin datos importantes): ${candidate.name}`);
                console.log(`   ❌ Marcado como inactivo (sin datos importantes): ${candidate.name}`);
                totalDeactivated++;
            } else {
                logMessages.push(`   ⚠️ Mantenido activo (tiene datos importantes): ${candidate.name} (telegram: ${candidate.telegram_id ? 'Sí' : 'No'}, warnings: ${candidate.warning_count}, branches: ${branchCount})`);
                console.log(`   ⚠️ Mantenido activo (tiene datos importantes): ${candidate.name} (telegram: ${candidate.telegram_id ? 'Sí' : 'No'}, warnings: ${candidate.warning_count}, branches: ${branchCount})`);
            }
        }

        // 7. Resumen final con información de protección
        const summary = {
            totalDuplicates: totalMerged,
            totalDeactivated: totalDeactivated,
            message: `✅ Limpieza completada. ${totalMerged} duplicados procesados, ${totalDeactivated} salespersons marcados como inactivos.`,
            protectionInfo: {
                telegramIdProtected: 'Salespersons con Telegram ID configurado fueron priorizados',
                activeEstimatesProtected: 'Salespersons con estimates activos fueron priorizados',
                warningsProtected: 'Salespersons con warnings fueron priorizados',
                branchesProtected: 'Salespersons con branches asignadas fueron protegidos',
                dataTransferred: 'Todas las branches y estimates fueron transferidas al salesperson principal'
            }
        };

        logMessages.push(`\n${summary.message}`);
        logMessages.push('\n🛡️ PROTECCIÓN DE DATOS:');
        logMessages.push('   • Salespersons con Telegram ID configurado fueron priorizados');
        logMessages.push('   • Salespersons con estimates activos fueron priorizados');
        logMessages.push('   • Salespersons con warnings fueron priorizados');
        logMessages.push('   • Salespersons con branches asignadas fueron protegidos');
        logMessages.push('   • Todas las branches y estimates fueron transferidas al salesperson principal');
        
        console.log(`\n${summary.message}`);
        console.log('\n🛡️ PROTECCIÓN DE DATOS:');
        console.log('   • Salespersons con Telegram ID configurado fueron priorizados');
        console.log('   • Salespersons con estimates activos fueron priorizados');
        console.log('   • Salespersons con warnings fueron priorizados');
        console.log('   • Salespersons con branches asignadas fueron protegidos');
        console.log('   • Todas las branches y estimates fueron transferidas al salesperson principal');

        return {
            success: true,
            ...summary,
            logs: logMessages
        };

    } catch (error) {
        const errorMessage = `❌ Error durante la limpieza: ${error.message}`;
        logMessages.push(errorMessage);
        console.error(errorMessage);
        
        return {
            success: false,
            error: error.message,
            logs: logMessages
        };
    }
}

// Ejecutar el script si se llama directamente
if (require.main === module) {
    cleanDuplicateSalesPersons()
        .then(result => {
            if (result.success) {
                console.log('✅ Script ejecutado exitosamente');
                process.exit(0);
            } else {
                console.error('❌ Script falló');
                process.exit(1);
            }
        })
        .catch(error => {
            console.error('❌ Error inesperado:', error);
            process.exit(1);
        });
}

module.exports = { cleanDuplicateSalesPersons }; 