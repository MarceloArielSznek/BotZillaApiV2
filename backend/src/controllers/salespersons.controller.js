const { SalesPerson, Branch, SalesPersonBranch, Estimate, EstimateStatus } = require('../models');
const { Op } = require('sequelize');
const sequelize = require('../config/database');
const { caches } = require('../utils/cache'); // Importar caches

// GET /api/salespersons - Obtener todos los salespersons
exports.getAllSalesPersons = async (req, res) => {
    try {
        console.log('👤 Obteniendo todos los salespersons...');
        
        const { 
            page = 1, 
            limit = 10, 
            search = '',
            includeStats = false,
            branchId = null,
            hasTelegram = null, // 'true', 'false', o null para ambos
            minWarnings = null,
            maxWarnings = null,
            include_inactive = false
        } = req.query;

        // Convertir include_inactive a booleano
        const shouldIncludeInactive = include_inactive === 'true' || include_inactive === true;

        const offset = (page - 1) * limit;
        const where = {};

        // Por defecto, solo mostrar los activos
        if (!shouldIncludeInactive) {
            where.is_active = true;
        }

        // Filtro de búsqueda
        if (search) {
            where[Op.or] = [
                { name: { [Op.iLike]: `%${search}%` } },
                { phone: { [Op.iLike]: `%${search}%` } }
            ];
        }

        // Filtro por telegram_id
        if (hasTelegram !== null) {
            if (hasTelegram === 'true') {
                where.telegram_id = { [Op.not]: null };
            } else if (hasTelegram === 'false') {
                where.telegram_id = { [Op.is]: null };
            }
        }

        // Filtro por warning_count
        if (minWarnings !== null || maxWarnings !== null) {
            where.warning_count = {};
            if (minWarnings !== null) {
                where.warning_count[Op.gte] = parseInt(minWarnings);
            }
            if (maxWarnings !== null) {
                where.warning_count[Op.lte] = parseInt(maxWarnings);
            }
        }

        // Filtro por branch usando subquery para evitar problemas con Sequelize
        if (branchId && branchId !== '' && branchId !== null && branchId !== undefined) {
            where.id = {
                [Op.in]: sequelize.literal(`(
                    SELECT sales_person_id 
                    FROM botzilla.sales_person_branch 
                    WHERE branch_id = ${parseInt(branchId)}
                )`)
            };
        }

        const includeOptions = [];
        
        // Siempre incluir branches usando la relación directa many-to-many
        includeOptions.push({
            model: Branch,
            as: 'branches',
            attributes: ['id', 'name'],
            through: { attributes: [] }, // No incluir atributos de la tabla intermedia
            required: false
        });

        // Subquery para contar los leads activos
        const activeLeadsSubquery = `(
            SELECT COUNT(*)
            FROM "botzilla"."estimate" AS "e"
            INNER JOIN "botzilla"."estimate_status" AS "s" ON "e"."status_id" = "s"."id"
            WHERE "e"."sales_person_id" = "SalesPerson"."id"
            AND "s"."name" IN ('In Progress', 'Released')
        )`;

        const { count, rows } = await SalesPerson.findAndCountAll({
            where,
            include: includeOptions,
            attributes: {
                include: [
                    [sequelize.literal(activeLeadsSubquery), 'activeLeadsCount']
                ]
            },
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
            distinct: true
        });

        // El mapeo ya no es necesario para los conteos, Sequelize los añade directamente.
        const salesPersons = rows.map(sp => sp.toJSON());

        console.log(`✅ ${rows.length} salespersons encontrados`);

        res.json({
            salespersons: salesPersons,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                hasNextPage: page < Math.ceil(count / limit),
                hasPrevPage: page > 1
            },
            // Agregar información de filtros aplicados
            filters: {
                search: search || null,
                branchId: branchId || null,
                hasTelegram: hasTelegram || null,
                minWarnings: minWarnings || null,
                maxWarnings: maxWarnings || null
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener salespersons:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener salespersons',
            error: error.message
        });
    }
};

