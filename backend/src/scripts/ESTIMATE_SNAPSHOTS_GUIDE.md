# 📸 Estimate Snapshots Guide

## 🎯 ¿Qué es el Snapshot?

El `snapshot_multiplier_ranges` es un campo JSONB que guarda los **multiplier ranges vigentes** cuando se creó cada estimate. Esto asegura que los precios se mantengan consistentes aunque los rangos cambien en el futuro.

### Ejemplo:
```json
{
  "snapshot_multiplier_ranges": [
    {
      "id": 1,
      "name": "LOW - $1,701-$6,000",
      "minCost": 1701,
      "maxCost": 6000,
      "lowestMultiple": 2.5,
      "highestMultiple": 2.5
    }
  ]
}
```

---

## ✅ Cómo Se Guardan Automáticamente

### Durante el Sync Regular

Cada vez que ejecutas el sync de estimates, el snapshot se guarda automáticamente:

```bash
# Desde Make.com o manualmente
POST /api/estimates/sync
```

**Código responsable:**
```javascript
// backend/src/controllers/estimates.controller.js
const snapshotMultiplierRanges = lead.estimateSnapshot?.snapshotData?.multiplierRanges || null;

// Se guarda en BD
snapshot_multiplier_ranges: snapshotMultiplierRanges
```

---

## 🔍 Verificar Estado Actual

### 1. Ejecutar Query SQL

```bash
psql -U postgres -d postgres -f backend/src/scripts/checkEstimateSnapshots.sql
```

O conectarse a la BD y ejecutar:

```sql
SELECT 
    COUNT(*) as total_estimates,
    COUNT(snapshot_multiplier_ranges) as with_snapshot,
    COUNT(*) - COUNT(snapshot_multiplier_ranges) as without_snapshot,
    ROUND(COUNT(snapshot_multiplier_ranges)::numeric / COUNT(*)::numeric * 100, 2) as percentage_with_snapshot
FROM botzilla.estimate;
```

### Resultado Esperado:
```
 total_estimates | with_snapshot | without_snapshot | percentage_with_snapshot 
-----------------+---------------+------------------+-------------------------
            500  |      450      |        50        |         90.00
```

---

## 🔄 Hacer Backfill de Estimates Antiguos

Si tienes estimates que **no tienen** el snapshot (creados antes de implementar esta funcionalidad), puedes hacer backfill.

### Opción 1: Dry Run (ver qué haría)

```bash
node backend/src/scripts/backfillEstimateSnapshots.js --dry-run
```

**Output:**
```
🔧 Starting Estimate Snapshots Backfill
═══════════════════════════════════════════════════════════════

⚠️  DRY RUN MODE - No changes will be made

📊 Database Stats:
   Total estimates: 500
   With snapshot: 450
   Without snapshot: 50

📝 Processing 50 estimates...

🔐 Logging in to Attic Tech API...
✅ Logged in successfully

[1/50] Processing: John Doe - ATTIC (ID: 123)
  ✅ Found snapshot with 3 ranges
  💾 Would update (dry run)
...
```

### Opción 2: Backfill Limitado (testing)

```bash
# Solo los primeros 10 estimates
node backend/src/scripts/backfillEstimateSnapshots.js --limit 10
```

### Opción 3: Backfill Completo

```bash
# ⚠️  ESTO ACTUALIZA LA BD
node backend/src/scripts/backfillEstimateSnapshots.js
```

**Output:**
```
📊 SUMMARY:
   Successfully processed: 48
   Failed: 0
   Not found in AT: 1
   No snapshot available: 1

✅ Backfill completed!
```

---

## 🎨 Cómo Se Usan en el Frontend

### Follow-Up Estimates Table

Cuando se muestran los estimates, el backend calcula automáticamente el `calculated_multiplier`:

```javascript
// backend/src/controllers/estimates.controller.js - calculatePricingFactors()

// PRIORIDAD 1: Usar snapshot (datos históricos correctos)
if (estimate.snapshot_multiplier_ranges) {
    // Buscar en qué rango cae el true_cost
    const multiplier = findRangeForCost(estimate.price, snapshot_multiplier_ranges);
}

// PRIORIDAD 2: Usar configuración actual del branch
if (!multiplier && estimate.branch_id) {
    // Usar multiplier_ranges actuales
}
```

### Resultado en UI:

```
Multiplier: 2.5x   ← Viene del snapshot guardado
Sub Multi: 1.75x
PM Factor: 1.065x
```

---

## 📊 Flujo Completo

```
┌─────────────────────────────────────────────┐
│ Attic Tech crea/actualiza estimate          │
│ - Tiene estimateSnapshot con multiplierRanges│
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Sync ejecutado (automático o manual)        │
│ POST /api/estimates/sync                    │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Backend extrae snapshot:                    │
│ lead.estimateSnapshot.snapshotData          │
│   .multiplierRanges                         │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Guarda en BD:                               │
│ snapshot_multiplier_ranges (JSONB)          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Frontend consulta estimates                 │
│ GET /api/estimates                          │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Backend calcula pricing factors:            │
│ - calculated_multiplier (del snapshot)      │
│ - sub_multiplier (de branch config)         │
│ - payment_method_factor (1.065)             │
└──────────────────┬──────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│ Frontend muestra en tabla:                  │
│ Multiplier: 2.5x, Sub Multi: 1.75x, etc.   │
└─────────────────────────────────────────────┘
```

---

## ⚠️ Consideraciones Importantes

### 1. Estimates Antiguos

Los estimates creados **antes de implementar** el snapshot no tendrán este campo hasta que:
- Se sincronicen de nuevo desde Attic Tech, O
- Se ejecute el script de backfill

### 2. Multiplier Ranges Cambiantes

Los multiplier ranges **pueden cambiar** en Attic Tech:

```javascript
// Antes (en estimate de Enero)
{ minCost: 1701, maxCost: 6000, lowestMultiple: 2.75 }

// Ahora (en branch configuration actual)
{ minCost: 1701, maxCost: 6000, lowestMultiple: 2.5 }  // ¡Cambió!

// El snapshot preserva el 2.75x original para estimates de Enero
```

### 3. Fallback Automático

Si un estimate **no tiene snapshot**, el sistema usa la configuración actual del branch:

```javascript
// calculatePricingFactors() tiene fallback automático
if (!snapshot_multiplier_ranges && branch_id) {
    // Usa branch.configuration.multiplierRanges actuales
}
```

---

## 🛠️ Troubleshooting

### Problema: "Estimates muestran N/A en multiplier"

**Causa:** No tienen snapshot y no se puede calcular del branch config actual.

**Solución:** Ejecutar backfill o re-sincronizar.

### Problema: "Multiplier no coincide con frontend de AT"

**Causa:** El multiplier range cambió después de crear el estimate.

**Solución:** Esto es correcto. El snapshot preserva el pricing original.

### Problema: "Backfill falla con 401 Unauthorized"

**Causa:** Credenciales de AT incorrectas en `.env`.

**Solución:** Verificar `ATTIC_TECH_EMAIL` y `ATTIC_TECH_PASSWORD`.

---

## 📝 Scripts Disponibles

| Script | Descripción | Uso |
|--------|-------------|-----|
| `checkEstimateSnapshots.sql` | Verificar cuántos estimates tienen snapshot | `psql -f script.sql` |
| `backfillEstimateSnapshots.js` | Hacer backfill de snapshots faltantes | `node script.js` |
| `analyzeEstimateV2.js` | Analizar pricing de un estimate específico | `node script.js "Name"` |

---

**Última actualización:** Noviembre 17, 2025  
**Versión:** 1.0

