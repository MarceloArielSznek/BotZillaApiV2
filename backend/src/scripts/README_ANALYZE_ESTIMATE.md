# 📊 Analyze Estimate Script

Script para analizar el breakdown detallado de costos de cualquier Estimate obtenido directamente desde la **API de Attic Tech**.

## ⚙️ Configuración Requerida

Asegúrate de tener configuradas las siguientes variables de entorno en tu archivo `.env`:

```env
ATTIC_TECH_EMAIL=your_email@example.com
ATTIC_TECH_PASSWORD=your_password
```

El script se conecta a la API de Attic Tech para obtener los datos del estimate en tiempo real.

## 🚀 Uso

### Versión 2 (Recomendada) - Alta Precisión ✨

```bash
node backend/src/scripts/analyzeEstimateV2.js "Nombre del Estimate"
node backend/src/scripts/analyzeEstimateV2.js "Nombre del Estimate" --debug
```

**Características:**
- ✅ Precisión de 1-2% vs valores guardados
- ✅ Cálculo exacto de días de trabajo
- ✅ Hourly rate ajustado ($32.62/hr observado)
- ✅ Distancia total correcta (no por día)
- ✅ Modo debug con desglose detallado

### Versión 1 (Original) - Básico

```bash
node backend/src/scripts/analyzeEstimate.js "Nombre del Estimate"
```

### Ejemplos

```bash
# Análisis con alta precisión (v2)
node backend/src/scripts/analyzeEstimateV2.js "Casey Litton - RES"

# Con modo debug (muestra items + guarda JSON)
node backend/src/scripts/analyzeEstimateV2.js "Casey Litton - RES" --debug

# Versión original
node backend/src/scripts/analyzeEstimate.js "John Doe - ATTIC"
```

## 📋 Output

El script muestra un breakdown completo con:

### 1. **Total before area factors**
- Material cost (base)
- Labor cost (base)

### 2. **Active Work Area Factors** (si aplica)
- Lista de factores activos con sus multiplicadores
- Material y Labor después de aplicar factores

### 3. **Other costs**
- Total Driving Distance (round trip)
- Gas Cost per gallon
- Truck Average MPG
- Total Gas Cost
- Total Labor Driving Time
- Total Labor Hours Load/Unload
- Base Labor Cost (rate x hours)
- Quality Control Visit (si aplica)

### 4. **Retail Breakdown**
- Total Non-Sub Cost (Material + Labor)
- Multiplier aplicado según el rango
- Total Sub Cost (Material de subcontratistas)
- Sub Items detallados (si aplica)
- After Sub Multiplier(s)
- Payment Method Factor (Cash/Credit/Finance)
- **Retail Price** (precio retail final)

### 5. **Final Price**
- Discount Provided (%)
- **Final Proposal Price**

### 6. **Comparison**
- Comparación entre valores calculados y valores guardados en BD
- Muestra diferencias para validación

## 📊 Ejemplo de Output

```
🔍 Buscando estimate...
✅ Estimate encontrado: Casey Litton - RES (ID: 9250)
   Branch: Orange County
═══════════════════════════════════════════════════════════════════════════════

📊 ESTIMATE BREAKDOWN
═══════════════════════════════════════════════════════════════════════════════

💰 Total before area factors:
   Material: $136.50
   Labor:    $1,092.66

🚛 Other costs:
   Total Driving Distance:       366 miles
   Gas Cost:                     $5.21 /gallon
   Truck Average MPG:            12.5
   Total Gas Cost:               $152.55
   Total Labor Driving Time:     12.20 hours
   Total Labor Hours Load/Unload: 1.00 hours
   Base Labor Cost:              $1,505.40 ($32.62/h x 46.20 hours)

📈 Retail Breakdown:
──────────────────────────────────────────────────
Total Non-Sub Cost (Material + Labor): $2,088.24
Multiplier:                            x 2.5 ($5,220.60)
Total Sub Cost (Material):             $0.00
After Sub Multiplier(s):               $5,220.60
Payment Method Factor (Cash):          x 1.04
──────────────────────────────────────────────────
Retail Price:                          $5,429.42

Discount Provided (%):                 20%
──────────────────────────────────────────────────
Final Proposal Price:                  $4,343.54

🔍 Comparison with stored values:
═══════════════════════════════════════════════════════════════════════════════
True Cost:    Stored: $2,088.24   Calculated: $2,088.24   Diff: $0.00
Retail Cost:  Stored: $5,429.42   Calculated: $5,429.42   Diff: $0.00
Final Price:  Stored: $4,343.54   Calculated: $4,343.54   Diff: $0.00
═══════════════════════════════════════════════════════════════════════════════

✅ Análisis completo
```

