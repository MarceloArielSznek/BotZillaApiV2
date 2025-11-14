# Multiplier Ranges Sync - Documentation

## 📋 Descripción

Este endpoint sincroniza los **multiplier ranges** (rangos de multiplicadores de precio) desde Attic Tech a la base de datos de BotZilla. 

Cada **branch tiene una configuración** en Attic Tech que contiene:
- `baseConstants` - Constantes base (tasas, factores, etc.)
- `multiplier_ranges` - **Array** de múltiples rangos de precios con sus multiplicadores

Los multiplier ranges son usados para calcular el precio final de un estimate basado en el `true_cost` y el rango de precios en el que cae.

## 🔗 Endpoint

```
GET /api/automations/multiplier-ranges-sync?configIds={comma-separated-ids}
GET /api/automations/multiplier-ranges-sync?all=true
```

**Autenticación:** Requiere `x-api-key` header

## 📥 Request

### Query Parameters

| Parámetro | Tipo | Requerido | Descripción | Ejemplo |
|-----------|------|-----------|-------------|---------|
| `configIds` | string | ⚠️ Condicional* | IDs de configuraciones en Attic Tech separados por comas | `"7,8,9"` |
| `all` | boolean | ⚠️ Condicional* | Si es `true`, sincroniza todos los branches que tienen `attic_tech_config_id` en la BD | `true` |

**\* Nota:** Debes proporcionar **uno de los dos** parámetros: `configIds` o `all=true`

### Headers

```
x-api-key: YOUR_API_KEY_HERE
```

## 📤 Response

### Success Response (200)

```json
{
  "success": true,
  "message": "✅ Multiplier ranges sync completed. Total ranges: 9, Created: 6, Updated: 3",
  "summary": {
    "branches_processed": 3,
    "total_ranges_fetched": 9,
    "total_ranges_created": 6,
    "total_ranges_updated": 3
  },
  "results": [
    {
      "branch_name": "Los Angeles",
      "at_config_id": 7,
      "total_ranges": 3,
      "created": 2,
      "updated": 1,
      "status": "success"
    },
    {
      "branch_name": "San Diego",
      "at_config_id": 8,
      "total_ranges": 3,
      "created": 2,
      "updated": 1,
      "status": "success"
    },
    {
      "branch_name": "Orange County",
      "at_config_id": 9,
      "total_ranges": 3,
      "created": 2,
      "updated": 1,
      "status": "success"
    }
  ]
}
```

### Error Response (400)

```json
{
  "success": false,
  "message": "Either configIds (comma-separated list) or all=true query parameter is required"
}
```

### Error Response (500)

```json
{
  "success": false,
  "message": "Error syncing multiplier ranges",
  "error": "Detailed error message"
}
```

## 🗃️ Estructura de Datos en Attic Tech

Cada **configuración** de branch en AT tiene esta estructura:

```json
{
  "id": 7,
  "name": "LA Configuration",
  "baseConstants": {
    "baseHourlyRate": 35,
    "averageWorkDayHours": 9,
    "wasteFactor": 1.05,
    "creditCardFee": 1.065,
    "gasCost": 5.21,
    "truckAverageMPG": 12.5,
    "laborHoursLoadUnload": 1,
    "subMultiplier": 1.75,
    "cashFactor": 1.065,
    "maxDiscount": 20,
    "minRetailPrice": 3700,
    "financeFactors": {
      "3": 1.5,
      "6": 1.25,
      "12": 1.15
    }
  },
  "multiplier_ranges": [
    {
      "id": 4,
      "name": "LOW - $1,701-$6,000",
      "minCost": 1701,
      "maxCost": 6000,
      "lowestMultiple": 2.75,
      "highestMultiple": 2.75,
      "updatedAt": "2025-07-14T16:08:22.825Z",
      "createdAt": "2025-06-08T19:23:47.538Z"
    },
    {
      "id": 5,
      "name": "LOW- $6000+",
      "minCost": 6000,
      "maxCost": null,
      "lowestMultiple": 2.5,
      "highestMultiple": 2.5,
      "updatedAt": "2025-07-14T16:08:43.379Z",
      "createdAt": "2025-06-08T19:23:47.542Z"
    },
    {
      "id": 9,
      "name": "LOW $0-$1700",
      "minCost": 4,
      "maxCost": 1700,
      "lowestMultiple": 3,
      "highestMultiple": 3,
      "updatedAt": "2025-07-14T16:09:03.448Z",
      "createdAt": "2025-06-08T19:23:47.555Z"
    }
  ]
}
```

**Nota:** Actualmente solo sincronizamos el array `multiplier_ranges`. Los `baseConstants` pueden agregarse en el futuro si es necesario.

## 💾 Tabla en Base de Datos

Los datos se guardan en `botzilla.branch_multiplier_config`:

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `id` | SERIAL | Primary key |
| `at_branch_id` | INTEGER | ID del branch en Attic Tech |
| `branch_id` | INTEGER | ID del branch en BotZilla (nullable si no está mapeado) |
| `name` | VARCHAR(100) | Nombre del rango (ej: "LOW $0-$1700") |
| `min_cost` | DECIMAL(10,2) | Precio mínimo del rango |
| `max_cost` | DECIMAL(10,2) | Precio máximo del rango (null = sin límite) |
| `lowest_multiple` | DECIMAL(5,3) | Multiplicador más bajo |
| `highest_multiple` | DECIMAL(5,3) | Multiplicador más alto |
| `at_multiplier_range_id` | INTEGER | ID del rango en Attic Tech (unique) |
| `at_created_at` | TIMESTAMP | Fecha de creación en AT |
| `at_updated_at` | TIMESTAMP | Fecha de actualización en AT |

