# 📊 ANÁLISIS DE CAMPOS PARA CÁLCULO DE MULTIPLIER Y NON-SUB COST

## 🎯 Objetivo
Identificar todos los campos necesarios en un Estimate para descomponer el precio en factores y calcular:
1. **Total Non-Sub Cost** (Material + Labor)
2. **Multiplier efectivo** aplicado

---

## 📋 ESTRUCTURA DE DATOS DEL ESTIMATE

### 1. CAMPOS PRINCIPALES (Nivel raíz del Estimate)

```json
{
  "id": 9250,
  "name": "Casey Litton - RES",
  "true_cost": 2088.2388,              // ✅ CRÍTICO: Costo verdadero total
  "retail_cost": 5429.42088,           // ✅ CRÍTICO: Precio retail sin descuento
  "final_price": 4343.536704,          // ✅ CRÍTICO: Precio final con descuento aplicado
  "labor_hours": 46.2,                 // ✅ Total de horas de labor calculadas
  "discount_provided": 20,             // ✅ Porcentaje de descuento aplicado
  "payment_method": "cash",            // ✅ "cash" | "credit_card" | "finance" | null
  "sub_services_retail_cost": 0,       // ✅ Costo retail de servicios subcontratados
  "quality_control_visit": false,      // ✅ Si requiere visita QC adicional
  
  "service_data": { ... },             // ⬇️ Ver sección 2
  "estimateSnapshot": { ... },         // ⬇️ Ver sección 3
  "branch": { ... }                    // ⬇️ Ver sección 4
}
```

---

### 2. SERVICE_DATA (Items seleccionados por el usuario)

```json
{
  "service_data": {
    "services": [
      {
        "id": 0,
        "type": "Garage Projects",
        "workAreaTypeId": 7,
        "customName": "",
        
        // ✅ CRÍTICO: Factores de work area seleccionados por el usuario
        "factors": {
          "2": false,      // Key = factor ID, Value = si está activado
          "10": false,
          "22": false,
          "25": false
        },
        
        // ✅ CRÍTICO: Items y cantidades seleccionadas
        "itemData": {
          "2": {                      // Key = Category ID
            "173": {                  // Key = Item ID
              "name": "R-30, 16\" UF Batts",
              "unit": "Sq. Ft.",
              "amount": 400,          // ✅ CANTIDAD SELECCIONADA
              "additionalInfo": "",   // Opcional
              "factors": []           // Factores específicos del item
            }
          },
          "13": {
            "196": {
              "name": "Air Seal",
              "unit": "Sq. Ft.",
              "amount": 400
            },
            "199": {
              "name": "Sanitation", 
              "unit": "Sq. Ft.",
              "amount": 400
            }
          }
        }
      }
    ]
  }
}
```

**Uso:** Contiene las selecciones del usuario. Para calcular costos, necesitas cruzar estos IDs con los datos del `estimateSnapshot`.

---

### 3. ESTIMATE SNAPSHOT (Configuración completa al momento de crear el estimate)

