const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const { SalesPerson, SalesPersonBranch } = require('../models');
const { Op } = require('sequelize');

async function debugNewPerson() {
    console.log('🔍 DEBUGGEANDO CASO "Test New Person"');
    console.log('====================================\n');

    // Buscar salespersons que contengan "New Person"
    const similarSalesPersons = await SalesPerson.findAll({
        where: {
            name: {
                [Op.iLike]: '%New Person%'
            }
        },
        order: [['name', 'ASC']]
    });

    console.log('📋 Salespersons similares encontrados:');
    for (const sp of similarSalesPersons) {
        const branchCount = await SalesPersonBranch.count({
            where: { sales_person_id: sp.id }
        });
        console.log(`   - ${sp.name} (ID: ${sp.id}, Active: ${sp.is_active}, Branches: ${branchCount})`);
    }

    // Buscar salespersons que contengan "Test"
    const testSalesPersons = await SalesPerson.findAll({
        where: {
            name: {
                [Op.iLike]: '%Test%'
            }
        },
        order: [['name', 'ASC']]
    });

    console.log('\n📋 Salespersons con "Test" encontrados:');
    for (const sp of testSalesPersons) {
        const branchCount = await SalesPersonBranch.count({
            where: { sales_person_id: sp.id }
        });
        console.log(`   - ${sp.name} (ID: ${sp.id}, Active: ${sp.is_active}, Branches: ${branchCount})`);
    }

    // Buscar salespersons que contengan "Person"
    const personSalesPersons = await SalesPerson.findAll({
        where: {
            name: {
                [Op.iLike]: '%Person%'
            }
        },
        order: [['name', 'ASC']]
    });

    console.log('\n📋 Salespersons con "Person" encontrados:');
    for (const sp of personSalesPersons) {
        const branchCount = await SalesPersonBranch.count({
            where: { sales_person_id: sp.id }
        });
        console.log(`   - ${sp.name} (ID: ${sp.id}, Active: ${sp.is_active}, Branches: ${branchCount})`);
    }
}

debugNewPerson()
    .then(() => {
        console.log('\n✅ Debug completado');
        process.exit(0);
    })
    .catch(error => {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }); 