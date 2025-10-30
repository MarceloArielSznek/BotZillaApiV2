# Fix: Auto-actualización de Estado de Jobs cuando se Aprueban Shifts

## Problema Identificado

**Fecha**: 2025-10-30

### Issues:
1. ❌ Jobs con estado "Requires Crew Lead" cuando **todos los shifts ya están aprobados**
2. ❌ Jobs con estado "N/A" (status_id = NULL) en la base de datos
3. ❌ El estado del job NO se actualizaba automáticamente cuando todos los shifts se aprobaban
4. ❌ **Job Sync sobrescribía el estado "Closed Job"** y lo cambiaba a "In Progress"
5. ❌ **Jobs nuevos creados desde Performance con shifts aprobados** se creaban con "In Progress" en vez de "Closed Job"

### Ejemplos del Problema:
- **Job**: "Lauri Huston - BHAM" (Everett -WA)
  - Estado: "Requires Crew Lead"
  - Shifts: "All approved" ✅
  - **Problema**: El estado debería ser "Closed Job"

- **Job**: "Michele Leonard" (Everett -WA)
  - Estado: "N/A"
  - Shifts: "All approved" ✅
  - **Problema**: El estado debería ser "Closed Job"

- **Job**: "Meemong Lee - SP" (Los Angeles)
  - Acción: Todos los shifts aprobados → Estado cambia a "Closed Job" ✅
  - **Problema**: Después de 1-2 minutos, el Job Sync lo cambia a "In Progress" ❌

- **Job Nuevo**: Creado desde Performance con `autoApprove = true`
  - **Problema**: Se crea con estado "In Progress" en vez de "Closed Job"

---

## Solución Implementada

### 1. Auto-actualización de Estado al Aprobar Shifts

**Archivo modificado**: `backend/src/controllers/shiftApproval.controller.js`

**Lógica agregada**:
- Cuando se aprueban shifts (regular o special shifts), el sistema:
  1. Identifica todos los `job_id` únicos afectados
  2. Para cada job, verifica si **TODOS** los shifts están aprobados
  3. Si todos están aprobados:
     - Actualiza el estado del job a **"Closed Job"**
     - Mantiene el `closing_date` existente o asigna la fecha actual

**Código clave**:
```javascript
// Verificar si todos los shifts están aprobados
const pendingRegularShifts = await Shift.count({
    where: { job_id: jobId, approved_shift: false }
});

const pendingSpecialShifts = await JobSpecialShift.count({
    where: { job_id: jobId, approved_shift: false }
});

// Si NO hay shifts pendientes, actualizar a "Closed Job"
if (pendingRegularShifts === 0 && pendingSpecialShifts === 0) {
    const closedJobStatus = await JobStatus.findOne({
        where: { name: 'Closed Job' }
    });
    
    await job.update({ 
        status_id: closedJobStatus.id,
        closing_date: job.closing_date || new Date()
    });
}
```

---

### 2. Protección del Estado "Closed Job" en Job Sync

**Archivo modificado**: `backend/src/controllers/jobSync.controller.js`

**Problema**: El Job Sync sincroniza jobs desde Attic Tech cada pocos minutos y estaba **sobrescribiendo** el `status_id` del job, incluso cuando ya estaba en "Closed Job".

**Solución**: Ahora el Job Sync **preserva** el estado "Closed Job" y NO lo sobrescribe:

```javascript
// Determinar el status_id a usar
// Si el job ya existe y está en "Closed Job", NO sobrescribir el status
// porque significa que todos los shifts ya fueron aprobados
let statusIdToUse = status?.id || null;

if (existingJob) {
    const closedJobStatus = await JobStatus.findOne({
        where: { name: 'Closed Job' }
    });
    
    // Si el job está en "Closed Job", preservar ese estado
    if (closedJobStatus && existingJob.status_id === closedJobStatus.id) {
        statusIdToUse = existingJob.status_id; // Mantener "Closed Job"
        logger.info(`🔒 Job "${atJob.name}" está en "Closed Job" (shifts aprobados). Status preservado, NO sobrescrito por sync.`);
    }
}

const jobData = {
    // ...
    status_id: statusIdToUse, // Usar el status protegido
    // ...
};
```

---

### 3. Asignación de Estado Inicial al Crear Jobs desde Performance

**Archivo modificado**: `backend/src/services/performancePersistence.service.js`