```json
{
  "estimateSnapshot": {
    "id": 1246,
    "snapshotHash": "...",
    
    "snapshotData": {
      
      // ═══════════════════════════════════════════════════════════
      // A. WORK AREAS (Áreas de trabajo disponibles)
      // ═══════════════════════════════════════════════════════════
      "workAreas": [
        {
          "id": 11,
          "name": "Attic Projects",
          
          // ✅ FACTORES DE WORK AREA (afectan labor cost)
          "factors": [
            {
              "id": 25,
              "name": "Attic space Work area is lower then 4 ft?",
              "factor": 1.15,                    // ✅ Multiplicador
              "appliesTo": "Labor Cost",         // ✅ "Labor Cost" | "Material Cost" | "Both"
              "alwaysEnabled": false
            },
            {
              "id": 22,
              "name": "Fire Sprinklers",
              "factor": 1.3,
              "appliesTo": "Labor Cost",
              "alwaysEnabled": false
            }
          ],
          
          // ═══════════════════════════════════════════════════════════
          // B. CATEGORÍAS DE ITEMS
          // ═══════════════════════════════════════════════════════════
          "itemCategories": [
            {
              "id": 17,
              "name": "Attic Scope of Work",
              
              // ✅ CRÍTICO: Items con costos base
              "items": [
                {
                  "id": 155,
                  "name": "Total Set-up Distance",
                  "unit": "Linear Feet",
                  "strapiId": 50,
                  
                  // ═══════════════════════════════════════
                  // CAMPOS CRÍTICOS PARA CÁLCULO
                  // ═══════════════════════════════════════
                  "laborHours": 0.0175,          // ⚡ Horas de labor por unidad
                  "materialCost": 1.5,           // 💰 Costo de material por unidad ($)
                  "multiplierOverride": null,    // 🔢 Multiplicador custom (override del rango)
                  "subItem": false,              // 🔴 true = subcontratista, false = interno
                  
                  "requiresInfo": false,
                  "factors": [],                 // Factores específicos del item
                  "additional_costs": [],
                  "images": [ ... ],
                  "itemInfo": "..."
                },
                
                // ═══════════════════════════════════════
                // EJEMPLO: Item de SUBCONTRATISTA
                // ═══════════════════════════════════════
                {
                  "id": 64,
                  "name": "TRUE SUB COST - NO CATEGORY",
                  "unit": "Dollars",
                  "strapiId": 158,
                  "laborHours": 0,               // ⚡ Sub items tienen 0 labor
                  "materialCost": 1,             // 💰 El usuario ingresa el costo total
                  "multiplierOverride": 1.75,    // 🔢 Sub items suelen tener override
                  "subItem": true,               // 🔴 TRUE = es subcontratista
                  "requiresInfo": true           // Usuario debe ingresar info
                }
              ]
            }
          ]
        }
      ],
      
      // ═══════════════════════════════════════════════════════════
      // C. MULTIPLIER RANGES (Rangos de multiplicador según costo)
      // ═══════════════════════════════════════════════════════════
      "multiplierRanges": [
        {
          "id": 1,
          "name": "SOS - $6000+",
          "minCost": 6000.01,
          "maxCost": null,                   // null = sin límite superior
          "lowestMultiple": 2.25,            // ✅ Multiplicador mínimo del rango
          "highestMultiple": 2.25            // ✅ Multiplicador máximo del rango
        },
        {
          "id": 2, 
          "name": "SOS - $1700-$6000",
          "minCost": 1700.01,
          "maxCost": 6000,
          "lowestMultiple": 2.5,
          "highestMultiple": 2.5
        },
        {
          "id": 3,
          "name": "SOS - $0-$1700",
          "minCost": 0,
          "maxCost": 1700,
          "lowestMultiple": 2.75,            // ✅ Ejemplo: $2,088 cae en este rango
          "highestMultiple": 2.75
        }
      ],
      
      // ═══════════════════════════════════════════════════════════
      // D. CONSTANTES DE CONFIGURACIÓN DE BRANCH
      // ═══════════════════════════════════════════════════════════
      "branchConfigurationConstants": {
        "baseHourlyRate": 30.9,              // 💵 Tarifa base por hora de labor
        "wasteFactor": 1.05,                 // 📦 Factor de desperdicio de material (5%)
        "creditCardFee": 1.045,              // 💳 Fee para pagos con tarjeta (4.5%)
        "cashFactor": 1.04,                  // 💵 Factor para pagos en efectivo (4%)
        "subMultiplier": 1.75,               // 🔢 Multiplicador default para subs
        
        "gasCost": 5.21,                     // ⛽ Costo de gasolina por galón
        "truckAverageMPG": 12.5,             // 🚚 MPG del camión
        "laborHoursLoadUnload": 1,           // ⏱️ Horas para carga/descarga
        "qualityControlVisitPrice": 92.7,    // ✅ Precio de visita QC
        
        "averageWorkDayHours": 9,
        "minRetailPrice": 3700,
        "maxDiscount": 20,
        "b2bMaxDiscount": 10,
        
        // Factores de financiamiento (meses: multiplicador)
        "financeFactors": {
          "3": 1.5,
          "6": 1.25,
          "12": 1.15
        },
        
        "address": "1607 W Orange Grove Ave, Orange, CA 92868",
        "bonusPoolPercentage": 0.3,
        "bonusPayoutCutoff": 30,
        "leaderboardColorPercentage": 15
      }
    }
  }
}
```

