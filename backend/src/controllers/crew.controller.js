const { CrewMember, Branch, CrewMemberBranch } = require('../models');
const { Op } = require('sequelize');

// GET /api/crew-members - Obtener todos los crew members
exports.getAllCrewMembers = async (req, res) => {
    try {
        console.log('👷 Obteniendo todos los crew members...');
        
        const { 
            page = 1, 
            limit = 10, 
            search = '',
            includeStats = false,
            branchId = null,
            isLeader = null
        } = req.query;

        const offset = (page - 1) * limit;
        const where = {};

        // Filtro de búsqueda
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Filtro por tipo de líder
        if (isLeader !== null) {
            where.is_leader = isLeader === 'true';
        }

        const includeOptions = [];
        
        // Siempre incluir branches usando la asociación directa
        if (includeStats === 'true') {
            includeOptions.push({
                model: Branch,
                as: 'branches',
                attributes: ['id', 'name'],
                through: {
                    where: branchId ? { branch_id: branchId } : undefined,
                    attributes: []
                },
                required: branchId ? true : false
            });
        } else if (branchId) {
            // Filtrar por branch sin incluir estadísticas
            includeOptions.push({
                model: Branch,
                as: 'branches',
                through: {
                    where: { branch_id: branchId },
                    attributes: []
                },
                required: true
            });
        }

        const { count, rows } = await CrewMember.findAndCountAll({
            where,
            include: includeOptions,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
            distinct: true
        });

        // Procesar estadísticas si se solicitan
        const crewMembersWithStats = includeStats === 'true' 
            ? rows.map(crewMember => {
                const crewMemberData = crewMember.toJSON();
                const branchesCount = crewMemberData.branches?.length || 0;
                
                return {
                    ...crewMemberData,
                    stats: {
                        branchesCount
                    }
                };
            })
            : rows.map(crewMember => crewMember.toJSON());

        console.log(`✅ ${rows.length} crew members encontrados`);
        console.log('Crew members data:', crewMembersWithStats.map(cm => ({ id: cm.id, name: cm.name, branches: cm.branches?.length || 0 })));

        res.json({
            crewMembers: crewMembersWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                hasNextPage: page < Math.ceil(count / limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener crew members:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener crew members',
            error: error.message
        });
    }
};

// GET /api/crew-members/:id - Obtener un crew member específico
exports.getCrewMemberById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👷 Obteniendo crew member ID: ${id}`);

        const crewMember = await CrewMember.findByPk(id, {
            include: [{
                model: Branch,
                as: 'branches',
                attributes: ['id', 'name', 'address'],
                through: { attributes: [] }
            }]
        });

        if (!crewMember) {
            return res.status(404).json({
                success: false,
                message: 'Crew member no encontrado'
            });
        }

        // Agregar estadísticas
        const crewMemberData = crewMember.toJSON();
        const branchesCount = crewMemberData.branches?.length || 0;

        const result = {
            ...crewMemberData,
            stats: {
                branchesCount
            }
        };

        console.log(`✅ Crew member encontrado: ${crewMember.name}`);
        res.json({
            success: true,
            crewMember: result
        });

    } catch (error) {
        console.error('❌ Error al obtener crew member:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener crew member',
            error: error.message
        });
    }
};

// POST /api/crew-members - Crear nuevo crew member
exports.createCrewMember = async (req, res) => {
    try {
        const { name, phone, telegram_id, is_leader = false, branchIds = [] } = req.body;
        console.log(`👷 Creando nuevo crew member: ${name}`);

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del crew member es requerido'
            });
        }

        // Verificar que no exista un crew member con el mismo nombre
        const existingCrewMember = await CrewMember.findOne({ where: { name } });
        if (existingCrewMember) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un crew member con ese nombre'
            });
        }

        // Verificar teléfono único si se proporciona
        if (phone) {
            const existingPhone = await CrewMember.findOne({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un crew member con ese número de teléfono'
                });
            }
        }

        // Verificar telegram_id único si se proporciona
        if (telegram_id) {
            const existingTelegram = await CrewMember.findOne({ where: { telegram_id } });
            if (existingTelegram) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un crew member con ese Telegram ID'
                });
            }
        }

        const crewMember = await CrewMember.create({
            name: name.trim(),
            phone: phone?.trim() || null,
            telegram_id: telegram_id?.trim() || null,
            is_leader: Boolean(is_leader)
        });

        // Asignar branches si se proporcionan
        if (branchIds.length > 0) {
            // Verificar que todas las branches existen
            const branches = await Branch.findAll({ where: { id: branchIds } });
            if (branches.length !== branchIds.length) {
                return res.status(400).json({
                    success: false,
                    message: 'Una o más branches no existen'
                });
            }

            // Crear las asignaciones
            const assignments = branchIds.map(branchId => ({
                crew_member_id: crewMember.id,
                branch_id: branchId
            }));
            await CrewMemberBranch.bulkCreate(assignments);
        }

        console.log(`✅ Crew member creado exitosamente: ${crewMember.name} (ID: ${crewMember.id})`);

        res.status(201).json({
            success: true,
            message: 'Crew member creado exitosamente',
            crewMember
        });

    } catch (error) {
        console.error('❌ Error al crear crew member:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear crew member',
            error: error.message
        });
    }
};

// PUT /api/crew-members/:id - Actualizar crew member
exports.updateCrewMember = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, phone, telegram_id, is_leader } = req.body;
        console.log(`👷 Actualizando crew member ID: ${id}`);

        const crewMember = await CrewMember.findByPk(id);
        if (!crewMember) {
            return res.status(404).json({
                success: false,
                message: 'Crew member no encontrado'
            });
        }

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del crew member es requerido'
            });
        }

        // Verificar que no exista otro crew member con el mismo nombre
        const existingCrewMember = await CrewMember.findOne({ 
            where: { 
                name,
                id: { [Op.ne]: id } 
            } 
        });
        if (existingCrewMember) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe otro crew member con ese nombre'
            });
        }

        // Verificar teléfono único si se proporciona
        if (phone) {
            const existingPhone = await CrewMember.findOne({ 
                where: { 
                    phone,
                    id: { [Op.ne]: id } 
                } 
            });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro crew member con ese número de teléfono'
                });
            }
        }

        // Verificar telegram_id único si se proporciona
        if (telegram_id) {
            const existingTelegram = await CrewMember.findOne({ 
                where: { 
                    telegram_id,
                    id: { [Op.ne]: id } 
                } 
            });
            if (existingTelegram) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe otro crew member con ese Telegram ID'
                });
            }
        }

        await crewMember.update({
            name: name.trim(),
            phone: phone?.trim() || null,
            telegram_id: telegram_id?.trim() || null,
            is_leader: is_leader !== undefined ? Boolean(is_leader) : crewMember.is_leader
        });

        console.log(`✅ Crew member actualizado exitosamente: ${crewMember.name}`);

        res.json({
            success: true,
            message: 'Crew member actualizado exitosamente',
            crewMember
        });

    } catch (error) {
        console.error('❌ Error al actualizar crew member:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar crew member',
            error: error.message
        });
    }
};

// DELETE /api/crew-members/:id - Eliminar crew member
exports.deleteCrewMember = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👷 Eliminando crew member ID: ${id}`);

        const crewMember = await CrewMember.findByPk(id);
        if (!crewMember) {
            return res.status(404).json({
                success: false,
                message: 'Crew member no encontrado'
            });
        }

        // Eliminar relaciones con branches
        await CrewMemberBranch.destroy({ where: { crew_member_id: id } });

        // Eliminar el crew member
        await crewMember.destroy();

        console.log(`✅ Crew member eliminado exitosamente: ${crewMember.name}`);

        res.json({
            success: true,
            message: 'Crew member eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar crew member:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar crew member',
            error: error.message
        });
    }
};

