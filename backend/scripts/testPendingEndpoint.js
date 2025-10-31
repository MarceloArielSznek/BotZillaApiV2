/**
 * Script para probar el endpoint de pending approval
 */

const express = require('express');
const app = express();
const { Job, Shift, Employee, Branch, JobStatus, Estimate, SalesPerson, JobSpecialShift, SpecialShift } = require('../src/models');
const { logger } = require('../src/utils/logger');

async function testPendingApprovalEndpoint() {
    try {
        logger.info('🧪 Testing /performance/pending-approval endpoint logic...');
        
        // Replicar la lógica del endpoint
        const whereClause = {
            performance_status: 'pending_approval'
        };
        
        // Obtener jobs pendientes con sus shifts
        const pendingJobs = await Job.findAll({
            where: whereClause,
            include: [
                {
                    model: Branch,
                    as: 'branch',
                    attributes: ['id', 'name']
                },
                {
                    model: Employee,
                    as: 'crewLeader',
                    attributes: ['id', 'first_name', 'last_name', 'email']
                },
                {
                    model: JobStatus,
                    as: 'status',
                    attributes: ['id', 'name']
                },
                {
                    model: Estimate,
                    as: 'estimate',
                    attributes: ['id', 'name'],
                    include: [
                        {
                            model: SalesPerson,
                            as: 'salesperson',
                            attributes: ['id', 'name']
                        }
                    ]
                },
                {
                    model: Shift,
                    as: 'shifts',
                    where: {
                        performance_status: 'pending_approval'
                    },
                    required: false,
                    include: [
                        {
                            model: Employee,
                            as: 'employee',
                            attributes: ['id', 'first_name', 'last_name']
                        }
                    ]
                },
                {
                    model: JobSpecialShift,
                    as: 'jobSpecialShifts',
                    required: false,
                    include: [
                        {
                            model: SpecialShift,
                            as: 'specialShift',
                            attributes: ['id', 'name']
                        }
                    ]
                }
            ]
        });
        
        logger.info(`📊 Found ${pendingJobs.length} pending jobs`);
        
        // Mapear jobs con formato del frontend
        const jobsData = pendingJobs.map(job => {
            const regularShifts = (job.shifts || []).map(shift => ({
                type: 'regular',
                crew_member_id: shift.crew_member_id,
                employee_id: shift.employee_id,
                employee_name: shift.employee ? `${shift.employee.first_name} ${shift.employee.last_name}` : '',
                hours: shift.hours,
                performance_status: shift.performance_status
            }));
            
            const specialShifts = (job.jobSpecialShifts || []).map(jobSpecialShift => ({
                type: 'special',
                special_shift_id: jobSpecialShift.special_shift_id,
                special_shift_name: jobSpecialShift.specialShift?.name || '',
                hours: jobSpecialShift.hours,
                performance_status: 'pending_approval',
                approved: jobSpecialShift.approved
            }));
            
            const allShifts = [...regularShifts, ...specialShifts];
            const totalHours = allShifts.reduce((sum, s) => sum + parseFloat(s.hours || 0), 0);
            const crewCount = regularShifts.length;
            
            return {
                id: job.id,
                name: job.name,
                closing_date: job.closing_date,
                sold_price: job.sold_price,
                branch: job.branch ? { id: job.branch.id, name: job.branch.name } : null,
                crew_leader: job.crewLeader ? {
                    id: job.crewLeader.id,
                    name: `${job.crewLeader.first_name} ${job.crewLeader.last_name}`
                } : null,
                status: job.status ? { id: job.status.id, name: job.status.name } : null,
                estimator: job.estimate?.salesperson?.name || null,
                shifts_count: allShifts.length,
                total_hours: totalHours.toFixed(2),
                crew_count: crewCount,
                shifts: allShifts
            };
        });
        
        logger.info('✅ Formatted jobs data:');
        console.log(JSON.stringify({
            success: true,
            message: 'Pending approval jobs retrieved successfully',
            data: {
                jobs: jobsData,
                total: jobsData.length
            }
        }, null, 2));
        
    } catch (error) {
        logger.error('Error testing endpoint', {
            error: error.message,
            stack: error.stack
        });
    } finally {
        process.exit(0);
    }
}

// Ejecutar
testPendingApprovalEndpoint();

