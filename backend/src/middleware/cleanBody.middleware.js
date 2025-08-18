const getRawBody = require('raw-body');

/**
 * Middleware para limpiar y analizar cuerpos de solicitud JSON que pueden contener
 * caracteres de control no válidos (por ejemplo, saltos de línea sin escapar).
 * 
 * Esto es útil para webhooks (como de Make.com) que pueden enviar JSON malformado.
 * 
 * Reemplaza la necesidad de `express.json()` para rutas específicas.
 */
const cleanAndParseJson = (req, res, next) => {
    // Si el body ya ha sido analizado por otro middleware, no hacemos nada.
    if (req.body) {
        return next();
    }

    // Solo procesamos solicitudes JSON.
    if (!req.headers['content-type'] || !req.headers['content-type'].includes('application/json')) {
        return next();
    }

    getRawBody(req, {
        length: req.headers['content-length'],
        limit: '1mb',
        encoding: 'utf-8'
    }, (err, string) => {
        if (err) {
            return next(err);
        }

        if (string === '') {
            return next();
        }

        try {
            // Reemplaza TODOS los caracteres de control ASCII (0x00–0x1F) con una cadena vacía.
            // Esto es más agresivo y debería solucionar los problemas con saltos de línea
            // o tabulaciones no escapadas dentro de los valores de cadena del JSON.
            const cleanedString = string.replace(/[\u0000-\u001F]/g, '');
            req.body = JSON.parse(cleanedString);
            next();
        } catch (parseError) {
            parseError.status = 400;
            return next(parseError);
        }
    });
};

const allowedBranchFields = ['name', 'address', 'telegram_group_id'];

const cleanBranchBody = (req, res, next) => {
    if (!req.body) {
        return next();
    }
    const cleanedBody = {};
    for (const key of allowedBranchFields) {
        if (req.body[key] !== undefined) {
            cleanedBody[key] = req.body[key];
        }
    }
    req.body = cleanedBody;
    next();
};


module.exports = {
    cleanAndParseJson,
    cleanBranchBody,
}; 