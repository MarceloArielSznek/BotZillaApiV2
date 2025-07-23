const fs = require('fs');
const path = require('path');

// Crear directorio de logs si no existe
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Niveles de logging
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    HTTP: 3,
    DEBUG: 4
};

// Colores para consola
const COLORS = {
    ERROR: '\x1b[31m', // Rojo
    WARN: '\x1b[33m',  // Amarillo
    INFO: '\x1b[36m',  // Cian
    HTTP: '\x1b[35m',  // Magenta
    DEBUG: '\x1b[37m', // Blanco
    RESET: '\x1b[0m'
};

class Logger {
    constructor() {
        this.logLevel = process.env.LOG_LEVEL || 'INFO';
        this.logToFile = process.env.LOG_TO_FILE !== 'false';
        this.logToConsole = process.env.LOG_TO_CONSOLE !== 'false';
        
        // Archivos de log rotativos por día
        this.logFiles = {
            error: path.join(logsDir, `error-${this.getDateString()}.log`),
            combined: path.join(logsDir, `combined-${this.getDateString()}.log`),
            http: path.join(logsDir, `http-${this.getDateString()}.log`)
        };
    }

    getDateString() {
        return new Date().toISOString().split('T')[0];
    }

    shouldLog(level) {
        return LOG_LEVELS[level] <= LOG_LEVELS[this.logLevel];
    }

    formatMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const logEntry = {
            timestamp,
            level,
            message,
            ...meta
        };

        return JSON.stringify(logEntry, null, 2);
    }

    formatConsoleMessage(level, message, meta = {}) {
        const timestamp = new Date().toISOString();
        const color = COLORS[level] || COLORS.RESET;
        const reset = COLORS.RESET;
        
        let output = `${color}[${timestamp}] [${level}]${reset} ${message}`;
        
        if (Object.keys(meta).length > 0) {
            output += `\n${color}Meta:${reset} ${JSON.stringify(meta, null, 2)}`;
        }
        
        return output;
    }

    writeToFile(level, content) {
        if (!this.logToFile) return;

        try {
            // Escribir al archivo específico del nivel
            if (level === 'ERROR') {
                fs.appendFileSync(this.logFiles.error, content + '\n');
            }
            
            // Escribir al archivo combinado (todos los niveles)
            fs.appendFileSync(this.logFiles.combined, content + '\n');
            
            // Escribir peticiones HTTP a archivo separado
            if (level === 'HTTP') {
                fs.appendFileSync(this.logFiles.http, content + '\n');
            }
        } catch (error) {
            console.error('Error writing to log file:', error);
        }
    }

    log(level, message, meta = {}) {
        if (!this.shouldLog(level)) return;

        const formattedMessage = this.formatMessage(level, message, meta);
        const consoleMessage = this.formatConsoleMessage(level, message, meta);

        // Log a consola
        if (this.logToConsole) {
            if (level === 'ERROR') {
                console.error(consoleMessage);
            } else if (level === 'WARN') {
                console.warn(consoleMessage);
            } else {
                console.log(consoleMessage);
            }
        }

        // Log a archivo
        this.writeToFile(level, formattedMessage);
    }

    error(message, meta = {}) {
        // Capturar stack trace si es un Error
        if (meta instanceof Error) {
            meta = {
                error: meta.message,
                stack: meta.stack,
                name: meta.name
            };
        }
        this.log('ERROR', message, meta);
    }

    warn(message, meta = {}) {
        this.log('WARN', message, meta);
    }

    info(message, meta = {}) {
        this.log('INFO', message, meta);
    }

    debug(message, meta = {}) {
        this.log('DEBUG', message, meta);
    }

    http(message, meta = {}) {
        this.log('HTTP', message, meta);
    }

    // Métodos específicos para casos comunes
    apiRequest(req, res, responseTime) {
        this.http('API Request', {
            method: req.method,
            url: req.originalUrl,
            userAgent: req.get('User-Agent'),
            ip: req.ip || req.connection.remoteAddress,
            statusCode: res.statusCode,
            responseTime: `${responseTime}ms`,
            userId: req.user?.id,
            requestId: req.requestId
        });
    }

    apiError(error, req, context = {}) {
        this.error('API Error', {
            error: error.message,
            stack: error.stack,
            method: req?.method,
            url: req?.originalUrl,
            userAgent: req?.get('User-Agent'),
            ip: req?.ip || req?.connection?.remoteAddress,
            userId: req?.user?.id,
            requestId: req?.requestId,
            ...context
        });
    }

    databaseQuery(query, duration, result = {}) {
        this.debug('Database Query', {
            query: query.slice(0, 200) + (query.length > 200 ? '...' : ''),
            duration: `${duration}ms`,
            rowCount: result.rowCount || result.count,
            type: 'database'
        });
    }

    authEvent(event, user, details = {}) {
        this.info(`Auth: ${event}`, {
            userId: user?.id,
            email: user?.email,
            role: user?.role,
            ip: details.ip,
            userAgent: details.userAgent,
            type: 'auth'
        });
    }

    businessEvent(event, details = {}) {
        this.info(`Business: ${event}`, {
            type: 'business',
            ...details
        });
    }

    // Cleanup logs antiguos (llamar periódicamente)
    cleanupOldLogs(daysToKeep = 30) {
        try {
            const files = fs.readdirSync(logsDir);
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

            files.forEach(file => {
                const filePath = path.join(logsDir, file);
                const stats = fs.statSync(filePath);
                
                if (stats.mtime < cutoffDate) {
                    fs.unlinkSync(filePath);
                    this.info(`Deleted old log file: ${file}`);
                }
            });
        } catch (error) {
            this.error('Error cleaning up old logs', error);
        }
    }
}

// Crear instancia singleton
const logger = new Logger();

// Middleware para logging de requests HTTP
const requestLogger = (req, res, next) => {
    const start = Date.now();
    
    // Generar ID único para la request
    req.requestId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Override res.end para capturar el tiempo de respuesta
    const originalEnd = res.end;
    res.end = function(...args) {
        const responseTime = Date.now() - start;
        logger.apiRequest(req, res, responseTime);
        originalEnd.apply(this, args);
    };

    next();
};

// Middleware para manejo de errores con logging
const errorLogger = (err, req, res, next) => {
    logger.apiError(err, req);
    next(err);
};

module.exports = {
    logger,
    requestLogger,
    errorLogger
}; 