---

### 4. BRANCH (Información del Branch)

```json
{
  "branch": {
    "id": 5,
    "name": "Orange County",
    "configuration": {
      "id": 5,
      "name": "Orange County - Main Config",
      
      // ✅ Snapshot de las constantes (puede estar desactualizado)
      "baseConstants": { ... },       // Similar a branchConfigurationConstants
      
      // ✅ IDs de los multiplier ranges activos
      "multiplier_ranges": [1, 3, 2],
      
      // ✅ IDs de work areas disponibles
      "work_areas": [11, 10, 9, 7, 6, 4, 2]
    }
  }
}
```

**⚠️ IMPORTANTE:** Usa `estimateSnapshot.snapshotData` en lugar de `branch.configuration` porque el snapshot captura la configuración exacta al momento de crear el estimate.

---

## 🧮 FÓRMULAS DE CÁLCULO

### FÓRMULA 1: Calcular Total Non-Sub Cost (Material + Labor)

```javascript
function calculateNonSubCost(estimate) {
  let totalNonSubCost = 0;
  
  const { service_data, estimateSnapshot } = estimate;
  const { snapshotData } = estimateSnapshot;
  const constants = snapshotData.branchConfigurationConstants;
  
  // Iterar por cada servicio seleccionado
  for (const service of service_data.services) {
    
    // Encontrar el work area correspondiente en el snapshot
    const workArea = snapshotData.workAreas.find(wa => wa.id === service.workAreaTypeId);
    
    // Obtener factores activos del work area
    const activeFactors = workArea.factors.filter(factor => 
      service.factors[factor.id] === true
    );
    
    // Iterar por cada categoría de items
    for (const [categoryId, categoryItems] of Object.entries(service.itemData)) {
      
      // Iterar por cada item seleccionado
      for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
        
        // Buscar el item en el snapshot para obtener costos base
        const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
        
        // ⚠️ FILTRO: Solo items NO subcontratados
        if (itemDefinition.subItem === true) {
          continue; // Skip sub items
        }
        
        const amount = selectedItem.amount;
        
        // ═══════════════════════════════════════
        // CALCULAR MATERIAL COST
        // ═══════════════════════════════════════
        let materialCost = amount * itemDefinition.materialCost * constants.wasteFactor;
        
        // ═══════════════════════════════════════
        // CALCULAR LABOR COST
        // ═══════════════════════════════════════
        let laborCost = amount * itemDefinition.laborHours * constants.baseHourlyRate;
        
        // Aplicar factores de work area al labor
        for (const factor of activeFactors) {
          if (factor.appliesTo === "Labor Cost" || factor.appliesTo === "Both") {
            laborCost *= factor.factor;
          }
        }
        
        // Aplicar factores de work area al material (si aplica)
        for (const factor of activeFactors) {
          if (factor.appliesTo === "Material Cost" || factor.appliesTo === "Both") {
            materialCost *= factor.factor;
          }
        }
        
        totalNonSubCost += (materialCost + laborCost);
      }
    }
  }
  
  // ═══════════════════════════════════════
  // AGREGAR COSTOS FIJOS
  // ═══════════════════════════════════════
  
  // Costo de carga/descarga
  totalNonSubCost += (constants.laborHoursLoadUnload * constants.baseHourlyRate);
  
  // Costo de transporte/gasolina (puede variar según distancia)
  // Esto es un ejemplo simplificado
  const distance = calculateDistance(estimate.property.address, constants.address);
  const gallonsUsed = (distance * 2) / constants.truckAverageMPG; // Round trip
  totalNonSubCost += (gallonsUsed * constants.gasCost);
  
  // Visita de Quality Control (si aplica)
  if (estimate.quality_control_visit) {
    totalNonSubCost += constants.qualityControlVisitPrice;
  }
  
  return totalNonSubCost;
}

// Helper function
function findItemInSnapshot(workArea, itemId) {
  for (const category of workArea.itemCategories) {
    const item = category.items.find(i => i.id === itemId);
    if (item) return item;
  }
  return null;
}
```

