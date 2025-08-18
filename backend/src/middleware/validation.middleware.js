const Joi = require('joi');

// Función helper para crear middleware de validación
const createValidationMiddleware = (schema, source = 'body') => {
    return (req, res, next) => {
        const dataToValidate = source === 'body' ? req.body : 
                              source === 'params' ? req.params : 
                              source === 'query' ? req.query : req.body;

        const { error, value } = schema.validate(dataToValidate, {
            abortEarly: false, // Mostrar todos los errores
            stripUnknown: true, // Remover campos no definidos en el schema
            allowUnknown: false // No permitir campos extras
        });

        if (error) {
            const errorDetails = error.details.map(detail => ({
                field: detail.path.join('.'),
                message: detail.message,
                value: detail.context?.value
            }));

            return res.status(400).json({
                success: false,
                message: 'Invalid input data',
                errors: errorDetails
            });
        }

        // Reemplazar los datos originales con los validados/sanitizados
        if (source === 'body') req.body = value;
        else if (source === 'params') req.params = value;
        else if (source === 'query') req.query = value;

        next();
    };
};

// Schema base para paginación
const paginationSchema = Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(1000).default(10),
    search: Joi.string().trim().allow('').optional(),
    includeStats: Joi.boolean().default(false)
});

// Schema para IDs en parámetros
const idParamSchema = Joi.object({
    id: Joi.number().integer().positive().required()
});

// Schemas para Branch
const branchSchemas = {
    create: Joi.object({
        name: Joi.string().trim().min(2).max(100).required()
            .messages({
                'string.empty': 'Branch name is required',
                'string.min': 'Name must be at least 2 characters',
                'string.max': 'Name cannot exceed 100 characters'
            }),
        address: Joi.string().trim().max(255).allow('').optional()
            .messages({
                'string.max': 'Address cannot exceed 255 characters'
            }),
        telegram_group_id: Joi.string().trim().max(100).allow('').optional()
            .messages({
                'string.max': 'Telegram Group ID cannot exceed 100 characters'
            })
    }),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        address: Joi.string().trim().max(255).allow('').optional(),
        telegram_group_id: Joi.string().trim().max(100).allow('').optional()
    }),

    list: paginationSchema,

    assignSalesPerson: Joi.object({
        salesPersonId: Joi.number().integer().positive().required()
            .messages({
                'number.base': 'Salesperson ID must be a number',
                'number.positive': 'Salesperson ID must be positive',
                'any.required': 'Salesperson ID is required'
            })
    })
};

// Schemas para SalesPerson
const salesPersonSchemas = {
    create: Joi.object({
        name: Joi.string().trim().min(2).max(100).required()
            .messages({
                'string.empty': 'Salesperson name is required',
                'string.min': 'Name must be at least 2 characters',
                'string.max': 'Name cannot exceed 100 characters'
            }),
        phone: Joi.string().trim().pattern(/^\+?[\d\s\-()]+$/).max(20).allow('').optional()
            .messages({
                'string.pattern.base': 'Phone format is not valid',
                'string.max': 'Phone cannot exceed 20 characters'
            }),
        telegram_id: Joi.string().trim().max(50).allow('').optional()
            .messages({
                'string.max': 'Telegram ID cannot exceed 50 characters'
            }),
        branchIds: Joi.array().items(Joi.number().integer().positive()).unique().optional()
            .messages({
                'array.unique': 'Cannot assign duplicate branches'
            })
    }),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(100).required(),
        phone: Joi.string().trim().pattern(/^\+?[\d\s\-()]+$/).max(20).allow('').optional(),
        telegram_id: Joi.string().trim().max(50).allow('').optional(),
        warning_count: Joi.number().integer().min(0).optional()
    }),

    list: paginationSchema.keys({
        branchId: Joi.number().integer().positive().optional(),
        include_inactive: Joi.boolean().optional()
    }),

    assignBranches: Joi.object({
        branchIds: Joi.array().items(Joi.number().integer().positive()).min(1).unique().required()
            .messages({
                'array.min': 'Must assign at least one branch',
                'array.unique': 'Cannot assign duplicate branches',
                'any.required': 'Branch IDs are required'
            })
    }),

    manageBranch: Joi.object({
        salespersonId: Joi.number().integer().positive().required(),
        branchId: Joi.number().integer().positive().required()
    }),

    toggleStatus: Joi.object({
        is_active: Joi.boolean().required()
    })
};

// Schemas para EstimateStatus
const statusSchemas = {
    create: Joi.object({
        name: Joi.string().trim().min(2).max(50).required()
            .messages({
                'string.empty': 'Status name is required',
                'string.min': 'Name must be at least 2 characters',
                'string.max': 'Name cannot exceed 50 characters'
            })
    }),

    update: Joi.object({
        name: Joi.string().trim().min(2).max(50).required()
    }),

    list: paginationSchema,

    analytics: Joi.object({
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
            .messages({
                'date.min': 'End date must be after start date'
            }),
        groupBy: Joi.string().valid('status', 'month', 'week').default('status')
    })
};

// Schemas para Estimates
const estimateSchemas = {
    sync: Joi.object({
        branchId: Joi.number().integer().positive().optional(),
        statusId: Joi.number().integer().positive().optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional(),
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(1000).default(100)
    }),

    fetch: Joi.object({
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
        branchId: Joi.number().integer().positive().optional(),
        salesPersonId: Joi.number().integer().positive().optional(),
        statusId: Joi.number().integer().positive().optional(),
        startDate: Joi.date().iso().optional(),
        endDate: Joi.date().iso().min(Joi.ref('startDate')).optional()
    })
};

// Middleware específicos para cada entidad
const validateBranch = {
    create: createValidationMiddleware(branchSchemas.create),
    update: createValidationMiddleware(branchSchemas.update),
    list: createValidationMiddleware(branchSchemas.list, 'query'),
    params: createValidationMiddleware(idParamSchema, 'params'),
    assignSalesPerson: createValidationMiddleware(branchSchemas.assignSalesPerson)
};

const validateSalesPerson = {
    create: createValidationMiddleware(salesPersonSchemas.create),
    update: createValidationMiddleware(salesPersonSchemas.update),
    list: createValidationMiddleware(salesPersonSchemas.list, 'query'),
    params: createValidationMiddleware(idParamSchema, 'params'),
    assignBranches: createValidationMiddleware(salesPersonSchemas.assignBranches),
    manageBranch: createValidationMiddleware(salesPersonSchemas.manageBranch, 'params'),
    toggleStatus: createValidationMiddleware(salesPersonSchemas.toggleStatus)
};

const validateStatus = {
    create: createValidationMiddleware(statusSchemas.create),
    update: createValidationMiddleware(statusSchemas.update),
    list: createValidationMiddleware(statusSchemas.list, 'query'),
    params: createValidationMiddleware(idParamSchema, 'params'),
    analytics: createValidationMiddleware(statusSchemas.analytics, 'query')
};

const validateEstimate = {
    sync: createValidationMiddleware(estimateSchemas.sync),
    fetch: createValidationMiddleware(estimateSchemas.fetch),
    params: createValidationMiddleware(idParamSchema, 'params')
};

// Middleware genérico para IDs compuestos (ej: /branches/:id/salespersons/:salesPersonId)
const validateCompositeParams = createValidationMiddleware(
    Joi.object({
        id: Joi.number().integer().positive().required(),
        salesPersonId: Joi.number().integer().positive().required()
    }),
    'params'
);

module.exports = {
    validateBranch,
    validateSalesPerson,
    validateStatus,
    validateEstimate,
    validateCompositeParams,
    createValidationMiddleware // Para casos especiales
};
