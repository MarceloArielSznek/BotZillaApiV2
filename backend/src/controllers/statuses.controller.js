const { EstimateStatus, Estimate } = require('../models');
const { Op } = require('sequelize');

// GET /api/estimate-statuses - Obtener todos los estimate statuses
exports.getAllStatuses = async (req, res) => {
    try {
        console.log('📋 Obteniendo todos los estimate statuses...');
        
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
            where.name = { [Op.iLike]: `%${search}%` };
        }

        const includeOptions = [];
        
        // Incluir estadísticas si se solicita
        if (includeStats === 'true') {
            includeOptions.push({
                model: Estimate,
                attributes: ['id', 'price', 'at_created_date'],
                required: false
            });
        }

        const { count, rows } = await EstimateStatus.findAndCountAll({
            where,
            include: includeOptions,
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['name', 'ASC']],
            distinct: true
        });

        // Procesar estadísticas si se solicitan
        const statusesWithStats = includeStats === 'true' 
            ? rows.map(status => {
                const estimatesCount = status.Estimates?.length || 0;
                const totalRevenue = status.Estimates?.reduce((sum, est) => sum + (est.price || 0), 0) || 0;
                const recentEstimates = status.Estimates?.filter(est => 
                    new Date(est.at_created_date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                ).length || 0;
                
                return {
                    ...status.toJSON(),
                    stats: {
                        estimatesCount,
                        recentEstimates,
                        totalRevenue
                    }
                };
            })
            : rows;

        console.log(`✅ ${rows.length} estimate statuses encontrados`);

        res.json({
            statuses: statusesWithStats,
            pagination: {
                currentPage: parseInt(page),
                totalPages: Math.ceil(count / limit),
                totalCount: count,
                hasNextPage: page < Math.ceil(count / limit),
                hasPrevPage: page > 1
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener estimate statuses:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estimate statuses',
            error: error.message
        });
    }
};

