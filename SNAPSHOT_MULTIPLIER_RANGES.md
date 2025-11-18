# Snapshot de Multiplier Ranges por Estimate

## 📋 Contexto

Los **multiplier ranges** son dinámicos en Attic Tech y pueden cambiar con el tiempo:
- **Hoy**: 2.75x para $1,700-$6,000
- **Mañana**: 2.5x para el mismo rango

Sin embargo, cada estimate se calcula con los multipliers vigentes **en el momento de su creación**, no con los actuales.

## ✅ Solución Implementada

### 1. Campo `snapshot_multiplier_ranges` en Estimate

Se agregó un campo JSONB al modelo `Estimate` que guarda los multiplier ranges históricos:

```javascript
snapshot_multiplier_ranges: {
    type: DataTypes.JSONB,
    allowNull: true,
    comment: 'Snapshot de multiplier ranges vigentes cuando se creó el estimate'
}
```

### 2. Captura durante el Sync

Durante el sync de estimates, se captura `estimateSnapshot.snapshotData.multiplierRanges`:

```javascript
// En mapAtticTechDataToEstimates
const snapshotMultiplierRanges = lead.estimateSnapshot?.snapshotData?.multiplierRanges || null;
```

### 3. Cálculo de Pricing Factors

La función `calculatePricingFactors` ahora usa el snapshot con **prioridad**:

**PRIORIDAD 1**: Usar `snapshot_multiplier_ranges` (datos históricos correctos)
```javascript
if (estimate.snapshot_multiplier_ranges && Array.isArray(estimate.snapshot_multiplier_ranges)) {
    // Usar el snapshot del estimate
    calculatedMultiplier = ...;
}
```

**PRIORIDAD 2**: Si no hay snapshot, usar la configuración actual del branch
```javascript
if (calculatedMultiplier === null && estimate.branch_id) {
    // Consultar BranchConfiguration actual
    calculatedMultiplier = ...;
}
```

## 📊 Estructura del Snapshot

El snapshot guarda el array completo de multiplier ranges vigentes en el momento de creación:

```json
{
  "snapshot_multiplier_ranges": [
    {
      "id": 1,
      "name": "SOS - $6000+",
      "minCost": 6000.01,
      "maxCost": null,
      "lowestMultiple": 2.25,
      "highestMultiple": 2.25
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
      "lowestMultiple": 2.75,
      "highestMultiple": 2.75
    }
  ]
}
```

## 🎯 Beneficios

1. **Precisión histórica**: Cada estimate muestra el multiplier exacto usado en su creación
2. **Independencia**: No depende de la configuración actual del branch
3. **Auditoría**: Permite rastrear cambios en pricing a lo largo del tiempo
4. **Fallback**: Si no hay snapshot (estimates antiguos), usa la configuración actual

## 🔄 Próximos pasos

Al ejecutar el **próximo sync de estimates**, todos los estimates nuevos o actualizados tendrán su `snapshot_multiplier_ranges` guardado automáticamente.

Los estimates existentes (antes de este cambio) usarán la configuración actual del branch hasta que se actualicen desde Attic Tech.

## 📁 Archivos Modificados

- `backend/src/models/Estimate.js` - Agregado campo `snapshot_multiplier_ranges`
- `backend/src/controllers/estimates.controller.js` - Captura y usa snapshot
- `frontend/src/services/estimateService.ts` - Tipo TypeScript actualizado
- `backend/src/migrations/add_snapshot_multiplier_ranges_to_estimate.sql` - Migración SQL

## 🎉 Resultado

Ahora cada estimate tiene su **historia de pricing** preservada, sin importar cuánto cambien los multiplier ranges en el futuro.

