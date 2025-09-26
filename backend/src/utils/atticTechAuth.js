const https = require('https');
require('dotenv').config();

/**
 * Obtiene un token de autenticación de Attic Tech
 * @param {string[]} logMessages - Array opcional para almacenar mensajes de log
 * @returns {Promise<string|null>} Token de autenticación o null si falla
 */
async function loginToAtticTech(logMessages = []) {
    logMessages.push('🔑 Starting dynamic API login to Attic Tech...');
    
    const API_USER_EMAIL = process.env.ATTIC_TECH_EMAIL;
    const API_USER_PASSWORD = process.env.ATTIC_TECH_PASSWORD;
    
    if (!API_USER_EMAIL || !API_USER_PASSWORD) {
        const errorMsg = `ATTIC_TECH_EMAIL and ATTIC_TECH_PASSWORD must be set in environment variables`;
        logMessages.push(`❌ ${errorMsg}`);
        throw new Error(errorMsg);
    }

    const loginData = JSON.stringify({
        email: API_USER_EMAIL,
        password: API_USER_PASSWORD
    });

    const options = {
        hostname: 'www.attic-tech.com',
        path: '/api/users/login',
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Content-Length': Buffer.byteLength(loginData),
            'User-Agent': 'BotZilla API v2.0'
        }
    };

    try {
        const response = await new Promise((resolve, reject) => {
            const req = https.request(options, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    if (res.statusCode === 200 || res.statusCode === 201) {
                        try { 
                            resolve(JSON.parse(data)); 
                        } catch (e) { 
                            logMessages.push(`❌ Login JSON Parse Error: ${e.message}`);
                            reject(e); 
                        }
                    } else {
                        logMessages.push(`❌ Login API Error. Status: ${res.statusCode}, Data: ${data.substring(0, 200)}`);
                        reject(new Error(`Login request failed: ${res.statusCode} - ${data}`));
                    }
                });
            });
            
            req.on('error', (e) => { 
                logMessages.push(`❌ Login Request Error: ${e.message}`);
                reject(e); 
            });
            
            req.write(loginData);
            req.end();
        });

        if (response.token) {
            logMessages.push('✅ Successfully logged in to Attic Tech');
            logMessages.push(`👤 Logged in as: ${response.user?.email || 'Unknown'}`);
            return response.token;
        } else {
            throw new Error('No token received in login response');
        }
    } catch (error) {
        logMessages.push(`❌ Login to Attic Tech failed: ${error.message}`);
        throw error;
    }
}

module.exports = {
    loginToAtticTech
};