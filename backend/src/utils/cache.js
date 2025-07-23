const { logger } = require('./logger');

class Cache {
    constructor(options = {}) {
        this.cache = new Map();
        this.ttl = options.ttl || 300000; // 5 minutos por defecto
        this.maxSize = options.maxSize || 1000; // Máximo 1000 entradas
        this.enabled = options.enabled !== false; // Habilitado por defecto
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            deletes: 0,
            evictions: 0
        };
        
        // Limpiar cache expirado cada minuto
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
        
        logger.info('Cache system initialized', {
            ttl: this.ttl,
            maxSize: this.maxSize,
            enabled: this.enabled
        });
    }

    // Generar clave de cache
    generateKey(prefix, params = {}) {
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((result, key) => {
                result[key] = params[key];
                return result;
            }, {});
        
        const paramsString = JSON.stringify(sortedParams);
        return `${prefix}:${Buffer.from(paramsString).toString('base64')}`;
    }

    // Obtener valor del cache
    get(key) {
        if (!this.enabled) return null;

        const item = this.cache.get(key);
        
        if (!item) {
            this.stats.misses++;
            logger.debug('Cache miss', { key });
            return null;
        }

        // Verificar si ha expirado
        if (Date.now() > item.expiresAt) {
            this.cache.delete(key);
            this.stats.misses++;
            logger.debug('Cache miss (expired)', { key });
            return null;
        }

        this.stats.hits++;
        logger.debug('Cache hit', { key });
        return item.value;
    }

    // Guardar valor en cache
    set(key, value, customTtl = null) {
        if (!this.enabled) return false;

        const ttl = customTtl || this.ttl;
        const expiresAt = Date.now() + ttl;

        // Si alcanzamos el tamaño máximo, eliminar el más antiguo
        if (this.cache.size >= this.maxSize) {
            const firstKey = this.cache.keys().next().value;
            this.cache.delete(firstKey);
            this.stats.evictions++;
        }

        this.cache.set(key, {
            value,
            expiresAt,
            createdAt: Date.now()
        });

        this.stats.sets++;
        logger.debug('Cache set', { key, ttl });
        return true;
    }

    // Eliminar del cache
    delete(key) {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.stats.deletes++;
            logger.debug('Cache delete', { key });
        }
        return deleted;
    }

    // Limpiar por patrón
    deletePattern(pattern) {
        let deleted = 0;
        const regex = new RegExp(pattern);
        
        for (const key of this.cache.keys()) {
            if (regex.test(key)) {
                this.cache.delete(key);
                deleted++;
            }
        }
        
        this.stats.deletes += deleted;
        logger.debug('Cache pattern delete', { pattern, deleted });
        return deleted;
    }

    // Limpiar cache expirado
    cleanup() {
        let cleaned = 0;
        const now = Date.now();
        
        for (const [key, item] of this.cache.entries()) {
            if (now > item.expiresAt) {
                this.cache.delete(key);
                cleaned++;
            }
        }
        
        if (cleaned > 0) {
            logger.debug('Cache cleanup', { cleaned });
        }
        
        return cleaned;
    }

    // Limpiar todo el cache
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        logger.info('Cache cleared', { size });
        return size;
    }

    // Obtener estadísticas
    getStats() {
        const hitRate = this.stats.hits + this.stats.misses > 0 
            ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
            : 0;

        return {
            ...this.stats,
            hitRate: parseFloat(hitRate.toFixed(2)),
            size: this.cache.size,
            maxSize: this.maxSize,
            enabled: this.enabled
        };
    }

    // Middleware para cache automático
    middleware(cachePrefix, ttl = null) {
        return (req, res, next) => {
            if (req.method !== 'GET') {
                return next();
            }

            const cacheKey = this.generateKey(cachePrefix, {
                query: req.query,
                params: req.params,
                userId: req.user?.id
            });

            // Intentar obtener del cache
            const cachedData = this.get(cacheKey);
            if (cachedData) {
                logger.debug('Returning cached response', { cacheKey });
                return res.json(cachedData);
            }

            // Interceptar la respuesta para cachearla
            const originalJson = res.json;
            res.json = (data) => {
                // Solo cachear respuestas exitosas
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    this.set(cacheKey, data, ttl);
                }
                return originalJson.call(res, data);
            };

            next();
        };
    }

    // Invalidar cache relacionado a una entidad
    invalidateEntity(entityType, entityId = null) {
        const patterns = [
            `${entityType}:`,
            `${entityType}_list:`,
            `${entityType}_stats:`,
            `${entityType}s:`,
            `${entityType}s_list:`,
            `${entityType}s_stats:`
        ];

        if (entityId) {
            patterns.push(`${entityType}_${entityId}:`);
            patterns.push(`${entityType}s_${entityId}:`);
        }

        let totalDeleted = 0;
        patterns.forEach(pattern => {
            totalDeleted += this.deletePattern(pattern);
        });

        logger.info('Cache invalidated', { 
            entityType, 
            entityId, 
            patterns,
            deleted: totalDeleted 
        });

        return totalDeleted;
    }

    // Destructor
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
        }
        this.clear();
        logger.info('Cache destroyed');
    }
}

