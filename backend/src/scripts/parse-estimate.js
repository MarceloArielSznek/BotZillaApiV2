const fs = require('fs');
const path = require('path');

// Helper para obtener una propiedad anidada de un objeto usando un string como ruta.
function getProperty(obj, path) {
    if (!path) return null;
    return path.split('.').reduce((o, i) => (o && typeof o === 'object' && o[i] !== undefined ? o[i] : null), obj);
}

// --- Mapeo de Campos ---
// Aquí definimos de dónde viene cada dato que queremos extraer.
// La clave es el nombre del campo que queremos en el resultado final.
// El valor es la ruta para encontrar ese dato en el JSON original de Attic Tech.
const fieldMapping = {
    estimate_id: 'id',
    estimate_name: 'name',
    sales_person: 'user.name',
    status: 'status',
    branch: 'branch.name',
    estimate_address: 'address',
    true_cost: 'true_cost',
    retail_cost: 'retail_cost',
    discount: 'discount_provided',
    final_price: 'final_price',
    sub_service_retail_cost: 'sub_services_retail_cost',
    labor_hours: 'labor_hours',
    customer_address: 'address',
    estimate_created_date: 'createdAt',
    estimate_last_update_date: 'updatedAt',
    crew_note: 'crew_notes'
};
// --------------------

function extractJsonFromFile(filePath) {
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    const rawDataMarker = '--- Mostrando';
    const rawDataStartIndex = fileContent.indexOf(rawDataMarker);
    
    let contentToParse = fileContent;
    if (rawDataStartIndex !== -1) {
        contentToParse = fileContent.substring(rawDataStartIndex);
    } else {
        console.warn("⚠️ No se encontró el marcador de datos crudos. Se intentará parsear el primer JSON del archivo.");
    }

    const jsonStart = contentToParse.indexOf('{');
    if (jsonStart === -1) {
        throw new Error("No se encontró un objeto JSON para parsear.");
    }
    
    let braceCount = 0;
    let jsonEnd = -1;
    for (let i = jsonStart; i < contentToParse.length; i++) {
        if (contentToParse[i] === '{') {
            braceCount++;
        } else if (contentToParse[i] === '}') {
            braceCount--;
            if (braceCount === 0) {
                jsonEnd = i + 1;
                break;
            }
        }
    }

    if (jsonEnd === -1) {
        throw new Error("No se pudo encontrar el final del objeto JSON.");
    }

    const jsonString = contentToParse.substring(jsonStart, jsonEnd);
    return JSON.parse(jsonString);
}


function parseAndExtractInfo(filePath) {
    try {
        const estimateData = extractJsonFromFile(filePath);

        const extractedInfo = {};
        for (const [targetField, sourcePath] of Object.entries(fieldMapping)) {
            extractedInfo[targetField] = getProperty(estimateData, sourcePath);
        }

        // --- Lógica Especial para Campos Complejos ---
        // Si existe 'customer_info', construimos el nombre completo.
        const firstName = getProperty(estimateData, 'customer_info.firstName');
        const lastName = getProperty(estimateData, 'customer_info.lastName');
        if (firstName || lastName) {
            extractedInfo['customer_name'] = `${firstName || ''} ${lastName || ''}`.trim();
        } else {
            extractedInfo['customer_name'] = null;
        }
        // ---------------------------------------------


        return extractedInfo;

    } catch (error) {
        console.error("❌ Error procesando el archivo:", error.message);
        if (error instanceof SyntaxError) {
            console.error("El error parece ser un JSON mal formado. Por favor, verifica el contenido de 'sync.txt'.");
        }
        return null;
    }
}


function main() {
    const filePath = path.join(__dirname, 'sync.txt');
    console.log(`📄 Leyendo y procesando el archivo: ${filePath}`);

    const info = parseAndExtractInfo(filePath);

    if (info) {
        console.log("\n--- ✨ Información Extraída del Estimate (según mapeo) ---");
        for (const [key, value] of Object.entries(info)) {
            const displayValue = (value !== null && value !== undefined) ? value : 'No disponible';
            console.log(`- ${key}: ${displayValue}`);
        }
        console.log("---------------------------------------------------------");
    } else {
        console.log("\nNo se pudo extraer la información. Revisa los errores anteriores.");
    }
}

main(); 