// GET /api/estimate-statuses/:id - Obtener un estimate status específico
exports.getStatusById = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📋 Obteniendo estimate status con ID: ${id}`);

        const status = await EstimateStatus.findByPk(id, {
            include: [{
                model: Estimate,
                attributes: ['id', 'name', 'price', 'at_created_date'],
                include: [
                    { model: require('../models').SalesPerson, attributes: ['name'] },
                    { model: require('../models').Branch, attributes: ['name'] }
                ],
                limit: 20,
                order: [['at_created_date', 'DESC']]
            }]
        });

        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Estimate status no encontrado'
            });
        }

        // Calcular estadísticas avanzadas
        const estimates = status.Estimates || [];
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        
        const stats = {
            totalEstimates: estimates.length,
            recentEstimates: estimates.filter(est => new Date(est.at_created_date) >= thirtyDaysAgo).length,
            weeklyEstimates: estimates.filter(est => new Date(est.at_created_date) >= sevenDaysAgo).length,
            totalRevenue: estimates.reduce((sum, est) => sum + (est.price || 0), 0),
            averageValue: estimates.length > 0 ? estimates.reduce((sum, est) => sum + (est.price || 0), 0) / estimates.length : 0
        };

        console.log(`✅ Estimate status encontrado: ${status.name}`);

        res.json({
            ...status.toJSON(),
            stats
        });

    } catch (error) {
        console.error('❌ Error al obtener estimate status:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener estimate status',
            error: error.message
        });
    }
};

// POST /api/estimate-statuses - Crear nuevo estimate status
exports.createStatus = async (req, res) => {
    try {
        const { name } = req.body;
        console.log(`📋 Creando nuevo estimate status: ${name}`);

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del status es requerido'
            });
        }

        // Verificar que no exista un status con el mismo nombre
        const existingStatus = await EstimateStatus.findOne({ 
            where: { name: name.trim() } 
        });
        if (existingStatus) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe un status con ese nombre'
            });
        }

        const status = await EstimateStatus.create({
            name: name.trim()
        });

        console.log(`✅ Estimate status creado exitosamente: ${status.name} (ID: ${status.id})`);

        res.status(201).json({
            success: true,
            message: 'Estimate status creado exitosamente',
            status
        });

    } catch (error) {
        console.error('❌ Error al crear estimate status:', error);
        res.status(500).json({
            success: false,
            message: 'Error al crear estimate status',
            error: error.message
        });
    }
};

// PUT /api/estimate-statuses/:id - Actualizar estimate status
exports.updateStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        console.log(`📋 Actualizando estimate status ID: ${id}`);

        const status = await EstimateStatus.findByPk(id);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Estimate status no encontrado'
            });
        }

        // Validaciones
        if (!name) {
            return res.status(400).json({
                success: false,
                message: 'El nombre del status es requerido'
            });
        }

        // Verificar que no exista otro status con el mismo nombre
        const existingStatus = await EstimateStatus.findOne({ 
            where: { 
                name: name.trim(),
                id: { [Op.ne]: id } 
            } 
        });
        if (existingStatus) {
            return res.status(400).json({
                success: false,
                message: 'Ya existe otro status con ese nombre'
            });
        }

        await status.update({
            name: name.trim()
        });

        console.log(`✅ Estimate status actualizado exitosamente: ${status.name}`);

        res.json({
            success: true,
            message: 'Estimate status actualizado exitosamente',
            status
        });

    } catch (error) {
        console.error('❌ Error al actualizar estimate status:', error);
        res.status(500).json({
            success: false,
            message: 'Error al actualizar estimate status',
            error: error.message
        });
    }
};

// DELETE /api/estimate-statuses/:id - Eliminar estimate status
exports.deleteStatus = async (req, res) => {
    try {
        const { id } = req.params;
        console.log(`📋 Eliminando estimate status ID: ${id}`);

        const status = await EstimateStatus.findByPk(id);
        if (!status) {
            return res.status(404).json({
                success: false,
                message: 'Estimate status no encontrado'
            });
        }

        // Verificar si tiene estimates asociados
        const estimatesCount = await Estimate.count({ where: { status_id: id } });
        if (estimatesCount > 0) {
            return res.status(400).json({
                success: false,
                message: `No se puede eliminar el status porque tiene ${estimatesCount} estimate(s) asociado(s)`
            });
        }

        // Eliminar el status
        await status.destroy();

        console.log(`✅ Estimate status eliminado exitosamente: ${status.name}`);

        res.json({
            success: true,
            message: 'Estimate status eliminado exitosamente'
        });

    } catch (error) {
        console.error('❌ Error al eliminar estimate status:', error);
        res.status(500).json({
            success: false,
            message: 'Error al eliminar estimate status',
            error: error.message
        });
    }
};

// GET /api/estimate-statuses/analytics - Obtener analytics de statuses
exports.getStatusAnalytics = async (req, res) => {
    try {
        console.log('📋 Obteniendo analytics de estimate statuses...');

        const { 
            startDate, 
            endDate,
            groupBy = 'status' // 'status', 'month', 'week'
        } = req.query;

        const whereConditions = {};
        
        if (startDate && endDate) {
            whereConditions.at_created_date = {
                [Op.between]: [new Date(startDate), new Date(endDate)]
            };
        } else if (startDate) {
            whereConditions.at_created_date = {
                [Op.gte]: new Date(startDate)
            };
        } else if (endDate) {
            whereConditions.at_created_date = {
                [Op.lte]: new Date(endDate)
            };
        }

        const statuses = await EstimateStatus.findAll({
            include: [{
                model: Estimate,
                attributes: ['id', 'price', 'at_created_date'],
                where: Object.keys(whereConditions).length > 0 ? whereConditions : undefined,
                required: false
            }],
            order: [['name', 'ASC']]
        });

        const analytics = statuses.map(status => {
            const estimates = status.Estimates || [];
            return {
                statusId: status.id,
                statusName: status.name,
                totalEstimates: estimates.length,
                totalRevenue: estimates.reduce((sum, est) => sum + (est.price || 0), 0),
                averageValue: estimates.length > 0 ? estimates.reduce((sum, est) => sum + (est.price || 0), 0) / estimates.length : 0,
                percentage: 0 // Se calculará después
            };
        });

        // Calcular porcentajes
        const totalEstimates = analytics.reduce((sum, item) => sum + item.totalEstimates, 0);
        analytics.forEach(item => {
            item.percentage = totalEstimates > 0 ? (item.totalEstimates / totalEstimates) * 100 : 0;
        });

        console.log(`✅ Analytics generados para ${statuses.length} statuses`);

        res.json({
            analytics,
            summary: {
                totalStatuses: statuses.length,
                totalEstimates,
                totalRevenue: analytics.reduce((sum, item) => sum + item.totalRevenue, 0),
                period: {
                    startDate: startDate || 'all',
                    endDate: endDate || 'all'
                }
            }
        });

    } catch (error) {
        console.error('❌ Error al obtener analytics:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener analytics de statuses',
            error: error.message
        });
    }
}; 