---

### FÓRMULA 2: Calcular Retail Cost y Multiplier Efectivo

```javascript
function calculateRetailCostAndMultiplier(estimate, nonSubCost) {
  const { service_data, estimateSnapshot, payment_method, discount_provided } = estimate;
  const { snapshotData } = estimateSnapshot;
  const constants = snapshotData.branchConfigurationConstants;
  
  let retailCost = 0;
  let subServicesRetailCost = 0;
  
  // ═══════════════════════════════════════
  // 1. ENCONTRAR MULTIPLIER RANGE APLICABLE
  // ═══════════════════════════════════════
  const applicableRange = snapshotData.multiplierRanges.find(range => 
    nonSubCost >= range.minCost && 
    (range.maxCost === null || nonSubCost <= range.maxCost)
  );
  
  if (!applicableRange) {
    throw new Error(`No multiplier range found for cost: ${nonSubCost}`);
  }
  
  // El multiplier base del rango (puede usar lowestMultiple o highestMultiple)
  let baseMultiplier = applicableRange.lowestMultiple;
  
  // ═══════════════════════════════════════
  // 2. APLICAR MULTIPLIER A NON-SUB ITEMS
  // ═══════════════════════════════════════
  retailCost = nonSubCost * baseMultiplier;
  
  // ═══════════════════════════════════════
  // 3. CALCULAR RETAIL COST DE SUB ITEMS
  // ═══════════════════════════════════════
  for (const service of service_data.services) {
    const workArea = snapshotData.workAreas.find(wa => wa.id === service.workAreaTypeId);
    
    for (const [categoryId, categoryItems] of Object.entries(service.itemData)) {
      for (const [itemId, selectedItem] of Object.entries(categoryItems)) {
        
        const itemDefinition = findItemInSnapshot(workArea, parseInt(itemId));
        
        // ⚠️ FILTRO: Solo items subcontratados
        if (itemDefinition.subItem !== true) {
          continue;
        }
        
        // Para sub items, amount es típicamente el costo en dólares
        const subBaseCost = selectedItem.amount * itemDefinition.materialCost;
        
        // Usar multiplier override si existe, sino usar el default
        const subMultiplier = itemDefinition.multiplierOverride || constants.subMultiplier;
        
        subServicesRetailCost += (subBaseCost * subMultiplier);
      }
    }
  }
  
  retailCost += subServicesRetailCost;
  
  // ═══════════════════════════════════════
  // 4. APLICAR PAYMENT METHOD FACTOR
  // ═══════════════════════════════════════
  if (payment_method === 'cash') {
    retailCost *= constants.cashFactor;
  } else if (payment_method === 'credit_card') {
    retailCost *= constants.creditCardFee;
  } else if (payment_method === 'finance') {
    // Necesitarías el término de financiamiento (3, 6, 12 meses)
    // Ejemplo: 12 meses
    const financeTerm = estimate.global_info?.["2"] || "12"; // global_info.2 tiene el término
    const financeFactor = constants.financeFactors[financeTerm] || 1;
    retailCost *= financeFactor;
  }
  
  // ═══════════════════════════════════════
  // 5. APLICAR DESCUENTO PARA FINAL PRICE
  // ═══════════════════════════════════════
  const finalPrice = retailCost * (1 - (discount_provided / 100));
  
  // ═══════════════════════════════════════
  // 6. CALCULAR MULTIPLIER EFECTIVO
  // ═══════════════════════════════════════
  const totalTrueCost = nonSubCost + (subServicesRetailCost / constants.subMultiplier);
  const effectiveMultiplier = retailCost / totalTrueCost;
  
  return {
    retailCost,
    finalPrice,
    effectiveMultiplier,
    baseMultiplier,
    subServicesRetailCost,
    nonSubCost,
    totalTrueCost
  };
}
```

---

### FÓRMULA 3: Validar Cálculos contra Estimate Guardado

