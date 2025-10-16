# 🐛 Fix: Branches Duplicados en la Base de Datos

## 🎯 El Problema

En producción se están creando **branches duplicados** en la base de datos (ej: "San Bernardino" aparece 2 veces, "Kent -WA" aparece 2 veces).

### Causa Raíz

Había **múltiples funciones `findOrCreateBranch`** en diferentes controladores con lógicas inconsistentes:

```javascript
// ❌ estimates.controller.js (case-sensitive, NO normaliza)
Branch.findOrCreate({ where: { name } })

// ❌ automations.controller.js (case-sensitive, NO normaliza)
Branch.findOrCreate({ where: { name } })

// ✅ atticTechSync.controller.js (normaliza, pero es local)
// Tenía buena lógica pero solo se usaba en ese controlador
```

### Escenario del Problema

Si Attic Tech envía nombres con variaciones:
- `"San Bernardino"` → Crea branch 1
- `"San Bernardino "` (con espacio extra) → Crea branch 2
- `"san bernardino"` (lowercase) → Crea branch 3

Resultado: **3 branches** en lugar de 1! 😱

---

## ✅ Solución Implementada

### 1. **Helper Centralizado** (`backend/src/utils/branchHelper.js`)

Creé un módulo centralizado con 3 funciones:

#### a) `normalizeBranchName(name)`
```javascript
// Input: "  San  Bernardino  "
// Output: "San Bernardino"

// - Trim espacios inicio/fin
// - Múltiples espacios → 1 espacio
// - Capitaliza primera letra de cada palabra
```

#### b) `findOrCreateBranch(branchName, logMessages)`
```javascript
// Busca con case-insensitive (iLike)
// Si existe, lo retorna
// Si no existe, crea con nombre normalizado
// ✅ Previene duplicados
```

#### c) `findBranch(branchName)`
```javascript
// Solo busca (no crea)
// Usa normalización para búsqueda flexible
```

#### d) `cleanupDuplicateBranches()`
```javascript
// Encuentra branches con nombres similares
// Consolida en 1 solo branch (el más viejo)
// Actualiza todas las referencias (employees, jobs, estimates, etc)
// Elimina duplicados
```

### 2. **Actualización de Controladores**

Todos los controladores ahora usan la función centralizada:

- ✅ `atticTechSync.controller.js`
- ✅ `estimates.controller.js`
- ✅ `automations.controller.js`
- ✅ `jobSync.controller.js`

### 3. **Nuevo Endpoint de Limpieza**

```
POST /api/branches/cleanup-duplicates
```

**Requiere**: Admin role  
**Función**: Limpia todos los duplicados existentes

---

## 🚀 Cómo Usar

### Paso 1: Deploy del Código

```bash
# En producción
cd /ruta/a/BotZillaApiV2
git pull origin master
pm2 restart botzilla-backend
```

### Paso 2: Limpiar Duplicados Existentes

#### Opción A: Desde el Frontend (Recomendado)

1. Login como Admin
2. Ve a Settings → Branches
3. Click "Cleanup Duplicates" (cuando lo agregues al UI)

#### Opción B: Con cURL/Postman

```bash
curl -X POST https://tu-dominio.com/api/branches/cleanup-duplicates \
  -H "Authorization: Bearer TU_TOKEN_ADMIN" \
  -H "Content-Type: application/json"
```

#### Respuesta Esperada:

```json
{
  "success": true,
  "message": "Successfully cleaned up 3 duplicate branches",
  "result": {
    "duplicatesFound": 3,
    "duplicatesDeleted": 3,
    "consolidationMap": {
      "15": "12",  // Branch ID 15 → consolidado en 12
      "18": "12",  // Branch ID 18 → consolidado en 12
      "22": "20"   // Branch ID 22 → consolidado en 20
    }
  }
}
```

### Paso 3: Verificar en la Base de Datos

```sql
-- Ver todos los branches
SELECT id, name, created_at 
FROM branches 
ORDER BY name;

-- No deberías ver duplicados
```

---

## 📊 Ejemplo de Limpieza

### Antes:

| ID | Name | Created At |
|----|------|------------|
| 12 | San Bernardino | 2024-01-01 |
| 15 | San Bernardino | 2024-03-15 |
| 18 | san bernardino | 2024-06-20 |
| 20 | Kent -WA | 2024-01-01 |
| 22 | Kent -WA | 2024-04-10 |

### Después:

| ID | Name | Created At |
|----|------|------------|
| 12 | San Bernardino | 2024-01-01 |
| 20 | Kent -WA | 2024-01-01 |