// GET /api/crew-members/:id/branches - Obtener branches de un crew member
exports.getCrewMemberBranches = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👷 Obteniendo branches del crew member ID: ${id}`);

        const crewMemberWithBranches = await CrewMember.findByPk(id, {
            include: [{
                model: Branch,
                as: 'branches',
                through: { attributes: [] }
            }]
        });

        if (!crewMemberWithBranches) {
            return res.status(404).json({
                success: false,
                message: 'Crew member no encontrado'
            });
        }

        const branches = crewMemberWithBranches.branches || [];

        console.log(`✅ ${branches.length} branches encontradas para ${crewMemberWithBranches.name}`);

        res.json({
            success: true,
            branches
        });

    } catch (error) {
        console.error('❌ Error al obtener branches del crew member:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener branches del crew member',
            error: error.message
        });
    }
};

// POST /api/crew-members/:id/branches - Asignar branches a crew member
exports.assignBranches = async (req, res) => {
    try {
        const { id } = req.params;
        const { branchIds } = req.body;
        console.log(`👷 Asignando branches ${branchIds} a crew member ${id}`);

        // Verificar que el crew member existe
        const crewMember = await CrewMember.findByPk(id);
        if (!crewMember) {
            return res.status(404).json({
                success: false,
                message: 'Crew member no encontrado'
            });
        }

        // Validar branchIds
        if (!Array.isArray(branchIds) || branchIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Se requiere un array de branch IDs'
            });
        }

        // Verificar que todas las branches existen
        const branches = await Branch.findAll({ where: { id: branchIds } });
        if (branches.length !== branchIds.length) {
            return res.status(400).json({
                success: false,
                message: 'Una o más branches no existen'
            });
        }

        // Eliminar asignaciones existentes
        await CrewMemberBranch.destroy({ where: { crew_member_id: id } });

        // Crear nuevas asignaciones
        const assignments = branchIds.map(branchId => ({
            crew_member_id: id,
            branch_id: branchId
        }));
        await CrewMemberBranch.bulkCreate(assignments);

        console.log(`✅ Branches asignadas exitosamente`);

        res.json({
            success: true,
            message: 'Branches asignadas exitosamente al crew member'
        });

    } catch (error) {
        console.error('❌ Error al asignar branches:', error);
        res.status(500).json({
            success: false,
            message: 'Error al asignar branches',
            error: error.message
        });
    }
}; 