```javascript
function validateCalculations(estimate) {
  // Calcular valores
  const calculatedNonSubCost = calculateNonSubCost(estimate);
  const calculations = calculateRetailCostAndMultiplier(estimate, calculatedNonSubCost);
  
  // Comparar con valores guardados
  const validation = {
    trueCostMatch: Math.abs(estimate.true_cost - calculations.totalTrueCost) < 0.01,
    retailCostMatch: Math.abs(estimate.retail_cost - calculations.retailCost) < 0.01,
    finalPriceMatch: Math.abs(estimate.final_price - calculations.finalPrice) < 0.01,
    subServicesMatch: Math.abs(estimate.sub_services_retail_cost - calculations.subServicesRetailCost) < 0.01,
    
    differences: {
      trueCost: estimate.true_cost - calculations.totalTrueCost,
      retailCost: estimate.retail_cost - calculations.retailCost,
      finalPrice: estimate.final_price - calculations.finalPrice
    },
    
    calculated: calculations,
    stored: {
      trueCost: estimate.true_cost,
      retailCost: estimate.retail_cost,
      finalPrice: estimate.final_price,
      subServicesRetailCost: estimate.sub_services_retail_cost
    }
  };
  
  return validation;
}
```

---

## 📝 EJEMPLO PRÁCTICO

### Estimate analizado:
- **ID:** 9250
- **True Cost:** $2,088.24
- **Retail Cost:** $5,429.42
- **Final Price:** $4,343.54
- **Discount:** 20%
- **Payment Method:** cash

### Breakdown:

1. **Items seleccionados:**
   - Garage: R-30 Batts (400 sq ft), Air Seal (400 sq ft), Sanitation (400 sq ft), Rodent Proofing (400 sq ft)
   - Attic: Extra Hours (4 hours)

2. **Factores activos:** Ninguno (todos false)

3. **Multiplier Range aplicable:** $0-$1700 → 2.75x

4. **Cálculo:**
   ```
   Non-Sub Cost = Material + Labor = $2,088.24
   Base Retail = $2,088.24 × 2.75 = $5,742.66
   With Cash Factor = $5,742.66 × 1.04 = $5,972.37
   With 20% Discount = $5,972.37 × 0.80 = $4,777.90
   
   ⚠️ Nota: Hay diferencias porque faltan algunos factores como
   gasolina, carga/descarga, o ajustes específicos.
   ```

---

## ✅ CHECKLIST DE CAMPOS NECESARIOS

### Para calcular **Total Non-Sub Cost:**
- [ ] `service_data.services[].itemData` - Cantidades seleccionadas
- [ ] `service_data.services[].factors` - Factores seleccionados
- [ ] `service_data.services[].workAreaTypeId` - ID del work area
- [ ] `estimateSnapshot.snapshotData.workAreas[].itemCategories[].items[]`
  - [ ] `laborHours` - Horas por unidad
  - [ ] `materialCost` - Costo material por unidad
  - [ ] `subItem` - Si es subcontratista
- [ ] `estimateSnapshot.snapshotData.workAreas[].factors[]`
  - [ ] `factor` - Valor del multiplicador
  - [ ] `appliesTo` - A qué se aplica
- [ ] `estimateSnapshot.snapshotData.branchConfigurationConstants`
  - [ ] `baseHourlyRate`
  - [ ] `wasteFactor`
  - [ ] `laborHoursLoadUnload`
  - [ ] `gasCost`
  - [ ] `truckAverageMPG`
  - [ ] `qualityControlVisitPrice`
- [ ] `quality_control_visit` - Boolean
- [ ] `property.address` - Para calcular distancia

### Para calcular **Multiplier:**
- [ ] `estimateSnapshot.snapshotData.multiplierRanges[]`
  - [ ] `minCost`, `maxCost`
  - [ ] `lowestMultiple`, `highestMultiple`
- [ ] `estimateSnapshot.snapshotData.workAreas[].itemCategories[].items[].multiplierOverride`
- [ ] `estimateSnapshot.snapshotData.branchConfigurationConstants`
  - [ ] `subMultiplier`
  - [ ] `cashFactor`
  - [ ] `creditCardFee`
  - [ ] `financeFactors`
