# Branch Configuration Setup - Guía Completa

## 📋 Descripción General

El sistema de configuración de branches ahora tiene 3 tablas relacionadas:

```
Branch → BranchConfiguration → MultiplierRange
  (1:1)         (1:N)
```

### Estructura de Tablas

1. **`branch`** - Branch existente + FK a `branch_configuration`
2. **`branch_configuration`** - Todos los `baseConstants` y `financeFactors` de Attic Tech
3. **`multiplier_range`** - Rangos de multiplicadores para cada configuración

---

## 🔧 Orden de Migr aciones (IMPORTANTE)

**Debes ejecutar las migraciones en este orden exacto:**

```bash
# 1️⃣ Crear tabla branch_configuration primero (sin esta no puedes crear el FK en branch)
psql -U your_user -d your_db -f backend/src/migrations/create_branch_configuration_table.sql

# 2️⃣ Modificar tabla branch para agregar FK a branch_configuration
psql -U your_user -d your_db -f backend/src/migrations/add_attic_tech_branch_id_to_branch.sql

# 3️⃣ Renombrar y modificar la tabla de multiplier ranges
psql -U your_user -d your_db -f backend/src/migrations/modify_multiplier_range_structure.sql
```

⚠️ **NOTA:** Si ejecutas la migración #2 antes de la #1, fallará porque intenta crear un FK a una tabla que aún no existe.

---

## 📊 Estructura de Datos

### `branch` (tabla existente + nuevo campo)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `name` | VARCHAR | Nombre del branch |
| `attic_tech_branch_id` | INTEGER | ID del branch en AT |
| **`branch_configuration_id`** | **INTEGER** | **FK a branch_configuration** |

### `branch_configuration` (nueva tabla)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `at_config_id` | INTEGER | Config ID en AT (unique) |
| `name` | VARCHAR | Nombre de la configuración |
| `base_hourly_rate` | DECIMAL | Tarifa base por hora |
| `average_work_day_hours` | DECIMAL | Horas promedio de trabajo |
| `waste_factor` | DECIMAL | Factor de desperdicio |
| `credit_card_fee` | DECIMAL | Tarifa de tarjeta de crédito |
| `gas_cost` | DECIMAL | Costo de gasolina |
| `truck_average_mpg` | DECIMAL | MPG promedio del camión |
| `labor_hours_load_unload` | DECIMAL | Horas de carga/descarga |
| `sub_multiplier` | DECIMAL | Multiplicador de subcontratista |
| `cash_factor` | DECIMAL | Factor de pago en efectivo |
| `max_discount` | DECIMAL | Descuento máximo |
| `address` | TEXT | Dirección |
| `min_retail_price` | DECIMAL | Precio mínimo de venta |
| `b2b_max_discount` | DECIMAL | Descuento B2B máximo |
| `quality_control_visit_price` | DECIMAL | Precio de visita de control |
| `bonus_pool_percentage` | DECIMAL | Porcentaje de bono |
| `bonus_payout_cutoff` | DECIMAL | Límite de pago de bono |
| `leaderboard_color_percentage` | DECIMAL | Porcentaje de color de tabla |
| `max_open_estimates` | INTEGER | Máximo de estimates abiertos |
| **`finance_factors`** | **JSONB** | **Factores de financiamiento** |
| `at_created_at` | TIMESTAMP | Fecha de creación en AT |
| `at_updated_at` | TIMESTAMP | Fecha de actualización en AT |

### `multiplier_range` (tabla renombrada/modificada)

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| **`branch_configuration_id`** | **INTEGER** | **FK a branch_configuration** |
| `name` | VARCHAR | Nombre del rango |
| `min_cost` | DECIMAL | Costo mínimo |
| `max_cost` | DECIMAL | Costo máximo (null = ilimitado) |
| `lowest_multiple` | DECIMAL | Multiplicador mínimo |
| `highest_multiple` | DECIMAL | Multiplicador máximo |
| `at_multiplier_range_id` | INTEGER | ID del rango en AT (unique) |
| `at_created_at` | TIMESTAMP | Fecha de creación en AT |
| `at_updated_at` | TIMESTAMP | Fecha de actualización en AT |

