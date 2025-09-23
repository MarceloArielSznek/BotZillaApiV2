const { Employee } = require('../models');
const { logger } = require('../utils/logger');

const seedPendingEmployees = async () => {
    const pendingEmployees = [
        {
            first_name: 'John',
            last_name: 'Doe',
            email: 'john.doe.pending@example.com',
            phone_number: '1234567890',
            telegram_id: '111111111',
            branch: 'San Diego',
            role: 'salesperson',
            status: 'pending',
            date_of_birth: '1990-01-15',
            street: '123 Main St',
            city: 'Anytown',
            state: 'CA',
            zip: '12345'
        },
        {
            first_name: 'Jane',
            last_name: 'Smith',
            email: 'jane.smith.pending@example.com',
            phone_number: '2345678901',
            telegram_id: '222222222',
            branch: 'Orange County',
            role: 'crew_leader',
            status: 'pending',
            date_of_birth: '1992-05-20',
            street: '456 Oak Ave',
            city: 'Someplace',
            state: 'CA',
            zip: '54321'
        },
        {
            first_name: 'Peter',
            last_name: 'Jones',
            email: 'peter.jones.pending@example.com',
            phone_number: '3456789012',
            telegram_id: '333333333',
            branch: 'Kent - WA',
            role: 'crew_member',
            status: 'pending',
            date_of_birth: '1995-10-30',
            street: '789 Pine Ln',
            city: 'Elsewhere',
            state: 'WA',
            zip: '67890'
        }
    ];

    try {
        logger.info('Seeding pending employees...');
        
        for (const employeeData of pendingEmployees) {
            // Usar findOrCreate para evitar duplicados si el script se corre varias veces
            const [employee, created] = await Employee.findOrCreate({
                where: { email: employeeData.email },
                defaults: employeeData
            });

            if (created) {
                logger.info(`- Created pending employee: ${employee.first_name} ${employee.last_name}`);
            } else {
                logger.info(`- Pending employee already exists: ${employee.first_name} ${employee.last_name}`);
            }
        }

        logger.info('Pending employees seeded successfully!');
    } catch (error) {
        logger.error('Error seeding pending employees:', error);
    }
};

// Si el script se ejecuta directamente, llamar a la función
if (require.main === module) {
    seedPendingEmployees().then(() => {
        // Cerrar la conexión a la base de datos si es necesario
        const sequelize = require('../models').sequelize;
        if (sequelize) {
            sequelize.close();
        }
    });
}

module.exports = seedPendingEmployees;
