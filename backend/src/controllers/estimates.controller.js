const { Op } = require('sequelize');
const { Estimate, SalesPerson, Branch, EstimateStatus } = require('../models');

// Función para transformar la estructura de los datos para el frontend
const transformEstimateForFrontend = (estimate) => {
    const plainEstimate = estimate.get({ plain: true });
    return {
        ...plainEstimate,
        SalesPerson: plainEstimate.salesperson,
        Branch: plainEstimate.branch,
        EstimateStatus: plainEstimate.status,
        salesperson: undefined, // Limpiar para no enviar datos duplicados
        branch: undefined,
        status: undefined
    };
};


class EstimatesController {
    
    // Obtener todos los estimates con filtros y paginación
    async getAllEstimates(req, res) {
        try {
            const { page = 1, limit = 10, status, branch, salesperson, sort_by, sort_order } = req.query;
            const offset = (page - 1) * limit;

            const whereClause = {};
            if (status) whereClause.status_id = status;
            if (branch) whereClause.branch_id = branch;
            if (salesperson) whereClause.sales_person_id = salesperson;

            const orderClause = [];
            if (sort_by) {
                orderClause.push([sort_by, sort_order === 'desc' ? 'DESC' : 'ASC']);
            }

            const estimates = await Estimate.findAndCountAll({
                where: whereClause,
                include: [
                    { model: SalesPerson, as: 'salesperson', attributes: ['name'] },
                    { model: Branch, as: 'branch', attributes: ['name'] },
                    { model: EstimateStatus, as: 'status', attributes: ['name'] }
                ],
                limit: parseInt(limit),
                offset: offset,
                order: orderClause
            });

            const transformedData = estimates.rows.map(transformEstimateForFrontend);

            res.json({
                total: estimates.count,
                pages: Math.ceil(estimates.count / limit),
                currentPage: parseInt(page),
                data: transformedData
            });
        } catch (error) {
            res.status(500).json({ message: 'Error fetching estimates', error: error.message });
        }
    }

    // Obtener detalles de un estimate específico
    async getEstimateDetails(req, res) {
        try {
            const estimate = await Estimate.findByPk(req.params.id, {
                include: [
                    { model: SalesPerson, as: 'salesperson' },
                    { model: Branch, as: 'branch' },
                    { model: EstimateStatus, as: 'status' }
                ]
            });

            if (!estimate) {
                return res.status(404).json({ message: 'Estimate not found' });
            }
            
            const transformedEstimate = transformEstimateForFrontend(estimate);
            res.json(transformedEstimate);

    } catch (error) {
            res.status(500).json({ message: 'Error fetching estimate details', error: error.message });
        }
    }
}

module.exports = new EstimatesController();

 