- [ ] `payment_method`
- [ ] `discount_provided`
- [ ] `global_info.2` - Término de financiamiento (si aplica)

### Para **validación:**
- [ ] `true_cost` - Comparar con cálculo
- [ ] `retail_cost` - Comparar con cálculo
- [ ] `final_price` - Comparar con cálculo
- [ ] `sub_services_retail_cost` - Comparar con cálculo
- [ ] `labor_hours` - Comparar con suma de horas

---

## 🔍 QUERIES ÚTILES PARA OBTENER ESTIMATES

```javascript
// Obtener estimate completo con todas las relaciones
const estimate = await Estimate.findOne({
  where: { id: estimateId },
  include: [
    {
      model: EstimateSnapshot,
      as: 'estimateSnapshot',
      required: true
    },
    {
      model: Branch,
      as: 'branch',
      include: [{
        model: BranchConfiguration,
        as: 'configuration'
      }]
    },
    {
      model: Client,
      as: 'client'
    },
    {
      model: Property,
      as: 'property'
    },
    {
      model: User,
      as: 'user'
    }
  ]
});

// Parsear JSON fields
const serviceData = typeof estimate.service_data === 'string' 
  ? JSON.parse(estimate.service_data) 
  : estimate.service_data;

const snapshotData = typeof estimate.estimateSnapshot.snapshotData === 'string'
  ? JSON.parse(estimate.estimateSnapshot.snapshotData)
  : estimate.estimateSnapshot.snapshotData;
```

---

## ⚠️ CONSIDERACIONES IMPORTANTES

### 1. **Snapshot vs Live Configuration**
Siempre usa `estimateSnapshot.snapshotData` en lugar de `branch.configuration` porque:
- El snapshot captura la configuración exacta al momento de crear el estimate
- La configuración del branch puede cambiar después
- Esto asegura que los cálculos sean reproducibles

### 2. **Sub Items vs Regular Items**
- **Regular Items:** `subItem = false`
  - Tienen `laborHours` y `materialCost`
  - Se les aplica el multiplier del rango
  - Contribuyen al Non-Sub Cost
  
- **Sub Items:** `subItem = true`
  - Típicamente `laborHours = 0`
  - `materialCost` es el costo base que el usuario ingresa
  - Tienen su propio `multiplierOverride`
  - NO contribuyen al Non-Sub Cost (tienen su propio cálculo)

### 3. **Factores de Work Area**
- Solo se aplican si están activados en `service_data.services[].factors`
- `appliesTo` determina si afecta labor, material, o ambos
- Se multiplican en cascada si hay múltiples activos

### 4. **Payment Method Factors**
Los factores de pago se aplican AL FINAL, después del multiplier:
- `cash`: × 1.04 (4%)
- `credit_card`: × 1.045 (4.5%)
- `finance`: × 1.15 - 1.5 (según término)

### 5. **Descuento**
El descuento se aplica DESPUÉS de todos los demás factores:
```
final_price = retail_cost × (1 - discount_provided / 100)
```

### 6. **JSON Fields**
Estos campos pueden estar como STRING o OBJECT en la BD:
- `service_data`
- `global_info`
- `estimateSnapshot.snapshotData`

Siempre parsea antes de usar.

---

## 📚 RECURSOS ADICIONALES

- **Archivo de ejemplo analizado:** `/analizar.json`
- **Valor de referencia:** true_cost = $2,088.24
- **Estimate ID:** 9250
- **Branch:** Orange County (ID: 5)
- **Configuration:** Orange County - Main Config (ID: 5)

---

## 🎯 PRÓXIMOS PASOS

1. Implementar las funciones de cálculo en el backend
2. Crear endpoint para validar estimates existentes
3. Agregar logging detallado del breakdown de costos
4. Crear tests unitarios con estimates conocidos
5. Documentar discrepancias entre cálculos y valores guardados

---

**Fecha de análisis:** Noviembre 17, 2025  
**Versión:** 1.0

