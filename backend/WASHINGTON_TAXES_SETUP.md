# Washington State Taxes Implementation

Sistema para calcular taxes de Washington State (State 6.5% + City variable) en estimates.

## 📋 Archivos creados:

### 1. **Migraciones SQL**:
- `backend/src/migrations/create_wa_tax_rates_table.sql`
- `backend/src/migrations/add_tax_fields_to_estimate.sql`

### 2. **Modelos**:
- `backend/src/models/WaTaxRate.js` - Modelo para tax rates por ZIP code
- `backend/src/models/Estimate.js` - Actualizado con campos de tax

### 3. **Utilidades**:
- `backend/src/utils/taxCalculator.js` - Helper para calcular taxes

## 🚀 Pasos de implementación:

### Paso 1: Ejecutar migraciones SQL

```bash
# En PostgreSQL (orden importante):

# 1. Crear tabla wa_tax_rates
psql -h 127.0.0.1 -U postgres -d tu_database -f backend/src/migrations/create_wa_tax_rates_table.sql

# 2. Agregar campos de tax a estimate
psql -h 127.0.0.1 -U postgres -d tu_database -f backend/src/migrations/add_tax_fields_to_estimate.sql
```

### Paso 2: Verificar las tablas creadas

```sql
-- Verificar wa_tax_rates
SELECT * FROM botzilla.wa_tax_rates LIMIT 10;

-- Verificar que estimate tiene los nuevos campos
\d botzilla.estimate
```

### Paso 3: Integrar en el sync de estimates

En `backend/src/controllers/estimates.controller.js`, agregar la lógica de cálculo de taxes:

```javascript
const { calculateWashingtonTaxes } = require('../utils/taxCalculator');

// Durante el sync o al guardar un estimate:
if (estimate.customer_address && estimate.final_price) {
    const taxData = await calculateWashingtonTaxes(
        parseFloat(estimate.final_price),
        estimate.customer_address
    );
    
    // Guardar en el estimate
    await estimate.update({
        ...taxData
    });
}
```

## 📊 Estructura de datos:

### Tabla `wa_tax_rates`:
```sql
- zip_code (VARCHAR 10, UNIQUE) - ZIP code de WA
- city_name (VARCHAR 100) - Nombre de la ciudad
- county_name (VARCHAR 100) - Nombre del county
- city_tax_rate (DECIMAL 5,4) - City tax rate (ej: 0.037 = 3.7%)
- state_tax_rate (DECIMAL 5,4) - State tax rate (0.065 = 6.5%)
- total_tax_rate (DECIMAL 5,4) - Total (city + state)
- effective_date (DATE) - Fecha efectiva del rate
```

### Campos agregados a `estimate`:
```sql
- city_tax_rate (DECIMAL 5,4) - Rate de city tax aplicado
- state_tax_rate (DECIMAL 5,4) - Rate de state tax aplicado
- total_tax_rate (DECIMAL 5,4) - Rate total aplicado
- city_tax_amount (DECIMAL 10,2) - Monto de city tax
- state_tax_amount (DECIMAL 10,2) - Monto de state tax
- total_tax_amount (DECIMAL 10,2) - Monto total de taxes
- price_before_taxes (DECIMAL 10,2) - Precio antes de taxes
- price_after_taxes (DECIMAL 10,2) - Precio final con taxes
```

## 🧮 Fórmula de cálculo:

```
Price Before Taxes = final_price (con discount ya aplicado)

City Tax Amount = Price Before Taxes × city_tax_rate
State Tax Amount = Price Before Taxes × state_tax_rate
Total Tax Amount = Price Before Taxes × total_tax_rate

Price After Taxes = Price Before Taxes + Total Tax Amount
```

## 📝 Ejemplo de cálculo:

```javascript
// Estimate de Bonney Lake, WA (ZIP 98391)
Price Before Taxes: $23,813.14

City Tax (3.7%): $23,813.14 × 0.037 = $881.08
State Tax (6.5%): $23,813.14 × 0.065 = $1,547.85
Total Tax: $881.08 + $1,547.85 = $2,428.93

Price After Taxes: $23,813.14 + $2,428.93 = $26,242.07
```

## 🔍 Función `calculateWashingtonTaxes()`:

```javascript
const taxData = await calculateWashingtonTaxes(23813.14, '7205 Perry Ave SE, Bonney Lake, WA 98391');

// Retorna:
{
    city_tax_rate: 0.037,
    state_tax_rate: 0.065,
    total_tax_rate: 0.102,
    city_tax_amount: 881.08,
    state_tax_amount: 1547.85,
    total_tax_amount: 2428.93,
    price_before_taxes: 23813.14,
    price_after_taxes: 26242.07
}
```

## 📥 Datos iniciales:

La tabla `wa_tax_rates` viene pre-poblada con tax rates de:
- Seattle (múltiples ZIP codes)
- Everett
- Tacoma
- Bellevue
- Kent
- Bonney Lake
- Y más ciudades principales

## 🔄 Actualizar tax rates:

Para agregar o actualizar tax rates:

```sql
INSERT INTO botzilla.wa_tax_rates (zip_code, city_name, county_name, city_tax_rate, state_tax_rate, total_tax_rate, effective_date)
VALUES ('98001', 'Auburn', 'King', 0.0370, 0.065, 0.1020, '2024-01-01')
ON CONFLICT (zip_code) 
DO UPDATE SET
    city_tax_rate = EXCLUDED.city_tax_rate,
    total_tax_rate = EXCLUDED.total_tax_rate,
    updated_at = CURRENT_TIMESTAMP;
```

## ⚠️ Notas importantes:

1. **Solo aplica a Washington State**: La función verifica que el address contenga "WA" o "Washington"
2. **ZIP code requerido**: Si no encuentra ZIP code en el address, no calcula taxes
3. **Fallback a state tax only**: Si el ZIP no está en la tabla, usa solo el 6.5% de state tax
4. **Formato de address**: Debe contener el ZIP code en formato estándar (5 dígitos)

## 🎯 Frontend:

Los nuevos campos estarán disponibles en la respuesta de la API de estimates y pueden mostrarse en la UI:

```typescript
interface Estimate {
  // ... campos existentes
  city_tax_rate: number | null;
  state_tax_rate: number | null;
  total_tax_amount: number | null;
  price_before_taxes: number | null;
  price_after_taxes: number | null;
}
```

## 📚 Recursos:

- Washington State DOR: https://dor.wa.gov/taxes-rates/sales-use-tax-rates
- Tax Rate Lookup: https://dor.wa.gov/find-taxes-rates

---

**Última actualización**: Noviembre 2025

