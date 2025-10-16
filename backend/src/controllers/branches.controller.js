const { Branch, SalesPersonBranch, SalesPerson, Estimate } = require('../models');
const { Op } = require('sequelize');
const { cleanupDuplicateBranches } = require('../utils/branchHelper');

// GET /api/branches - Obtener todas las branches
exports.getAllBranches = async (req, res) => {
    try {
        console.log('🏢 Obteniendo todas las branches...');
        
        const { 
            page = 1, 
            limit = 10, 
            search = '',
            includeStats = false 
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Filtro de búsqueda
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { address: { [Op.iLike]: `%${search}%` } }
            ];
        }

        const includeOptions = [];
        
        // Incluir estadísticas si se solicita
        if (includeStats === 'true') {
            includeOptions.push(
                {
                    model: SalesPersonBranch,
                    include: [{ model: SalesPerson, attributes: ['id', 'name'] }],
                    attributes: ['sales_person_id']
                },
                {
                    model: Estimate,
                    attributes: ['id', 'price'],
                    required: false
                }
            );
        }

        const { count, rows } = await Branch.findAndCountAll({
            where,
            include: includeOptions,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
            distinct: true
        });

        // Procesar estadísticas si se solicitan
        const branchesWithStats = includeStats === 'true' 
            ? rows.map(branch => {
                const salesPersonsCount = branch.SalesPersonBranches?.length || 0;
                const estimatesCount = branch.Estimates?.length || 0;
                const totalRevenue = branch.Estimates?.reduce((sum, est) => sum + (est.price || 0), 0) || 0;
                
                return {
                    ...branch.toJSON(),
                    stats: {
                        salesPersonsCount,
                        estimatesCount,
                        totalRevenue
                    }
                };
            })
            : rows;

        console.log(`✅ ${rows.length} branches encontradas`);

        res.json({
            branches: branchesWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                hasNextPage: page < Math.ceil(count / limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener branches:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching branches',
            error: error.message
        });
    }
};

// GET /api/branches/:id - Obtener una branch específica
exports.getBranchById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🏢 Obteniendo branch con ID: ${id}`);

        const branch = await Branch.findByPk(id, {
            include: [
                {
                    model: SalesPersonBranch,
                    include: [{ 
                        model: SalesPerson, 
                        attributes: ['id', 'name', 'phone', 'telegram_id'] 
                    }]
                },
                {
                    model: Estimate,
                    attributes: ['id', 'name', 'price', 'at_created_date'],
                    limit: 10,
                    order: [['at_created_date', 'DESC']]
                }
            ]
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
            });
        }

        // Calcular estadísticas
        const stats = {
            salesPersonsCount: branch.SalesPersonBranches?.length || 0,
            estimatesCount: branch.Estimates?.length || 0,
            totalRevenue: branch.Estimates?.reduce((sum, est) => sum + (est.price || 0), 0) || 0
        };

        console.log(`✅ Branch encontrada: ${branch.name}`);

        res.json({
            ...branch.toJSON(),
            stats
        });

    } catch (error) {
        console.error('❌ Error al obtener branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error fetching branch',
            error: error.message
        });
    }
};

// POST /api/branches - Crear nueva branch
exports.createBranch = async (req, res) => {
    try {
        const { name, address, telegram_group_id } = req.body;
        console.log(`🏢 Creando nueva branch: ${name}`);

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Branch name is required'
            });
        }

        // Verificar que no exista una branch con el mismo nombre
        const existingBranch = await Branch.findOne({ where: { name } });
        if (existingBranch) {
            return res.status(400).json({
                success: false,
                message: 'A branch with this name already exists'
            });
        }

        const branch = await Branch.create({
            name: name.trim(),
            address: address?.trim() || null,
            telegram_group_id: telegram_group_id?.trim() || null
        });

        console.log(`✅ Branch created successfully: ${branch.name} (ID: ${branch.id})`);

        res.status(201).json({
            success: true,
            message: 'Branch created successfully',
            branch
        });

    } catch (error) {
        console.error('❌ Error al crear branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating branch',
            error: error.message
        });
    }
};

// PUT /api/branches/:id - Actualizar branch
exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address, telegram_group_id } = req.body;
        console.log(`🏢 Actualizando branch ID: ${id}`);

        const branch = await Branch.findByPk(id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
            });
        }

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'Branch name is required'
            });
        }

        // Verificar que no exista otra branch con el mismo nombre
        const existingBranch = await Branch.findOne({ 
            where: { 
                name,
                id: { [Op.ne]: id } 
            } 
        });
        if (existingBranch) {
            return res.status(400).json({
                success: false,
                message: 'Another branch with this name already exists'
            });
        }

        await branch.update({
            name: name.trim(),
            address: address?.trim() || null,
            telegram_group_id: telegram_group_id?.trim() || null
        });

        console.log(`✅ Branch updated successfully: ${branch.name}`);

        res.json({
            success: true,
            message: 'Branch updated successfully',
            branch
        });

    } catch (error) {
        console.error('❌ Error al actualizar branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error updating branch',
            error: error.message
        });
    }
};

// DELETE /api/branches/:id - Eliminar branch
exports.deleteBranch = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`🏢 Eliminando branch ID: ${id}`);

        const branch = await Branch.findByPk(id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
            });
        }

        // Verificar si tiene estimates asociados
        const estimatesCount = await Estimate.count({ where: { branch_id: id } });
        if (estimatesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot delete branch because it has ${estimatesCount} estimate(s) associated`
            });
        }

        // Eliminar relaciones con salespersons
        await SalesPersonBranch.destroy({ where: { branch_id: id } });

        // Eliminar la branch
        await branch.destroy();

        console.log(`✅ Branch deleted successfully: ${branch.name}`);

        res.json({
            success: true,
            message: 'Branch deleted successfully'
        });

    } catch (error) {
        console.error('❌ Error al eliminar branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error deleting branch',
            error: error.message
        });
    }
};