**Resultado:**
- Branches 15 y 18 eliminados
- Todos sus employees, jobs, estimates → actualizados a Branch 12
- Branch 22 eliminado
- Todos sus employees, jobs, estimates → actualizados a Branch 20

---

## 🔄 Prevención Futura

Con el nuevo código, todos los syncs usan la misma lógica de normalización:

### Sync de Users
```javascript
// atticTechSync.controller.js
const branch = await findOrCreateBranch(branchName);
```

### Sync de Jobs
```javascript
// jobSync.controller.js
const branch = await findBranch(branchName);
```

### Sync de Estimates
```javascript
// estimates.controller.js & automations.controller.js
const branch = await findOrCreateBranch(branchName);
```

**Todos usan la misma función** → **No más duplicados** ✅

---

## 🧪 Testing

### Test 1: Verificar Normalización

```javascript
const { normalizeBranchName } = require('./backend/src/utils/branchHelper');

console.log(normalizeBranchName("  san  bernardino  "));
// Output: "San Bernardino"

console.log(normalizeBranchName("KENT -WA"));
// Output: "Kent -wa"

console.log(normalizeBranchName("orange   COUNTY"));
// Output: "Orange County"
```

### Test 2: Verificar No Crea Duplicados

1. Ejecutar sync de users
2. Ejecutar sync de estimates
3. Ejecutar sync de jobs
4. Verificar en DB: No duplicados

```sql
SELECT name, COUNT(*) as count
FROM branches
GROUP BY name
HAVING COUNT(*) > 1;
```

**Resultado esperado:** 0 rows

---

## 📦 Archivos Modificados

### Nuevos:
- ✅ `backend/src/utils/branchHelper.js` (Módulo centralizado)
- ✅ `BRANCH_DUPLICATES_FIX.md` (Esta documentación)

### Modificados:
- ✅ `backend/src/controllers/atticTechSync.controller.js`
- ✅ `backend/src/controllers/estimates.controller.js`
- ✅ `backend/src/controllers/automations.controller.js`
- ✅ `backend/src/controllers/jobSync.controller.js`
- ✅ `backend/src/controllers/branches.controller.js` (nuevo endpoint)
- ✅ `backend/src/routes/branches.routes.js` (nueva ruta)

---

## ⚠️ Consideraciones Importantes

### 1. Backup Antes de Limpiar
```bash
pg_dump -h localhost -U botzilla_user -d botzilla > backup_before_cleanup.sql
```

### 2. Ejecutar en Horario de Bajo Tráfico
El proceso de limpieza:
- Actualiza múltiples tablas
- Puede tardar unos segundos con muchos registros
- Es seguro, pero mejor ejecutar cuando haya menos usuarios

### 3. Solo Admins
El endpoint requiere role `admin` por seguridad.

### 4. No Afecta Datos
La limpieza solo:
- ✅ Elimina branches duplicados
- ✅ Actualiza referencias para mantener integridad
- ✅ NO elimina employees, jobs, o estimates
- ✅ Todo queda funcionando igual, pero sin duplicados

---

## 🎯 Checklist de Deploy

- [ ] Pull código en producción
- [ ] Reiniciar backend con `pm2 restart`
- [ ] Backup de base de datos
- [ ] Ejecutar `POST /api/branches/cleanup-duplicates`
- [ ] Verificar resultado en respuesta
- [ ] Verificar en UI que no hay duplicados
- [ ] Ejecutar sync de users/jobs/estimates
- [ ] Confirmar que no se crean nuevos duplicados

---

## 📧 Preguntas Frecuentes

### ¿Qué pasa si ejecuto cleanup y no hay duplicados?
```json
{
  "success": true,
  "message": "No duplicate branches found",
  "result": {
    "duplicatesFound": 0,
    "duplicatesDeleted": 0
  }
}
```

### ¿Puedo ejecutar cleanup múltiples veces?
Sí, es seguro. Si no hay duplicados, simplemente retorna 0.

### ¿Qué pasa con las referencias?
Todas las referencias se actualizan automáticamente:
- Employees → `branch_id`
- Jobs → `branch_id`
- Estimates → `branch_id`
- SalesPersons → `branch_id`

### ¿Cómo sé cuál branch se mantiene?
El más antiguo (`created_at` menor) se mantiene, los demás se eliminan.

---

**Fecha:** Octubre 16, 2025  
**Versión:** 1.0  
**Estado:** ✅ Implementado y Listo para Deploy