---

## 🚀 Primer Sync - Configuración Inicial

### Paso 1: Mapear IDs de Attic Tech (Solo por Branches, no Config IDs todavía)

```sql
-- Solo mapear attic_tech_branch_id (el branch_configuration_id se asignará automáticamente)
UPDATE botzilla.branch SET attic_tech_branch_id = 8 WHERE name = 'Los Angeles';
UPDATE botzilla.branch SET attic_tech_branch_id = 4 WHERE name = 'San Diego';
UPDATE botzilla.branch SET attic_tech_branch_id = 5 WHERE name = 'Orange County';
UPDATE botzilla.branch SET attic_tech_branch_id = 1 WHERE name = 'San Bernardino';
UPDATE botzilla.branch SET attic_tech_branch_id = 2 WHERE name = 'Kent -WA';
UPDATE botzilla.branch SET attic_tech_branch_id = 3 WHERE name = 'Everett -WA';
```

### Paso 2: Ejecutar el Primer Sync con Config IDs Específicos

Como aún no tienes configuraciones en la BD, debes especificar manualmente los AT Config IDs:

```bash
GET https://yallaprojects.com/api/automations/multiplier-ranges-sync?configIds=7
Headers: x-api-key: YOUR_API_KEY
```

Donde `7` es el `at_config_id` de Los Angeles según el JSON que me compartiste.

**Esto hará:**
1. Crear el registro en `branch_configuration` con `at_config_id = 7`
2. Crear todos los `multiplier_range` asociados
3. Actualizar el branch "Los Angeles" con `branch_configuration_id` apuntando a la configuración creada

### Paso 3: Repetir para Cada Branch

```bash
# Para cada branch, ejecuta con su respectivo at_config_id
GET .../multiplier-ranges-sync?configIds=7  # Los Angeles
GET .../multiplier-ranges-sync?configIds=8  # San Diego
GET .../multiplier-ranges-sync?configIds=9  # Orange County
# ... etc
```

### Paso 4: Usar `all=true` (Después del Primer Sync)

Una vez que al menos un branch tenga `branch_configuration_id` asignado, puedes usar:

```bash
GET https://yallaprojects.com/api/automations/multiplier-ranges-sync?all=true
Headers: x-api-key: YOUR_API_KEY
```

Esto sincronizará **todos** los branches que ya tengan configuraciones asociadas.

---

## 🔄 Comportamiento del Sync

### ¿Qué Hace el Endpoint?

1. **Fetch Configuration**: Llama a `/api/configurations/{at_config_id}` en Attic Tech
2. **Upsert BranchConfiguration**: Crea o actualiza el registro con todos los `baseConstants` y `financeFactors`
3. **Link Branch**: Actualiza `branch.branch_configuration_id` con el ID de la configuración
4. **Upsert MultiplierRanges**: Crea o actualiza todos los rangos de la configuración

### Ejemplo de Log del Sync

```
📊 Fetching all branches with config IDs from database...
📋 Found 1 branches: Los Angeles (Config: 7)
🔑 Logging into Attic Tech...
📥 Fetching configuration for Los Angeles (Config ID: 7)...
  ✅ Created configuration: LA Configuration
  🔗 Linked branch Los Angeles to configuration 1
  📊 Found 3 multiplier ranges
    ✅ Created: LOW $0-$1700 ($4-$1700)
    ✅ Created: LOW - $1,701-$6,000 ($1701-$6000)
    ✅ Created: LOW- $6000+ ($6000-∞)
✅ Multiplier ranges sync completed. Total ranges: 3, Created: 3, Updated: 0
```

---

## 📝 Respuesta del Endpoint

