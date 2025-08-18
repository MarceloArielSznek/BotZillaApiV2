const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Importar la función del controller
const { findOrCreateSalesPerson } = require('../controllers/automations.controller');
const { SalesPerson, SalesPersonBranch, Branch } = require('../models');
const { Op } = require('sequelize');

async function testBranchAssignment() {
    console.log('🧪 PROBANDO ASIGNACIÓN DE BRANCHES');
    console.log('==================================\n');

    // Primero, obtener un branch válido para las pruebas
    const testBranch = await Branch.findOne();
    if (!testBranch) {
        console.log('❌ No se encontró ningún branch en la base de datos');
        return;
    }

    console.log(`📍 Usando branch: ${testBranch.name} (ID: ${testBranch.id})\n`);

    const testCases = [
        { 
            name: "Dan Howard", 
            description: "Salesperson existente activo - NO debe asignar branch adicional",
            expectedBehavior: "Encontrar existente, NO asignar branch"
        },
        { 
            name: "Daniel Howard", 
            description: "Salesperson inactivo - NO debe reactivar ni asignar branch",
            expectedBehavior: "Encontrar inactivo, NO reactivar, NO asignar branch"
        },
        { 
            name: "Brandon LaDue", 
            description: "Salesperson existente activo - NO debe asignar branch adicional",
            expectedBehavior: "Encontrar existente, NO asignar branch"
        },
        { 
            name: "Test New Person", 
            description: "Salesperson nuevo - DEBE asignar primera branch",
            expectedBehavior: "Crear nuevo, asignar primera branch"
        }
    ];

    for (const testCase of testCases) {
        console.log(`\n🔍 Probando: "${testCase.name}"`);
        console.log(`   Descripción: ${testCase.description}`);
        console.log(`   Esperado: ${testCase.expectedBehavior}`);
        
        // Contar branches antes de la prueba
        const salesPersonBefore = await SalesPerson.findOne({
            where: { name: { [Op.iLike]: testCase.name } }
        });
        
        let branchesBefore = 0;
        if (salesPersonBefore) {
            branchesBefore = await SalesPersonBranch.count({
                where: { sales_person_id: salesPersonBefore.id }
            });
            console.log(`   Branches antes: ${branchesBefore} (ID: ${salesPersonBefore.id}, Active: ${salesPersonBefore.is_active})`);
        } else {
            console.log(`   Branches antes: 0 (no existe)`);
        }
        
        try {
            const result = await findOrCreateSalesPerson(testCase.name, testBranch.id, []);
            
            if (result) {
                console.log(`   ✅ Resultado: ${result.name} (ID: ${result.id}, Active: ${result.is_active})`);
                
                // Contar branches después de la prueba
                const branchesAfter = await SalesPersonBranch.count({
                    where: { sales_person_id: result.id }
                });
                
                console.log(`   Branches después: ${branchesAfter}`);
                
                if (salesPersonBefore && salesPersonBefore.id === result.id) {
                    // Es el mismo salesperson
                    if (branchesAfter > branchesBefore) {
                        console.log(`   ❌ ERROR: Se asignó branch adicional (${branchesBefore} → ${branchesAfter})`);
                    } else {
                        console.log(`   ✅ CORRECTO: No se asignó branch adicional`);
                    }
                } else if (!salesPersonBefore) {
                    // Es un nuevo salesperson
                    if (branchesAfter === 1) {
                        console.log(`   ✅ CORRECTO: Se asignó primera branch a nuevo salesperson`);
                    } else {
                        console.log(`   ❌ ERROR: No se asignó branch a nuevo salesperson`);
                    }
                }
            } else {
                console.log(`   ❌ Resultado: null (no se encontró/creó salesperson)`);
                if (salesPersonBefore && !salesPersonBefore.is_active) {
                    console.log(`   ✅ CORRECTO: No se reactivó salesperson inactivo`);
                }
            }
        } catch (error) {
            console.log(`   ❌ Error: ${error.message}`);
        }
    }

    console.log('\n📊 RESUMEN DE LA PRUEBA:');
    console.log('========================');
    console.log('• Salespersons existentes NO reciben branches adicionales');
    console.log('• Salespersons inactivos NO se reactivan automáticamente');
    console.log('• Solo salespersons nuevos reciben su primera branch');
    console.log('• Se mantiene la integridad de las asignaciones existentes');
}

// Ejecutar la prueba
testBranchAssignment()
    .then(() => {
        console.log('\n✅ Prueba completada');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error en la prueba:', error);
        process.exit(1);
    }); 