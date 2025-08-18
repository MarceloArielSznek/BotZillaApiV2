const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

// Función helper para normalizar nombres (igual que en automations.controller.js)
const normalizeName = (name) => {
    return name.toLowerCase()
        .replace(/\s+/g, ' ') // Múltiples espacios a uno solo
        .replace(/[^\w\s]/g, '') // Remover puntuación
        .trim();
};

// Función helper para calcular similitud entre nombres (versión mejorada)
const calculateNameSimilarity = (name1, name2) => {
    const normalized1 = normalizeName(name1);
    const normalized2 = normalizeName(name2);
    
    // Si son exactamente iguales después de normalizar
    if (normalized1 === normalized2) return 1.0;
    
    // Si uno contiene al otro (ej: "Eben W" vs "Eben Woodbell")
    if (normalized1.includes(normalized2) || normalized2.includes(normalized1)) {
        return 0.9;
    }
    
    // Calcular similitud por palabras
    const words1 = normalized1.split(' ');
    const words2 = normalized2.split(' ');
    
    let commonWords = 0;
    let totalWords = Math.max(words1.length, words2.length);
    
    for (const word1 of words1) {
        for (const word2 of words2) {
            if (word1 === word2 || 
                word1.startsWith(word2) || 
                word2.startsWith(word1)) {
                commonWords++;
                break;
            }
        }
    }
    
    const wordSimilarity = commonWords / totalWords;
    
    // Calcular similitud de caracteres para casos como "Woodall" vs "Woodbell"
    const calculateCharacterSimilarity = (str1, str2) => {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        // Calcular distancia de Levenshtein simplificada
        let distance = 0;
        for (let i = 0; i < shorter.length; i++) {
            if (longer[i] !== shorter[i]) {
                distance++;
            }
        }
        distance += longer.length - shorter.length;
        
        return 1 - (distance / longer.length);
    };
    
    // Calcular similitud de caracteres para cada palabra
    let maxCharSimilarity = 0;
    for (const word1 of words1) {
        for (const word2 of words2) {
            if (word1.length >= 3 && word2.length >= 3) { // Solo palabras de 3+ caracteres
                const charSimilarity = calculateCharacterSimilarity(word1, word2);
                if (charSimilarity > maxCharSimilarity) {
                    maxCharSimilarity = charSimilarity;
                }
            }
        }
    }
    
    // Combinar similitud de palabras y caracteres
    const combinedSimilarity = (wordSimilarity * 0.6) + (maxCharSimilarity * 0.4);
    
    return combinedSimilarity;
};

// Casos de prueba específicos
const testCases = [
    { name1: "Eben Woodall", name2: "Eben Woodbell" },
    { name1: "Mathew Stevenson", name2: "Matthew Stevenson" },
    { name1: "Michell Ladue", name2: "Michell LaDie" },
    { name1: "Dan Howard", name2: "Daniel Howard" },
    { name1: "Brandon L.", name2: "Brandon LaDue" },
    { name1: "Eben W", name2: "Eben Woodbell" }
];

console.log('🔍 DIAGNÓSTICO DE SIMILITUD DE NOMBRES');
console.log('=====================================\n');

testCases.forEach((testCase, index) => {
    const similarity = calculateNameSimilarity(testCase.name1, testCase.name2);
    const normalized1 = normalizeName(testCase.name1);
    const normalized2 = normalizeName(testCase.name2);
    
    console.log(`Caso ${index + 1}: "${testCase.name1}" vs "${testCase.name2}"`);
    console.log(`  Normalizado: "${normalized1}" vs "${normalized2}"`);
    console.log(`  Similitud: ${similarity.toFixed(3)}`);
    console.log(`  ¿Es duplicado? (>= 0.7): ${similarity >= 0.7 ? '✅ SÍ' : '❌ NO'}`);
    
    // Debug adicional para casos problemáticos
    if (index < 3) {
        const words1 = normalized1.split(' ');
        const words2 = normalized2.split(' ');
        console.log(`  Palabras 1: [${words1.join(', ')}]`);
        console.log(`  Palabras 2: [${words2.join(', ')}]`);
        
        // Calcular similitud de caracteres manualmente
        const calculateCharacterSimilarity = (str1, str2) => {
            const longer = str1.length > str2.length ? str1 : str2;
            const shorter = str1.length > str2.length ? str2 : str1;
            
            if (longer.length === 0) return 1.0;
            
            let distance = 0;
            for (let i = 0; i < shorter.length; i++) {
                if (longer[i] !== shorter[i]) {
                    distance++;
                }
            }
            distance += longer.length - shorter.length;
            
            return 1 - (distance / longer.length);
        };
        
        let maxCharSimilarity = 0;
        for (const word1 of words1) {
            for (const word2 of words2) {
                if (word1.length >= 3 && word2.length >= 3) {
                    const charSimilarity = calculateCharacterSimilarity(word1, word2);
                    if (charSimilarity > maxCharSimilarity) {
                        maxCharSimilarity = charSimilarity;
                        console.log(`    Similitud de caracteres: "${word1}" vs "${word2}" = ${charSimilarity.toFixed(3)}`);
                    }
                }
            }
        }
        console.log(`  Max similitud de caracteres: ${maxCharSimilarity.toFixed(3)}`);
    }
    
    console.log('');
});

console.log('📊 RESUMEN:');
console.log('===========');
testCases.forEach((testCase, index) => {
    const similarity = calculateNameSimilarity(testCase.name1, testCase.name2);
    const status = similarity >= 0.7 ? 'DUPLICADO' : 'NO DUPLICADO';
    console.log(`${index + 1}. "${testCase.name1}" vs "${testCase.name2}" → ${similarity.toFixed(3)} (${status})`);
}); 