const { WaTaxRate } = require('../models');
const { logger } = require('./logger');

/**
 * Extrae el ZIP code de un address
 * @param {string} address - Dirección completa
 * @returns {string|null} ZIP code extraído o null
 */
function extractZipCode(address) {
    if (!address) return null;
    
    // Buscar patrones de ZIP code de 5 dígitos
    const zipMatch = address.match(/\b(\d{5})(?:-\d{4})?\b/);
    return zipMatch ? zipMatch[1] : null;
}

/**
 * Verifica si un address es de Washington State
 * @param {string} address - Dirección completa
 * @returns {boolean}
 */
function isWashingtonState(address) {
    if (!address) return false;
    
    const addressUpper = address.toUpperCase();
    return addressUpper.includes(' WA ') || 
           addressUpper.includes(', WA') ||
           addressUpper.includes('WASHINGTON') ||
           /\sWA\s*\d{5}/.test(addressUpper);
}

/**
 * Calcula los taxes para un estimate de Washington
 * @param {number} priceBeforeTaxes - Precio antes de taxes (final_price con discount aplicado)
 * @param {string} address - Dirección del estimate
 * @returns {Promise<Object>} Objeto con los taxes calculados
 */
async function calculateWashingtonTaxes(priceBeforeTaxes, address) {
    try {
        // Valores por defecto (sin taxes)
        const defaultResult = {
            city_tax_rate: null,
            state_tax_rate: null,
            total_tax_rate: null,
            city_tax_amount: null,
            state_tax_amount: null,
            total_tax_amount: null,
            price_before_taxes: priceBeforeTaxes,
            price_after_taxes: priceBeforeTaxes
        };

        // Verificar que sea de WA
        if (!isWashingtonState(address)) {
            logger.info('Address is not in Washington State - no taxes applied');
            return defaultResult;
        }

        // Extraer ZIP code
        const zipCode = extractZipCode(address);
        if (!zipCode) {
            logger.warn(`Could not extract ZIP code from address: ${address}`);
            return defaultResult;
        }

        // Buscar tax rate en la base de datos
        const taxRate = await WaTaxRate.findOne({
            where: { zip_code: zipCode }
        });

        if (!taxRate) {
            logger.warn(`Tax rate not found for ZIP code: ${zipCode} (${address})`);
            
            // Usar tax rate por defecto de WA (state only)
            const stateTaxRate = 0.065; // 6.5%
            const stateTaxAmount = priceBeforeTaxes * stateTaxRate;
            const totalTaxAmount = stateTaxAmount;
            const priceAfterTaxes = priceBeforeTaxes + totalTaxAmount;

            return {
                city_tax_rate: 0,
                state_tax_rate: stateTaxRate,
                total_tax_rate: stateTaxRate,
                city_tax_amount: 0,
                state_tax_amount: parseFloat(stateTaxAmount.toFixed(2)),
                total_tax_amount: parseFloat(totalTaxAmount.toFixed(2)),
                price_before_taxes: parseFloat(priceBeforeTaxes.toFixed(2)),
                price_after_taxes: parseFloat(priceAfterTaxes.toFixed(2))
            };
        }

        // Calcular taxes
        const cityTaxRate = parseFloat(taxRate.city_tax_rate);
        const stateTaxRate = parseFloat(taxRate.state_tax_rate);
        const totalTaxRate = parseFloat(taxRate.total_tax_rate);

        const cityTaxAmount = priceBeforeTaxes * cityTaxRate;
        const stateTaxAmount = priceBeforeTaxes * stateTaxRate;
        const totalTaxAmount = priceBeforeTaxes * totalTaxRate;
        const priceAfterTaxes = priceBeforeTaxes + totalTaxAmount;

        logger.info(`✅ Taxes calculated for ZIP ${zipCode} (${taxRate.city_name}): City ${(cityTaxRate * 100).toFixed(2)}% + State ${(stateTaxRate * 100).toFixed(2)}% = Total ${(totalTaxRate * 100).toFixed(2)}%`);

        return {
            city_tax_rate: cityTaxRate,
            state_tax_rate: stateTaxRate,
            total_tax_rate: totalTaxRate,
            city_tax_amount: parseFloat(cityTaxAmount.toFixed(2)),
            state_tax_amount: parseFloat(stateTaxAmount.toFixed(2)),
            total_tax_amount: parseFloat(totalTaxAmount.toFixed(2)),
            price_before_taxes: parseFloat(priceBeforeTaxes.toFixed(2)),
            price_after_taxes: parseFloat(priceAfterTaxes.toFixed(2))
        };

    } catch (error) {
        logger.error('Error calculating Washington taxes:', error);
        
        // Retornar sin taxes en caso de error
        return {
            city_tax_rate: null,
            state_tax_rate: null,
            total_tax_rate: null,
            city_tax_amount: null,
            state_tax_amount: null,
            total_tax_amount: null,
            price_before_taxes: priceBeforeTaxes,
            price_after_taxes: priceBeforeTaxes
        };
    }
}

module.exports = {
    extractZipCode,
    isWashingtonState,
    calculateWashingtonTaxes
};