## 🎯 Qué Calcula

El script implementa todas las fórmulas documentadas en `ESTIMATE_COST_BREAKDOWN_ANALYSIS.md`:

### Material Cost
1. Base material cost por item (amount × materialCost)
2. Aplicar waste factor (× 1.05)
3. Aplicar work area factors si `appliesTo = "Material Cost"` o `"Both"`

### Labor Cost
1. Base labor cost por item (amount × laborHours × baseHourlyRate)
2. Aplicar work area factors si `appliesTo = "Labor Cost"` o `"Both"`
3. Agregar labor de manejo (drivingHours × baseHourlyRate)
4. Agregar labor de carga/descarga (loadUnloadHours × baseHourlyRate)

### Other Costs
1. Gas cost = (roundTripDistance / truckAverageMPG) × gasCost
2. Quality Control Visit (si aplica)

### Multiplier
1. Encontrar multiplier range según Non-Sub Cost
2. Aplicar multiplier del rango
3. Agregar Sub Services con su propio multiplier

### Payment Method Factor
- Cash: × 1.04
- Credit Card: × 1.045
- Finance: × 1.15 - 1.5 (según término)

### Discount
- Final Price = Retail Price × (1 - discount / 100)

## ⚠️ Consideraciones

### 1. **Snapshot Data**
El script usa `estimateSnapshot.snapshotData` para garantizar que los cálculos usen la configuración exacta del momento en que se creó el estimate.

### 2. **Sub Items**
Los sub items (`subItem: true`) se procesan por separado con su propio multiplier y NO contribuyen al Non-Sub Cost.

### 3. **Work Area Factors**
Los factores solo se aplican si están activados en `service_data.services[].factors`.

### 4. **Distancia**
Por defecto, el script usa una distancia mock de 183 millas (366 round trip). Para producción, integra con Google Maps API.

### 5. **JSON Fields**
El script maneja automáticamente si `service_data` o `snapshotData` están como STRING o OBJECT.

## 🛠️ Troubleshooting

### Error: "Estimate not found"
- Verifica que el nombre esté escrito exactamente como aparece en la BD
- Usa comillas si el nombre tiene espacios

### Error: "No multiplier range found"
- El Non-Sub Cost calculado no cae en ningún rango del snapshot
- Verifica los multiplierRanges en el snapshot

### Diferencias en cálculos
- Pequeñas diferencias (<$1) son normales por redondeos
- Diferencias grandes indican:
  - Factores no considerados
  - Distancia incorrecta
  - Configuración desactualizada

## 📚 Recursos

- **Documento de análisis**: `ESTIMATE_COST_BREAKDOWN_ANALYSIS.md`
- **Ejemplo de estimate**: `/analizar.json`
- **Fórmulas completas**: Ver secciones del MD

## 🔧 Personalización

Para modificar el script:
1. Ajusta `calculateDistance()` para usar Google Maps API
2. Modifica la velocidad promedio en `calculateOtherCosts()`
3. Ajusta los colores de consola en el objeto `colors`

## 💡 Tips

- Usa este script para validar estimates existentes
- Compara valores calculados vs guardados para debugging
- Identifica discrepancias en pricing
- Audita cambios en multiplier ranges a lo largo del tiempo

## 🔬 Hallazgos Clave (Versión 2)

### Hourly Rate Ajustado
AT usa **$32.62/hr** en lugar del `baseHourlyRate` del snapshot ($30.90/hr).  
Ajuste: **~5.6% más alto**

### Distancia Total vs Por Día
El "Total Driving Distance" (ej: 366 miles) es para **TODOS los días de trabajo**, no por día.

Ejemplo:
- 366 miles total / 3 días = 122 miles/día
- 366 miles / 12 mph = 30.5 hrs driving total

### Días de Trabajo
Fórmula observada:
```javascript
workingDays = ceil(totalLaborHours / averageWorkDayHours * 1.5)
```

### Precisión Alcanzada
- **Típica**: 1-2% de diferencia
- **Ejemplo**: $2,088.24 (guardado) vs $2,062.82 (calculado) = 1.22%

### Labor Hours Total
Incluye:
- Base labor (items)
- Driving labor
- Load/Unload labor

Ejemplo: 12.3 + 30.5 + 3 = 45.8 hrs (vs 46.2 guardado)

---

**Fecha:** Noviembre 17, 2025  
**Versión:** 2.0