// GET /api/salespersons/:id - Obtener un salesperson específico
exports.getSalesPersonById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👤 Obteniendo salesperson con ID: ${id}`);

        const salesPerson = await SalesPerson.findByPk(id, {
            include: [
                {
                    model: Branch,
                    as: 'branches', // Alias para la asociación
                    attributes: ['id', 'name', 'address'] 
                },
                {
                    model: Estimate,
                    as: 'estimates', // Alias para la asociación
                    attributes: ['id', 'name', 'price', 'created_at'],
                    include: [
                        { model: Branch, as: 'branch', attributes: ['name'] },
                        { model: EstimateStatus, as: 'status', attributes: ['id', 'name'] }
                    ],
                    limit: 20,
                    order: [['created_at', 'DESC']]
                }
            ]
        });

        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        // Calcular estadísticas avanzadas
        const estimates = salesPerson.estimates || [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        // Extraer branches de la relación SalesPersonBranches
        const branches = salesPerson.branches || [];
        
        const stats = {
            branchesCount: salesPerson.branches?.length || 0,
            totalEstimates: estimates.length,
            activeEstimates: estimates.filter(est => 
                est.status && (est.status.name === 'In Progress' || est.status.name === 'Released')
            ).length,
            recentEstimates: estimates.filter(est => new Date(est.created_at) >= sevenDaysAgo).length,
            totalRevenue: estimates.reduce((sum, est) => sum + (parseFloat(est.price) || 0), 0),
            needsWarning: estimates.filter(est => 
                est.status && (est.status.name === 'In Progress' || est.status.name === 'Released')
            ).length >= 12,
            warningCount: salesPerson.warning_count
        };

        console.log(`✅ Salesperson encontrado: ${salesPerson.name}`);

        res.json({
            ...salesPerson.toJSON(),
            branches, // Agregar los branches extraídos
            stats
        });

    } catch (error) {
        console.error('❌ Error al obtener salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener salesperson',
            error: error.message
        });
    }
};

// POST /api/salespersons - Crear nuevo salesperson
exports.createSalesPerson = async (req, res) => {
    try {
        const { name, phone, telegram_id, branchIds = [] } = req.body;
        console.log(`👤 Creando nuevo salesperson: ${name}`);

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del salesperson es requerido'
            });
        }

        // Verificar que no exista un salesperson con el mismo nombre
        const existingSalesPerson = await SalesPerson.findOne({ where: { name } });
        if (existingSalesPerson) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un salesperson con ese nombre'
            });
        }

        // Verificar teléfono único si se proporciona
        if (phone) {
            const existingPhone = await SalesPerson.findOne({ where: { phone } });
            if (existingPhone) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un salesperson con ese número de teléfono'
                });
            }
        }

        // Verificar telegram_id único si se proporciona
        if (telegram_id) {
            const existingTelegram = await SalesPerson.findOne({ where: { telegram_id } });
            if (existingTelegram) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un salesperson con ese Telegram ID'
                });
            }
        }

        const salesPerson = await SalesPerson.create({
            name: name.trim(),
            phone: phone?.trim() || null,
            telegram_id: telegram_id?.trim() || null,
            warning_count: 0
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
                sales_person_id: salesPerson.id,
                branch_id: branchId
            }));
            await SalesPersonBranch.bulkCreate(assignments);
        }

        console.log(`✅ Salesperson creado exitosamente: ${salesPerson.name} (ID: ${salesPerson.id})`);

        res.status(201).json({
            success: true,
            message: 'Salesperson creado exitosamente',
            salesPerson
        });

    } catch (error) {
        console.error('❌ Error al crear salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear salesperson',
            error: error.message
        });
    }
};

// PUT /api/salespersons/:id - Actualizar salesperson
exports.updateSalesPerson = async (req, res) => {
    const { id } = req.params;
    const { name, phone, telegram_id, warning_count, is_active, branchIds } = req.body; // Añadir branchIds
    console.log(`[UPDATE] Received request for salesperson ID: ${id}. Body:`, JSON.stringify(req.body, null, 2));

    const t = await sequelize.transaction(); // Iniciar transacción

    try {
        const salesPerson = await SalesPerson.findByPk(id, { transaction: t });
        if (!salesPerson) {
            await t.rollback();
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        // --- Validaciones (igual que antes) ---
        if (name) {
            const existingSalesPerson = await SalesPerson.findOne({ 
                where: { name, id: { [Op.ne]: id } },
                transaction: t 
            });
            if (existingSalesPerson) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Ya existe otro salesperson con ese nombre' });
            }
        }
        if (phone) {
            const existingPhone = await SalesPerson.findOne({ 
                where: { phone, id: { [Op.ne]: id } },
                transaction: t
            });
            if (existingPhone) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Ya existe otro salesperson con ese número de teléfono' });
            }
        }
        if (telegram_id) {
            const existingTelegram = await SalesPerson.findOne({ 
                where: { telegram_id, id: { [Op.ne]: id } },
                transaction: t
            });
            if (existingTelegram) {
                await t.rollback();
                return res.status(400).json({ success: false, message: 'Ya existe otro salesperson con ese Telegram ID' });
            }
        }
        // --- Fin Validaciones ---

        // Actualizar los campos del salesperson
        const updateData = {};
        if (name !== undefined) updateData.name = name.trim();
        if (phone !== undefined) updateData.phone = phone?.trim() || null;
        if (telegram_id !== undefined) updateData.telegram_id = telegram_id?.trim() || null;
        if (warning_count !== undefined) updateData.warning_count = parseInt(warning_count);
        if (is_active !== undefined) updateData.is_active = is_active;

        await salesPerson.update(updateData, { transaction: t });

        // Actualizar las asignaciones de sucursales si se proporciona el array branchIds
        if (branchIds && Array.isArray(branchIds)) {
            console.log(`🔄 Actualizando branches para salesperson ${id}:`, branchIds);

            // Verificar que todas las branches existen
            const branches = await Branch.findAll({ where: { id: branchIds }, transaction: t });
            if (branches.length !== branchIds.length) {
                await t.rollback();
                return res.status(400).json({
                    success: false,
                    message: 'Una o más de las branches proporcionadas no existen.'
                });
            }

            // Usar setBranches para manejar las asociaciones automáticamente
            // Esto eliminará las antiguas y creará las nuevas.
            await salesPerson.setBranches(branches, { transaction: t });
            console.log(`✅ Branches actualizadas para ${salesPerson.name}`);
        }

        await t.commit(); // Confirmar la transacción

        // Forzar la limpieza de todo el caché relacionado a salespersons
        Object.values(caches).forEach(cache => {
            cache.deletePattern('salesperson');
        });
        console.log('🧹 All salesperson-related cache cleared.');

        const updatedSalesPerson = await SalesPerson.findByPk(id, {
            include: [{ model: Branch, as: 'branches', through: { attributes: [] } }]
        });

        console.log(`✅ Salesperson actualizado exitosamente: ${updatedSalesPerson.name}`);

        res.json({
            success: true,
            message: 'Salesperson actualizado exitosamente',
            salesPerson: updatedSalesPerson
        });

    } catch (error) {
        await t.rollback(); // Revertir la transacción en caso de error
        console.error('❌ Error al actualizar salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar salesperson',
            error: error.message
        });
    }
};

// DELETE /api/salespersons/:id - Eliminar salesperson
exports.deleteSalesPerson = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👤 Eliminando salesperson ID: ${id}`);

        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        // Verificar si tiene estimates asociados
        const estimatesCount = await Estimate.count({ where: { sales_person_id: id } });
        if (estimatesCount > 0) {
            // Si tiene estimates, hacer soft delete (marcar como inactivo)
            await salesPerson.update({ is_active: false });
            
            console.log(`✅ Salesperson marcado como inactivo (soft delete): ${salesPerson.name} - ${estimatesCount} estimates asociados`);
            
            return res.json({
                success: true,
                message: `Salesperson desactivado exitosamente. Se mantuvieron ${estimatesCount} estimate(s) asociado(s)`,
                action: 'deactivated'
            });
        }

        // Si no tiene estimates, eliminar completamente
        // Eliminar relaciones con branches
        await SalesPersonBranch.destroy({ where: { sales_person_id: id } });

        // Eliminar el salesperson
        await salesPerson.destroy();

        console.log(`✅ Salesperson eliminado exitosamente: ${salesPerson.name}`);

        res.json({
            success: true,
            message: 'Salesperson eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar salesperson',
            error: error.message
        });
    }
};