// Configuraciones específicas para diferentes tipos de cache
const cacheConfigs = {
    // Cache para listas (branches, salespersons, etc.)
    lists: {
        ttl: 300000, // 5 minutos
        maxSize: 100
    },
    
    // Cache para entidades individuales
    entities: {
        ttl: 600000, // 10 minutos
        maxSize: 500
    },
    
    // Cache para estadísticas
    stats: {
        ttl: 900000, // 15 minutos
        maxSize: 50
    },
    
    // Cache para analytics
    analytics: {
        ttl: 1800000, // 30 minutos
        maxSize: 20
    }
};

// Instancias de cache
const caches = {
    main: new Cache({ ttl: 300000, maxSize: 1000 }),
    lists: new Cache(cacheConfigs.lists),
    entities: new Cache(cacheConfigs.entities),
    stats: new Cache(cacheConfigs.stats),
    analytics: new Cache(cacheConfigs.analytics)
};

// Helper para cachear funciones
const cacheFunction = async (cacheInstance, key, fn, ttl = null) => {
    const cached = cacheInstance.get(key);
    if (cached !== null) {
        return cached;
    }

    try {
        const result = await fn();
        cacheInstance.set(key, result, ttl);
        return result;
    } catch (error) {
        logger.error('Error in cached function', { key, error: error.message });
        throw error;
    }
};

// Middleware para invalidar cache en operaciones CUD
const cacheInvalidationMiddleware = (entityType) => {
    return (req, res, next) => {
        const originalJson = res.json;
        
        res.json = function(data) {
            // Si la operación fue exitosa, invalidar cache relacionado
            if (res.statusCode >= 200 && res.statusCode < 300) {
                const entityId = req.params.id || data?.id || data?.[entityType]?.id;
                
                // Invalidar en todos los caches relevantes
                Object.values(caches).forEach(cache => {
                    cache.invalidateEntity(entityType, entityId);
                    // También invalidar variaciones comunes del nombre de entidad
                    cache.invalidateEntity(entityType.toLowerCase(), entityId);
                    cache.invalidateEntity(entityType + 's', entityId);
                    cache.invalidateEntity(entityType.toLowerCase() + 's', entityId);
                    
                    // Invalidar patrones específicos para listas
                    cache.deletePattern(`.*_list.*`);
                    cache.deletePattern(`.*list.*`);
                });
                
                logger.info('Cache invalidated after mutation', {
                    entityType,
                    entityId,
                    method: req.method,
                    url: req.originalUrl,
                    statusCode: res.statusCode
                });
            }
            
            return originalJson.call(this, data);
        };
        
        next();
    };
};

module.exports = {
    Cache,
    caches,
    cacheFunction,
    cacheInvalidationMiddleware
}; 