**Problema anterior**:
- Cuando se creaba un job desde Performance y no se encontraba un estimate, el `status_id` quedaba como `null` (N/A)
- Cuando se creaba un job con `autoApprove = true` (shifts ya aprobados), se asignaba "In Progress" en vez de "Closed Job"

**Nueva lógica**:
- Siempre asigna un estado válido al crear un job:
  - **Si `autoApprove = true`**: Estado = **"Closed Job"** ✅ (porque los shifts ya están aprobados)
  - **Si NO tiene `crew_leader_id`**: Estado = "Requires Crew Lead"
  - **Si no**: Estado = "In Progress"

**Código clave**:
```javascript
// Determinar el estado del job basado en la información disponible
let statusName;

// Si autoApprove es true, significa que los shifts ya fueron aprobados
// Por lo tanto, el job debería crearse directamente como "Closed Job"
if (autoApprove) {
    statusName = 'Closed Job';
    logger.info(`Job will be created with "Closed Job" status (shifts auto-approved)`);
} else if (!crew_leader_id) {
    // Si no tiene crew_leader_id, necesita un crew leader
    statusName = 'Requires Crew Lead';
} else {
    // Estado por defecto para jobs con shifts pendientes
    statusName = 'In Progress';
}

const status = await JobStatus.findOne({
    where: { name: { [Op.iLike]: statusName } }
});

if (status) {
    statusId = status.id;
}
```

---

### 4. Migración para Arreglar Jobs Existentes con Estado NULL

**Archivo creado**: `backend/src/migrations/fix_jobs_with_null_status.sql`

**Propósito**:
- Actualizar todos los jobs existentes que tienen `status_id = NULL`

**Lógica**:
1. Jobs **con** `crew_leader_id` → Estado = "In Progress"
2. Jobs **sin** `crew_leader_id` → Estado = "Requires Crew Lead"

---

### 5. Migración para Arreglar Jobs con Todos los Shifts Aprobados

**Archivo creado**: `backend/src/migrations/fix_jobs_with_all_approved_shifts.sql`

**Propósito**:
- Actualizar jobs que tienen **todos los shifts aprobados** pero están en estado incorrecto (ej: "In Progress")

**Lógica**:
- Busca todos los jobs donde:
  - Estado actual != "Closed Job"
  - Tiene shifts
  - TODOS los shifts están aprobados (`approved_shift = true`)
- Los actualiza a "Closed Job"

---

## Deployment a Producción

### Pasos a seguir:

#### 1. **Hacer Pull del Código Nuevo**

```bash
# En el servidor de producción
ssh marcelo@vps-4889463-x
cd ~/apps/BotZillaApiV2

# Traer los cambios
git pull origin master
```

#### 2. **Ejecutar Migraciones SQL en Base de Datos de Producción**

**Migración 1**: Arreglar jobs con status NULL
```bash
psql -U [tu_usuario] -d [nombre_base_datos] -f backend/src/migrations/fix_jobs_with_null_status.sql
```

**Migración 2**: Arreglar jobs con todos los shifts aprobados
```bash
psql -U [tu_usuario] -d [nombre_base_datos] -f backend/src/migrations/fix_jobs_with_all_approved_shifts.sql
```

**Resultado esperado**:
```
✅ Updated X jobs with crew leader to "In Progress" status
✅ Updated X jobs without crew leader to "Requires Crew Lead" status
✅ Updated X jobs with all shifts approved to "Closed Job" status
```

#### 3. **Reiniciar Backend en Producción**

```bash
# En el servidor de producción
pm2 restart botzilla-backend

# Verificar que está corriendo
pm2 status

# Ver logs en tiempo real (opcional)
pm2 logs botzilla-backend --lines 50
```

---

## Testing

### Escenario 1: Aprobar Shifts de un Job Completo
1. Ir a **Performance → Shifts Approvals**
2. Aprobar todos los shifts de un job que tiene estado "Requires Crew Lead" o "In Progress"
3. **Resultado esperado**: El estado del job se actualiza automáticamente a "Closed Job"

### Escenario 2: Job Sync NO sobrescribe "Closed Job"
1. Aprobar todos los shifts de un job (Estado → "Closed Job")
2. Esperar 1-2 minutos para que corra el Job Sync automático
3. **Resultado esperado**: El job PERMANECE en "Closed Job", NO cambia a "In Progress"

### Escenario 3: Crear Job desde Performance con autoApprove
1. Subir spreadsheet de Performance con un job nuevo
2. Aprobar los shifts automáticamente (autoApprove = true)
3. **Resultado esperado**: El job se crea directamente con estado "Closed Job"