```json
{
  "success": true,
  "message": "✅ Multiplier ranges sync completed. Total ranges: 9, Created: 9, Updated: 0",
  "summary": {
    "branches_processed": 3,
    "total_ranges_fetched": 9,
    "total_ranges_created": 9,
    "total_ranges_updated": 0
  },
  "results": [
    {
      "branch_name": "Los Angeles",
      "at_config_id": 7,
      "total_ranges": 3,
      "created": 3,
      "updated": 0,
      "status": "success"
    }
  ]
}
```

---

## 🔍 Verificar la Estructura

### Ver Configuraciones

```sql
SELECT * FROM botzilla.branch_configuration;
```

### Ver Branches con sus Configuraciones

```sql
SELECT 
    b.id,
    b.name as branch_name,
    b.attic_tech_branch_id,
    bc.at_config_id,
    bc.name as config_name
FROM botzilla.branch b
LEFT JOIN botzilla.branch_configuration bc 
    ON b.branch_configuration_id = bc.id;
```

### Ver Multiplier Ranges por Branch

```sql
SELECT 
    b.name as branch_name,
    bc.name as config_name,
    mr.name as range_name,
    mr.min_cost,
    mr.max_cost,
    mr.lowest_multiple,
    mr.highest_multiple
FROM botzilla.branch b
JOIN botzilla.branch_configuration bc 
    ON b.branch_configuration_id = bc.id
JOIN botzilla.multiplier_range mr 
    ON mr.branch_configuration_id = bc.id
ORDER BY b.name, mr.min_cost;
```

---

## ⚠️ Troubleshooting

### Error: "FK constraint fails" al ejecutar migración #2

**Causa:** Intentaste ejecutar `add_attic_tech_branch_id_to_branch.sql` antes de crear `branch_configuration`.

**Solución:** Ejecuta primero `create_branch_configuration_table.sql`.

### Error: "No branches with branch_configuration_id found"

**Causa:** Ningún branch tiene configuración asignada todavía.

**Solución:** Ejecuta el primer sync con `configIds` específicos, no con `all=true`.

### Branch no se actualiza con `branch_configuration_id`

**Verifica:**
1. ¿El `botzilla_branch_id` es correcto?
2. ¿El branch existe en la BD?
3. ¿La configuración se creó correctamente?

**Debug:**
```sql
SELECT id, name, branch_configuration_id FROM botzilla.branch WHERE name = 'Los Angeles';
```

---

## 💡 Uso Futuro

Con esta estructura, podrás:
1. Calcular el precio de un estimate usando `true_cost * multiplier`
2. Aplicar diferentes multiplicadores según el rango de precio
3. Considerar el `payment_method` y aplicar factores adicionales (`finance_factors`)
4. Usar todos los `baseConstants` para cálculos complejos

**Ejemplo de Cálculo:**

```javascript
// 1. Obtener true_cost del estimate
const trueCost = 5000;

// 2. Buscar el multiplier_range correcto
const range = await MultiplierRange.findOne({
    include: [{
        model: BranchConfiguration,
        as: 'configuration',
        include: [{
            model: Branch,
            as: 'branches',
            where: { id: estimateBranchId }
        }]
    }],
    where: {
        min_cost: { [Op.lte]: trueCost },
        [Op.or]: [
            { max_cost: { [Op.gte]: trueCost } },
            { max_cost: null }
        ]
    }
});

// 3. Aplicar multiplier
const basePrice = trueCost * range.lowest_multiple;

// 4. Aplicar finance factor si aplica
const config = range.configuration;
const financeMonths = 6;
const financeMultiplier = config.finance_factors?.[financeMonths] || 1;
const finalPrice = basePrice * financeMultiplier;
```

---

## 📚 Archivos Relacionados

- `backend/src/migrations/create_branch_configuration_table.sql`
- `backend/src/migrations/add_attic_tech_branch_id_to_branch.sql`
- `backend/src/migrations/modify_multiplier_range_structure.sql`
- `backend/src/models/BranchConfiguration.js`
- `backend/src/models/MultiplierRange.js`
- `backend/src/models/Branch.js`
- `backend/src/models/index.js`
- `backend/src/controllers/automations.controller.js`
- `backend/MULTIPLIER_RANGES_SYNC.md`

