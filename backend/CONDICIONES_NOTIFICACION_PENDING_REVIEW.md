# Condiciones para la Notificación "Job Status Changed - Pending Review"

## 📋 Resumen

Para que se active la notificación **"Job Status Changed - Pending Review"**, se deben cumplir **TODAS** las siguientes condiciones:

## ✅ Condiciones Requeridas

### 1. **Cambio de Estado Detectado**
- `statusChanged` debe ser `true`
- Esto significa que `existingJob.status_id` (en nuestra BD) ≠ `status?.id` (de Attic Tech)

### 2. **Estado Anterior Exacto**
- `oldStatusName` debe ser exactamente **"Plans In Progress"** (case-sensitive)
- Se obtiene de `JobStatus.findByPk(existingJob.last_known_status_id)` o `existingJob.status?.name`

### 3. **Estado Nuevo Exacto**
- `newStatusName` debe ser exactamente **"Pending Review"** (case-sensitive)
- Se obtiene de `status?.name` (de Attic Tech)

### 4. **Branch Asignado**
- `branch` debe existir (no puede ser `null` o `undefined`)
- Se obtiene de `atJob.job_estimate?.branch?.name` y se busca en nuestra BD con `findBranch()`

### 5. **Operation Manager Encontrado**
- Debe existir un usuario con rol "operation manager" asignado al `branch`
- La función `findOperationManager(branch.id)` debe retornar un objeto (no `null`)

## 🔍 Código de la Condición

```javascript
if (statusChanged && oldStatusName === 'Plans In Progress' && newStatusName === 'Pending Review' && branch) {
    const notification = await generatePendingReviewNotification(atJob, branch, estimate, crewLeader);
    if (notification) {
        notifications.push(notification);
    }
}
```

## 🐛 Problemas Comunes

### Problema 1: `oldStatusName` no coincide exactamente
- **Causa**: El nombre del estado en la BD no es exactamente "Plans In Progress"
- **Solución**: Verificar en la tabla `job_status` que el nombre sea exactamente "Plans In Progress" (sin espacios extra, mayúsculas/minúsculas correctas)

### Problema 2: `newStatusName` no coincide exactamente
- **Causa**: El nombre del estado en Attic Tech no es exactamente "Pending Review"
- **Solución**: Verificar que Attic Tech esté enviando exactamente "Pending Review"

### Problema 3: `branch` es `null`
- **Causa**: El job no tiene `job_estimate.branch` en Attic Tech, o el branch no existe en nuestra BD
- **Solución**: 
  - Verificar que el job tenga un estimate con branch en Attic Tech
  - Verificar que el branch exista en nuestra BD con `findBranch()`

### Problema 4: `findOperationManager()` retorna `null`
- **Causa**: 
  - No existe un usuario con rol "operation manager"
  - El usuario no está asignado al branch específico
  - El usuario no tiene `telegram_id` (aunque esto no debería impedir la notificación según el código actual)
- **Solución**: 
  - Verificar que exista un usuario con rol "operation manager"
  - Verificar que el usuario esté asignado al branch correcto en la tabla `user_branch`
  - Verificar que `findOperationManager()` retorne un objeto (incluso sin `telegram_id`)

## 🔧 Cómo Debuggear

### Paso 1: Verificar los logs del sync
Busca estos logs en el output:

```
🔍 EVALUANDO NOTIFICACIÓN PENDING REVIEW para "Nave test":
```

Este log muestra:
- `oldStatusNameMatch`: debe ser `true`
- `newStatusNameMatch`: debe ser `true`
- `branchExists`: debe ser `true`
- `allConditionsMet`: debe ser `true`

### Paso 2: Verificar el estado en la BD
```sql
SELECT 
    j.id,
    j.name,
    j.status_id,
    js.name as status_name,
    j.last_known_status_id,
    js2.name as last_known_status_name,
    j.branch_id,
    b.name as branch_name
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.job_status js2 ON j.last_known_status_id = js2.id
LEFT JOIN botzilla.branch b ON j.branch_id = b.id
WHERE j.name = 'Nave test';
```

### Paso 3: Verificar Operation Manager
```sql
-- Buscar rol operation manager
SELECT id, name FROM botzilla.user_rol WHERE name = 'operation manager';

-- Buscar usuarios con ese rol asignados a un branch específico
SELECT 
    u.id,
    u.email,
    u.telegram_id,
    b.id as branch_id,
    b.name as branch_name
FROM botzilla.user u
JOIN botzilla.user_branch ub ON u.id = ub.user_id
JOIN botzilla.branch b ON ub.branch_id = b.id
WHERE u.rol_id = (SELECT id FROM botzilla.user_rol WHERE name = 'operation manager')
AND b.id = <branch_id_del_job>;
```

### Paso 4: Verificar el cambio de estado
Cuando ejecutes el sync, busca estos logs específicos:

```
📝 Estado cambió para "Nave test": Plans In Progress (ID 4) → Pending Review (ID 5)
```

Y luego:

```
🔍 EVALUANDO NOTIFICACIÓN PENDING REVIEW para "Nave test":
```

Si `allConditionsMet` es `false`, revisa cada condición individualmente.

## 📝 Checklist de Verificación

- [ ] `statusChanged` es `true` en los logs
- [ ] `oldStatusName` es exactamente "Plans In Progress"
- [ ] `newStatusName` es exactamente "Pending Review"
- [ ] `branchExists` es `true` en los logs
- [ ] `branchId` y `branchName` están presentes en los logs
- [ ] `allConditionsMet` es `true` en los logs
- [ ] Existe un usuario con rol "operation manager" asignado al branch
- [ ] `findOperationManager()` retorna un objeto (no `null`)
- [ ] `generatePendingReviewNotification()` retorna un objeto (no `null`)
- [ ] La notificación se agrega al array `notifications`

## 🎯 Ejemplo de Logs Exitosos

```
📝 Estado cambió para "Nave test": Plans In Progress (ID 4) → Pending Review (ID 5)
🔍 EVALUANDO NOTIFICACIÓN PENDING REVIEW para "Nave test":
  oldStatusNameMatch: true
  newStatusNameMatch: true
  branchExists: true
  allConditionsMet: true
🔔 Job cambió de "Plans In Progress" a "Pending Review": Nave test (Branch: Orange)
🔍 RESULTADO generatePendingReviewNotification:
  notificationGenerated: true
  hasTelegramId: true
✅ Notificación de Pending Review agregada para Operation Manager
```

## ⚠️ Nota Importante

La función `findOperationManager()` actualmente retorna `null` si el Operation Manager no tiene `telegram_id`. Sin embargo, el código de `generatePendingReviewNotification()` fue modificado para retornar la notificación incluso sin `telegram_id`. Esto puede causar que la notificación no se genere si `findOperationManager()` retorna `null`.

**Solución**: Asegurarse de que `findOperationManager()` retorne el Operation Manager incluso si no tiene `telegram_id`, o modificar la lógica para que `generatePendingReviewNotification()` pueda funcionar con un Operation Manager sin `telegram_id`.