### Escenario 4: Crear Job desde Performance sin Estimate
1. Subir spreadsheet de Performance con un job nuevo
2. El job NO tiene un estimate matching en el sistema
3. **Resultado esperado**: 
   - Si tiene crew leader → Estado = "In Progress"
   - Si NO tiene crew leader → Estado = "Requires Crew Lead"
   - **NUNCA** debe quedar en "N/A"

### Escenario 5: Jobs con Estado N/A Existentes
1. Después de ejecutar la migración SQL
2. Verificar que NO existan jobs con estado "N/A"
3. **Resultado esperado**: Todos los jobs tienen un estado válido

---

## Archivos Modificados

### Backend
- ✅ `backend/src/controllers/shiftApproval.controller.js` - Auto-actualización de estado
- ✅ `backend/src/controllers/jobSync.controller.js` - Protección de "Closed Job" en sync
- ✅ `backend/src/services/performancePersistence.service.js` - Asignación de estado inicial correcto

### Migraciones
- ✅ `backend/src/migrations/fix_jobs_with_null_status.sql` - Arreglar jobs con NULL
- ✅ `backend/src/migrations/fix_jobs_with_all_approved_shifts.sql` - Arreglar jobs con shifts aprobados

### Documentación
- ✅ `FIX_JOB_STATUS_AUTOMATION.md` - Este archivo

---

## Logs Relevantes

### Cuando se aprueba un shift y se actualiza el job:
```
[INFO] Job status updated to "Closed Job" after all shifts approved
Meta: {
  "job_id": 12345,
  "job_name": "Lauri Huston - BHAM",
  "previous_status_id": 1,
  "new_status_id": 5
}
```

### Cuando el Job Sync protege el estado "Closed Job":
```
[INFO] 🔒 Job "Meemong Lee - SP" está en "Closed Job" (shifts aprobados). Status preservado, NO sobrescrito por sync.
```

### Cuando se crea un job desde Performance con autoApprove:
```
[INFO] Job will be created with "Closed Job" status (shifts auto-approved)
Meta: {
  "job_name": "Jesse Hsu - ARC PMP",
  "autoApprove": true
}

[INFO] Status "Closed Job" assigned to Performance job
Meta: {
  "status_id": 5,
  "job_name": "Jesse Hsu - ARC PMP",
  "has_crew_leader": true,
  "autoApprove": true
}
```

---

## Beneficios

### Para Operations:
✅ **Automatización completa**: No se requiere actualización manual del estado del job  
✅ **Datos confiables**: Todos los jobs tienen un estado válido y coherente  
✅ **Visibilidad clara**: El estado del job refleja el estado real de los shifts aprobados  
✅ **Sin regresiones**: Job Sync NO sobrescribe estados importantes  

### Para el Sistema:
✅ **Integridad de datos**: Eliminación de estados NULL  
✅ **Lógica consistente**: El flujo de Performance → Shifts → Closed Job es automático  
✅ **Reducción de errores**: Menos intervención manual = menos errores  
✅ **Protección de estado**: El estado "Closed Job" está protegido contra sobrescrituras  

---

## Resumen de los 3 Problemas Solucionados

| # | Problema | Solución | Archivo |
|---|----------|----------|---------|
| 1 | Jobs no se actualizaban a "Closed Job" al aprobar shifts | Auto-actualización al aprobar shifts | `shiftApproval.controller.js` |
| 2 | Job Sync sobrescribía "Closed Job" → "In Progress" | Protección del estado "Closed Job" en sync | `jobSync.controller.js` |
| 3 | Jobs nuevos con autoApprove se creaban con "In Progress" | Asignar "Closed Job" si autoApprove = true | `performancePersistence.service.js` |

---

## Notas Adicionales

- ⚠️ **Importante**: Las migraciones SQL deben ejecutarse **ANTES** de desplegar el código nuevo
- 🔍 **Monitoreo**: Revisar los logs después del deployment para confirmar el correcto funcionamiento
- 📊 **Métricas**: Se puede agregar un contador de jobs auto-actualizados en el response de `approveShifts`
- 🔒 **Protección**: El estado "Closed Job" ahora está protegido contra sobrescrituras del Job Sync

---

**Autor**: AI Assistant  
**Fecha**: 2025-10-30  
**Versión**: 2.0 (actualizada con fix de Job Sync y autoApprove)