// POST /api/branches/:id/salespersons - Asignar salesperson a branch
exports.assignSalesPerson = async (req, res) => {
    try {
        const { id } = req.params;
        const { salesPersonId } = req.body;
        console.log(`🏢 Asignando salesperson ${salesPersonId} a branch ${id}`);

        // Verificar que la branch existe
        const branch = await Branch.findByPk(id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch not found'
            });
        }

        // Verificar que el salesperson existe
        const salesPerson = await SalesPerson.findByPk(salesPersonId);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson not found'
            });
        }

        // Verificar si ya está asignado
        const existingAssignment = await SalesPersonBranch.findOne({
            where: { sales_person_id: salesPersonId, branch_id: id }
        });

        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'Salesperson is already assigned to this branch'
            });
        }

        // Crear la asignación
        await SalesPersonBranch.create({
            sales_person_id: salesPersonId,
            branch_id: id
        });

        console.log(`✅ Salesperson assigned successfully`);

        res.status(201).json({
            success: true,
            message: 'Salesperson assigned successfully to the branch'
        });

    } catch (error) {
        console.error('❌ Error al asignar salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error assigning salesperson',
            error: error.message
        });
    }
};

// DELETE /api/branches/:id/salespersons/:salesPersonId - Remover salesperson de branch
exports.removeSalesPerson = async (req, res) => {
    try {
        const { id, salesPersonId } = req.params;
        console.log(`🏢 Removiendo salesperson ${salesPersonId} de branch ${id}`);

        const assignment = await SalesPersonBranch.findOne({
            where: { sales_person_id: salesPersonId, branch_id: id }
        });

        if (!assignment) {
            return res.status(404).json({
                success: false,
                message: 'Assignment not found'
            });
        }

        await assignment.destroy();

        console.log(`✅ Salesperson removed successfully from the branch`);

        res.json({
            success: true,
            message: 'Salesperson removed successfully from the branch'
        });

    } catch (error) {
        console.error('❌ Error removing salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error removing salesperson',
            error: error.message
        });
    }
};

// POST /api/branches/cleanup-duplicates - Limpiar branches duplicados
exports.cleanupDuplicates = async (req, res) => {
    try {
        console.log('🧹 Starting branch cleanup process...');
        
        const result = await cleanupDuplicateBranches();
        
        if (!result.success) {
            return res.status(500).json({
                success: false,
                message: 'Error during cleanup process',
                error: result.error
            });
        }
        
        if (result.duplicatesFound === 0) {
            return res.status(200).json({
                success: true,
                message: 'No duplicate branches found',
                result: {
                    duplicatesFound: 0,
                    duplicatesDeleted: 0
                }
            });
        }
        
        res.status(200).json({
            success: true,
            message: `Successfully cleaned up ${result.duplicatesDeleted} duplicate branches`,
            result: {
                duplicatesFound: result.duplicatesFound,
                duplicatesDeleted: result.duplicatesDeleted,
                consolidationMap: result.consolidationMap
            }
        });
        
    } catch (error) {
        console.error('❌ Error in cleanup duplicates:', error);
        res.status(500).json({
            success: false,
            message: 'Error cleaning up duplicate branches',
            error: error.message
        });
    }
}; 