// POST /api/salespersons/:id/branches - Asignar branches a salesperson
exports.assignBranches = async (req, res) => {
    try {
        const { id } = req.params;
        const { branchIds } = req.body;
        console.log(`👤 Asignando branches ${branchIds} a salesperson ${id}`);

        // Verificar que el salesperson existe
        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
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
        await SalesPersonBranch.destroy({ where: { sales_person_id: id } });

        // Crear nuevas asignaciones
        const assignments = branchIds.map(branchId => ({
            sales_person_id: id,
            branch_id: branchId
        }));
        await SalesPersonBranch.bulkCreate(assignments);

        console.log(`✅ Branches asignadas exitosamente`);

        res.json({
            success: true,
            message: 'Branches asignadas exitosamente al salesperson'
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

// GET /api/salespersons/:id/branches - Obtener branches de un salesperson
exports.getSalesPersonBranches = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👤 Obteniendo branches de salesperson ${id}`);

        const salesPerson = await SalesPerson.findByPk(id, {
            include: [{
                model: Branch,
                as: 'branches', // Alias para la asociación
                attributes: ['id', 'name', 'address'],
                through: { attributes: [] }
            }]
        });

        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        const branches = salesPerson.branches || [];

        console.log(`✅ ${branches.length} branches encontradas para el salesperson`);

        res.json({
            salesPerson: {
                id: salesPerson.id,
                name: salesPerson.name
            },
            branches
        });

    } catch (error) {
        console.error('❌ Error al obtener branches del salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener branches del salesperson',
            error: error.message
        });
    }
};

// POST /api/salespersons/:id/warning - Incrementar warning count
exports.incrementWarning = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`👤 Incrementando warning para salesperson ${id}`);

        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        await salesPerson.increment('warning_count');

        console.log(`✅ Warning incrementado para ${salesPerson.name} (Total: ${salesPerson.warning_count + 1})`);

        res.json({
            success: true,
            message: 'Warning incrementado exitosamente',
            warningCount: salesPerson.warning_count + 1
        });

    } catch (error) {
        console.error('❌ Error al incrementar warning:', error);
        res.status(500).json({
            success: false,
            message: 'Error al incrementar warning',
            error: error.message
        });
    }
}; 

// GET /api/salespersons/:id/active-estimates - Obtener los estimates activos de un salesperson
exports.getActiveEstimates = async (req, res) => {
    try {
        const { id } = req.params;
        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson) {
            return res.status(404).json({ success: false, message: 'Salesperson no encontrado' });
        }

        const activeEstimates = await Estimate.findAll({
            where: { sales_person_id: id },
            include: [{
                model: EstimateStatus,
                as: 'status',
                where: { name: ['In Progress', 'Released'] },
                attributes: ['name']
            }],
            order: [['at_updated_date', 'DESC']]
        });

        res.json(activeEstimates);
    } catch (error) {
        console.error('❌ Error al obtener estimates activos:', error);
        res.status(500).json({ success: false, message: 'Error al obtener estimates activos', error: error.message });
    }
};

// POST /api/salespersons/:id/send-report - Enviar reporte de estimates activos
exports.sendActiveEstimatesReport = async (req, res) => {
    try {
        const { id } = req.params;
        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson || !salesPerson.telegram_id) {
            return res.status(404).json({ success: false, message: 'Salesperson no encontrado o sin Telegram ID' });
        }

        const activeEstimates = await Estimate.findAll({
            where: { sales_person_id: id },
            include: [{
                model: EstimateStatus,
                as: 'status',
                where: { name: ['In Progress', 'Released'] },
            }],
            order: [['at_updated_date', 'DESC']]
        });
        
        if (activeEstimates.length === 0) {
            return res.status(200).json({ 
                success: true, 
                message: "No active estimates to report.",
                notification: {
                    recipient_telegram_id: salesPerson.telegram_id,
                    message_text: `¡Hola ${salesPerson.name}!\n\nNo tienes ningún lead activo en este momento. ¡Buen trabajo!`
                }
            });
        }
        
        const estimateList = activeEstimates.map((est, index) => {
            const updatedDate = new Date(est.at_updated_date).toLocaleDateString();
            return `${index + 1}. <b>${est.name}</b>\n   Status: ${est.status.name}\n   Updated: ${updatedDate}`;
        }).join('\n\n');

        const messageText = `Hola ${salesPerson.name},\n\nAquí tienes un resumen de tus leads activos:\n\n${estimateList}\n\n– Botzilla 🤖🦖`;

        const notificationPayload = {
            recipient_telegram_id: salesPerson.telegram_id,
            message_text: messageText
        };

        // En un futuro, aquí se podría añadir la lógica para enviar directamente desde aquí.
        // Por ahora, devolvemos el payload para que Make.com lo procese.
        res.status(200).json({ 
            success: true, 
            message: "Report payload generated successfully.",
            notification: notificationPayload
        });

    } catch (error) {
        console.error('❌ Error al generar el reporte:', error);
        res.status(500).json({ success: false, message: 'Error al generar el reporte', error: error.message });
    }
};

// PATCH /api/salespersons/:id/status - Activar/desactivar un salesperson
exports.toggleSalesPersonStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;

        if (typeof is_active !== 'boolean') {
            return res.status(400).json({
                success: false,
                message: 'El campo "is_active" es requerido y debe ser un booleano (true/false).'
            });
        }

        const salesPerson = await SalesPerson.findByPk(id);
        if (!salesPerson) {
            return res.status(404).json({
                success: false,
                message: 'Salesperson no encontrado'
            });
        }

        await salesPerson.update({ is_active });

        const status = is_active ? 'activado' : 'desactivado';
        console.log(`✅ Salesperson ${status} exitosamente: ${salesPerson.name}`);

        res.json({
            success: true,
            message: `Salesperson ${status} exitosamente`,
            salesPerson
        });

    } catch (error) {
        console.error('❌ Error al cambiar el estado del salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al cambiar el estado del salesperson',
            error: error.message
        });
    }
};
// POST /api/salespersons/:salespersonId/branches/:branchId - Añadir una branch a un salesperson
exports.addBranchToSalesperson = async (req, res) => {
    const { salespersonId, branchId } = req.params;
    try {
        const salesPerson = await SalesPerson.findByPk(salespersonId);
        if (!salesPerson) {
            return res.status(404).json({ success: false, message: 'Salesperson no encontrado' });
        }

        const branch = await Branch.findByPk(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch no encontrada' });
        }

        await salesPerson.addBranch(branch);

        res.json({ success: true, message: 'Branch añadida al salesperson exitosamente' });

    } catch (error) {
        console.error('❌ Error al añadir branch al salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al añadir branch al salesperson',
            error: error.message
        });
    }
};

// DELETE /api/salespersons/:salespersonId/branches/:branchId - Eliminar una branch de un salesperson
exports.removeBranchFromSalesperson = async (req, res) => {
    const { salespersonId, branchId } = req.params;
    try {
        const salesPerson = await SalesPerson.findByPk(salespersonId);
        if (!salesPerson) {
            return res.status(404).json({ success: false, message: 'Salesperson no encontrado' });
        }

        const branch = await Branch.findByPk(branchId);
        if (!branch) {
            return res.status(404).json({ success: false, message: 'Branch no encontrada' });
        }

        await salesPerson.removeBranch(branch);

        res.json({ success: true, message: 'Branch eliminada del salesperson exitosamente' });

    } catch (error) {
        console.error('❌ Error al eliminar branch del salesperson:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar branch del salesperson',
            error: error.message
        });
    }
};

