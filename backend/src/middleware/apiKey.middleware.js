require('dotenv').config();

const validateApiKey = (req, res, next) => {
    const apiKey = req.headers['x-api-key'];
    const serverApiKey = process.env.AUTOMATION_API_KEY;

    if (!apiKey) {
        return res.status(401).json({ message: 'Unauthorized: API Key is missing.' });
    }

    if (!serverApiKey) {
        // This is a server configuration error, should not happen in production.
        console.error('CRITICAL: AUTOMATION_API_KEY is not set in the environment variables.');
        return res.status(500).json({ message: 'Internal Server Error: API Key not configured.' });
    }

    if (apiKey !== serverApiKey) {
        return res.status(403).json({ message: 'Forbidden: Invalid API Key.' });
    }

    // If the key is valid, proceed to the next middleware or route handler.
    next();
};

module.exports = validateApiKey; 