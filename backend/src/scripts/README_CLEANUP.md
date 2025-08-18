# Limpieza de Salespersons Duplicados

## Descripción

Este sistema incluye funcionalidades para limpiar duplicados de salespersons y gestionar su estado activo/inactivo.

## Funcionalidades Implementadas

### 1. Visualización de Salespersons Inactivos

- **Toggle "Show Inactive"**: Permite mostrar/ocultar salespersons inactivos en el frontend
- **Indicador visual**: Los salespersons inactivos se muestran con:
  - Fondo gris claro
  - Opacidad reducida
  - Chip "Inactive" junto al nombre
- **Toggle de estado**: Switch para activar/desactivar salespersons individualmente

### 2. Prevención de Duplicados en Sync

La función `findOrCreateSalesPerson` ha sido mejorada para:

- **Buscar primero entre activos**: Evita crear duplicados si ya existe un salesperson activo
- **Reactivar inactivos**: Si encuentra un salesperson inactivo con el mismo nombre, lo reactiva
- **Heurística mejorada**: Busca coincidencias tanto entre activos como inactivos
- **Priorización**: Prioriza salespersons con telegram_id configurado

### 3. Script de Limpieza Automática

#### Características del Script:

1. **Detección de duplicados**: Encuentra salespersons con nombres idénticos (ignorando mayúsculas/minúsculas)
2. **Priorización inteligente**: 
   - Prioriza salespersons con telegram_id configurado
   - Mantiene el registro con ID más bajo como principal
3. **Transferencia de datos**:
   - Transfiere branches de duplicados al salesperson principal
   - Actualiza estimates para usar el salesperson principal
4. **Marcado como inactivo**:
   - Marca duplicados como inactivos
   - Marca salespersons sin estimates ni branches como inactivos

#### Ejecución del Script:

**Desde la línea de comandos:**
```bash
cd backend/src/scripts
node run-cleanup.js
```

**Desde el frontend:**
- Botón "Clean Duplicates" en la página de Salespersons
- Requiere confirmación antes de ejecutar
- Muestra progreso y resultados

**Desde API:**
```bash
POST /api/automations/clean-duplicate-salespersons
```

## Archivos Modificados/Creados

### Backend:
- `src/controllers/automations.controller.js` - Mejorada función findOrCreateSalesPerson
- `src/controllers/salespersons.controller.js` - Ya tenía soporte para include_inactive
- `src/routes/automations.routes.js` - Nuevo endpoint de limpieza
- `src/scripts/clean-duplicate-salespersons.js` - Script principal de limpieza
- `src/scripts/run-cleanup.js` - Script de línea de comandos

### Frontend:
- `src/interfaces/index.ts` - Agregado include_inactive a SalesPersonListParams
- `src/services/salespersonService.ts` - Nuevo método cleanDuplicateSalesPersons
- `src/components/employees/SalespersonsTab.tsx` - UI mejorada para inactivos y botón de limpieza

## Uso Recomendado

### 1. Limpieza Inicial
Ejecutar el script de limpieza una vez para limpiar duplicados existentes:
```bash
node backend/src/scripts/run-cleanup.js
```

### 2. Uso Regular
- Usar el toggle "Show Inactive" para ver todos los salespersons
- Activar/desactivar salespersons individualmente según sea necesario
- Ejecutar limpieza periódicamente después de syncs masivos

### 3. Después de Sync
El sistema ahora previene automáticamente la creación de duplicados durante el sync, pero se recomienda:
- Revisar salespersons inactivos después de syncs grandes
- Ejecutar limpieza si se detectan problemas

## Logs y Monitoreo

El script genera logs detallados que incluyen:
- Número de duplicados encontrados
- Salespersons procesados
- Transferencias de branches y estimates
- Salespersons marcados como inactivos
- Errores y advertencias

Los logs se muestran en:
- Consola del servidor
- Respuesta de la API
- Consola del navegador (frontend)

## Consideraciones de Seguridad

- El script requiere confirmación en el frontend
- Solo admins pueden ejecutar la limpieza
- Se recomienda hacer backup antes de ejecutar en producción
- El script es idempotente (se puede ejecutar múltiples veces sin problemas) 