## 🔄 Comportamiento

1. **Login automático**: El endpoint se autentica automáticamente en Attic Tech
2. **Buscar branches**: 
   - Si `all=true`: busca todos los branches con `attic_tech_config_id` en la BD
   - Si `configIds`: busca los branches con esos config IDs específicos
3. **Fetch configuración por branch**: Para cada branch, llama al endpoint de AT:
   ```
   GET https://www.attic-tech.com/api/configurations/{configId}?depth=2
   ```
4. **Procesar array de rangos**: Extrae todos los `multiplier_ranges` de la configuración
5. **Upsert múltiple**: Para cada rango:
   - Si ya existe (por `at_multiplier_range_id`), lo actualiza
   - Si no, lo crea nuevo
6. **Resultado por branch**: Reporta cuántos rangos se crearon/actualizaron por cada branch

## 🎯 Ejemplo de Uso con Make.com

### Opción 1: Sincronizar configuraciones específicas

```
Method: GET
URL: https://yallaprojects.com/api/automations/multiplier-ranges-sync
Query String:
  configIds: 7,8,9
Headers:
  x-api-key: YOUR_API_KEY
```

### Opción 2: Sincronizar TODOS los branches (Recomendado) ⭐

```
Method: GET
URL: https://yallaprojects.com/api/automations/multiplier-ranges-sync
Query String:
  all: true
Headers:
  x-api-key: YOUR_API_KEY
```

### Respuesta Esperada

```json
{
  "success": true,
  "message": "✅ Multiplier ranges sync completed. Total ranges: 15, Created: 10, Updated: 5",
  "summary": {
    "branches_processed": 5,
    "total_ranges_fetched": 15,
    "total_ranges_created": 10,
    "total_ranges_updated": 5
  },
  "results": [
    {
      "branch_name": "Los Angeles",
      "at_config_id": 7,
      "total_ranges": 3,
      "created": 2,
      "updated": 1,
      "status": "success"
    }
  ]
}
```

## 📊 Status Types

| Status | Descripción |
|--------|-------------|
| `created` | Nuevo multiplier range creado en la BD |
| `updated` | Multiplier range existente actualizado |
| `not_found` | No se encontró multiplier range en AT para ese branch ID |
| `error` | Error al procesar ese branch específico |

## 🔒 Seguridad

- **Requiere API Key**: Validada mediante `validateApiKey` middleware
- **Solo GET**: Endpoint de solo lectura desde la perspectiva del cliente
- **Write Operations**: El endpoint escribe en la BD, pero es seguro porque usa upsert

## 📝 Migraciones Necesarias

Antes de usar este endpoint, ejecutar:

```bash
psql -U your_user -d your_db -f backend/src/migrations/create_branch_multiplier_config_table.sql
```

## 💡 Uso Futuro

Estos multiplier ranges se usarán para:
1. Calcular el precio final de un estimate: `final_price = true_cost * multiplier`
2. Aplicar diferentes multiplicadores según el rango de precio en el que cae el `true_cost`
3. Considerar el `payment_method` para aplicar factores adicionales

## 🔍 Cómo Obtener los Config IDs de Attic Tech

### Opción 1: Consultar la tabla branch

```sql
SELECT id, name, attic_tech_branch_id, attic_tech_config_id 
FROM botzilla.branch 
WHERE attic_tech_config_id IS NOT NULL;
```

### Opción 2: Consultar directamente en AT API

Cada branch en Attic Tech tiene una configuración asociada. Para obtener el config ID de un branch específico, consulta el branch en AT API y busca su `configuration.id`.

### Mapeo Inicial Requerido

Antes de usar el endpoint, debes ejecutar la migración y mapear cada branch:

```sql
-- Ejecutar migración
psql -U your_user -d your_db -f backend/src/migrations/add_attic_tech_branch_id_to_branch.sql

-- Mapear cada branch (ajustar según tus datos reales)
UPDATE botzilla.branch SET attic_tech_branch_id = 8, attic_tech_config_id = 7 WHERE name = 'Los Angeles';
UPDATE botzilla.branch SET attic_tech_branch_id = 4, attic_tech_config_id = 8 WHERE name = 'San Diego';
UPDATE botzilla.branch SET attic_tech_branch_id = 5, attic_tech_config_id = 9 WHERE name = 'Orange County';
-- ... etc para todos los branches
```

## ⚠️ Consideraciones

1. **Branch Mapping**: Cada branch debe tener configurado su `attic_tech_config_id` para que el sync funcione con `all=true`.
2. **Múltiples Rangos**: Cada branch tiene **múltiples** multiplier ranges (típicamente 3-5 rangos por branch).
3. **Updates**: Los multiplier ranges se actualizan basados en `at_multiplier_range_id` (unique), no por branch.
4. **BaseConstants**: Los `baseConstants` de la configuración NO se sincronizan actualmente (solo los `multiplier_ranges`).
5. **Procesamiento en Batch**: Todos los rangos de un branch se procesan de una sola vez al llamar a su configuración.

