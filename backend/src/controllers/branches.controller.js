const { Branch, SalesPersonBranch, SalesPerson, Estimate } = require('../models');
const { Op } = require('sequelize');

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
            message: 'Error al obtener branches',
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
                    attributes: ['id', 'name', 'price', 'created_date'],
                    limit: 10,
                    order: [['created_date', 'DESC']]
                }
            ]
        });

        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch no encontrada'
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
            message: 'Error al obtener branch',
            error: error.message
        });
    }
};

// POST /api/branches - Crear nueva branch
exports.createBranch = async (req, res) => {
    try {
        const { name, address } = req.body;
        console.log(`🏢 Creando nueva branch: ${name}`);

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la branch es requerido'
            });
        }

        // Verificar que no exista una branch con el mismo nombre
        const existingBranch = await Branch.findOne({ where: { name } });
        if (existingBranch) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe una branch con ese nombre'
            });
        }

        const branch = await Branch.create({
            name: name.trim(),
            address: address?.trim() || null
        });

        console.log(`✅ Branch creada exitosamente: ${branch.name} (ID: ${branch.id})`);

        res.status(201).json({
            success: true,
            message: 'Branch creada exitosamente',
            branch
        });

    } catch (error) {
        console.error('❌ Error al crear branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear branch',
            error: error.message
        });
    }
};

// PUT /api/branches/:id - Actualizar branch
exports.updateBranch = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, address } = req.body;
        console.log(`🏢 Actualizando branch ID: ${id}`);

        const branch = await Branch.findByPk(id);
        if (!branch) {
            return res.status(404).json({
                success: false,
                message: 'Branch no encontrada'
            });
        }

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre de la branch es requerido'
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
                message: 'Ya existe otra branch con ese nombre'
            });
        }

        await branch.update({
            name: name.trim(),
            address: address?.trim() || null
        });

        console.log(`✅ Branch actualizada exitosamente: ${branch.name}`);

        res.json({
            success: true,
            message: 'Branch actualizada exitosamente',
            branch
        });

    } catch (error) {
        console.error('❌ Error al actualizar branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar branch',
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
                message: 'Branch no encontrada'
            });
        }

        // Verificar si tiene estimates asociados
        const estimatesCount = await Estimate.count({ where: { branch_id: id } });
        if (estimatesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar la branch porque tiene ${estimatesCount} estimate(s) asociado(s)`
            });
        }

        // Eliminar relaciones con salespersons
        await SalesPersonBranch.destroy({ where: { branch_id: id } });

        // Eliminar la branch
        await branch.destroy();

        console.log(`✅ Branch eliminada exitosamente: ${branch.name}`);

        res.json({
            success: true,
            message: 'Branch eliminada exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar branch:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar branch',
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
                message: 'Branch no encontrada'
            });
        }

        // Verificar que el salesperson existe
        const salesPerson = await SalesPerson.findByPk(salesPersonId);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        // Verificar si ya está asignado
        const existingAssignment = await SalesPersonBranch.findOne({
            where: { sales_person_id: salesPersonId, branch_id: id }
        });

        if (existingAssignment) {
            return res.status(400).json({
                success: false,
                message: 'El salesperson ya está asignado a esta branch'
            });
        }

        // Crear la asignación
        await SalesPersonBranch.create({
            sales_person_id: salesPersonId,
            branch_id: id
        });

        console.log(`✅ Salesperson asignado exitosamente`);

        res.status(201).json({
            success: true,
            message: 'Salesperson asignado exitosamente a la branch'
        });

    } catch (error) {
        console.error('❌ Error al asignar salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar salesperson',
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
                message: 'Asignación no encontrada'
            });
        }

        await assignment.destroy();

        console.log(`✅ Salesperson removido exitosamente de la branch`);

        res.json({
            success: true,
            message: 'Salesperson removido exitosamente de la branch'
        });

    } catch (error) {
        console.error('❌ Error al remover salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al remover salesperson',
            error: error.message
        });
    }
}; 