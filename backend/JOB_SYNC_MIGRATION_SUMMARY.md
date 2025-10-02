# 📋 Job Sync System - Resumen de Migración

**Fecha:** 2025-10-02  
**Archivo SQL:** `backend/src/migrations/job_sync_system_setup.sql`

---

## 🎯 Objetivo General

Crear un sistema de sincronización con Attic Tech para:
1. Detectar cuando un estimate se convierte en job (estado "Requires Crew Lead")
2. Detectar cuando un job cambia de estado (especialmente a "Plans In Progress")
3. Generar notificaciones automáticas a crew leaders y operation managers

---

## 📊 Cambios en la Base de Datos

### **PASO 1: Links entre Employee y Crew/Sales**

#### ¿Qué hace?
Agrega un campo `employee_id` en las tablas operativas para mantener la trazabilidad del onboarding.

#### Cambios:
```sql
-- En crew_member
ALTER TABLE crew_member ADD COLUMN employee_id INTEGER;

-- En sales_person  
ALTER TABLE sales_person ADD COLUMN employee_id INTEGER;
```

#### ¿Por qué?
- Saber de qué registro de `employee` vino cada crew member/salesperson
- Mantener auditoría completa del ciclo de vida del empleado
- Facilitar sincronización de datos (email, telegram_id, etc.)

---

### **PASO 2: Estados de Job (9 estados oficiales de AT)**

#### ¿Qué hace?
Inserta los 9 estados oficiales que usa Attic Tech para el ciclo de vida de un job.

#### Estados insertados:
1. **Requires Crew Lead** - Job creado, esperando asignación
2. **Plans In Progress** - Crew leader asignado, preparando plan
3. **Pending Review** - Plan listo, esperando aprobación
4. **Requires Scheduling** - Plan aprobado, esperando schedule
5. **Pre-Production** - Preparativos antes de iniciar trabajo
6. **In Production** - Trabajo en progreso
7. **Production Complete** - Trabajo terminado
8. **Pending Payment** - Esperando pago del cliente
9. **Closed Job** - Job cerrado completamente

#### ¿Por qué?
- Necesitamos trackear estos estados específicos para las notificaciones
- Los estados antiguos ("In Progress", "Done") no son suficientes

---

### **PASO 3: Tabla job_sync (Espejo de AT)**

#### ¿Qué hace?
Crea una tabla "espejo" que guarda una copia local de los jobs de Attic Tech.

#### Estructura:
```sql
CREATE TABLE job_sync (
  id                        -- ID interno
  attic_tech_job_id         -- ID del job en Attic Tech (único)
  job_status_id             -- Estado actual del job
  crew_leader_id            -- Crew leader asignado
  sales_person_id           -- Salesperson del job
  branch_id                 -- Branch del job
  job_name                  -- Nombre del job
  last_known_status_id      -- Estado anterior (para detectar cambios)
  last_synced_at            -- Última vez que sincronizamos
  notification_sent         -- Si ya se envió notificación
  last_notification_sent_at -- Cuándo se envió la última notificación
  attic_tech_data           -- JSON con data completa de AT (backup)
  created_at, updated_at    -- Timestamps
)
```

#### ¿Por qué?
- **Detectar cambios:** Comparamos `last_known_status_id` con el estado actual de AT
- **Evitar duplicados:** Si `notification_sent = true`, no volvemos a notificar
- **Performance:** No necesitamos consultar AT para saber el estado anterior
- **Auditoría:** Sabemos cuándo fue el último sync

---

### **PASO 4: Campos adicionales en tabla job**

#### ¿Qué hace?
Agrega campos opcionales a la tabla `job` existente para mantener referencia con AT.

#### Cambios:
```sql
ALTER TABLE job ADD COLUMN attic_tech_job_id INTEGER;
ALTER TABLE job ADD COLUMN last_synced_at TIMESTAMP;
```

#### ¿Por qué?
- Por si queremos mantener también un registro en la tabla `job` original
- Flexibilidad para decidir después si usamos `job` o `job_sync`

---

### **PASO 5: Tabla job_state_change_log (Auditoría)**

#### ¿Qué hace?
Crea un log completo de todos los cambios de estado para auditoría.

#### Estructura:
```sql
CREATE TABLE job_state_change_log (
  id
  job_sync_id              -- Referencia al job_sync
  attic_tech_job_id        -- ID del job en AT
  previous_status_id       -- Estado anterior
  new_status_id            -- Estado nuevo
  notified_user_type       -- Tipo: 'crew_leader', 'operation_manager', etc.
  notified_user_id         -- ID del usuario notificado
  notified_telegram_id     -- Telegram ID del notificado
  changed_at               -- Cuándo cambió
  change_metadata          -- JSON con info adicional
)
```

#### ¿Por qué?
- Auditoría completa de todos los cambios de estado
- Saber quién fue notificado y cuándo
- Análisis de tiempos entre estados
- Debugging de problemas con notificaciones

---

### **PASO 6: Vista v_job_sync_details**

#### ¿Qué hace?
Crea una vista SQL que une todas las tablas para facilitar consultas.

#### Incluye:
- Estado actual y anterior del job
- Información del crew leader (nombre, telegram_id, phone)
- Información del salesperson
- Información del branch
- Fechas de sync y notificaciones

#### ¿Por qué?
- Facilita hacer queries sin tener que hacer JOIN manual
- Útil para dashboards y reportes
- Código más limpio en los endpoints

---

## 🔄 Flujo de Sincronización

### **Endpoint 1: Sync Sold Estimates → Jobs**

```
1. Consultar AT: /api/estimates?where[and][0][status][equals]=Sold
2. Para cada estimate:
   - Buscar en job_sync si existe (por estimate_id de AT)
   - Si NO existe:
     * Crear registro en job_sync
     * Estado: "Requires Crew Lead"
     * notification_sent = false
     * Agregar al array de respuesta:
       {
         job_id: xxx,
         job_name: "...",
         status: "Requires Crew Lead",
         telegram_ids: [operation_manager_telegram_ids]
       }
3. Retornar array completo a Make
```

### **Endpoint 2: Sync Job State Changes**

```
1. Consultar AT: /api/jobs?where[and][0][status][equals]=Plans%20In%20Progress
2. Para cada job:
   - Buscar en job_sync por attic_tech_job_id
   - Comparar last_known_status_id con estado actual
   - Si cambió de "Requires Crew Lead" → "Plans In Progress":
     * Actualizar job_sync:
       - job_status_id = nuevo estado
       - last_known_status_id = estado nuevo
       - notification_sent = true
       - last_notification_sent_at = NOW()
     * Insertar en job_state_change_log
     * Agregar al array de respuesta:
       {
         job_id: xxx,
         job_name: "...",
         previous_status: "Requires Crew Lead",
         new_status: "Plans In Progress",
         crew_leader: {
           id: xxx,
           name: "Chris Jordan",
           telegram_id: "123456789",
           email: "..."
         }
       }
3. Retornar array completo a Make
```

---

## ⚙️ Instrucciones para Aplicar en Producción

### **1. Backup Completo**
```bash
pg_dump -U your_user -h localhost -d your_database > backup_before_job_sync_$(date +%Y%m%d).sql
```

### **2. Ejecutar Migración en Transacción**
```sql
BEGIN;

-- Copiar y pegar todo el contenido de job_sync_system_setup.sql

-- Verificar que todo se creó correctamente
SELECT * FROM botzilla.job_status ORDER BY id;
SELECT COUNT(*) FROM botzilla.job_sync;
SELECT * FROM botzilla.v_job_sync_details LIMIT 1;

-- Si todo está bien:
COMMIT;

-- Si algo salió mal:
-- ROLLBACK;
```

### **3. Verificar Índices**
```sql
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'botzilla' 
  AND tablename IN ('job_sync', 'job_state_change_log', 'crew_member', 'sales_person');
```

### **4. Verificar Permisos**
```sql
GRANT USAGE ON SCHEMA botzilla TO your_app_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA botzilla TO your_app_user;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA botzilla TO your_app_user;
```

---

## 📝 Próximos Pasos

1. ✅ Aplicar migración en base de datos (desarrollo primero, luego producción)
2. ⏳ Crear controlador `jobSync.controller.js`
3. ⏳ Crear rutas `/api/job-sync/sold-estimates` y `/api/job-sync/state-changes`
4. ⏳ Crear script de test para verificar funcionamiento
5. ⏳ Configurar Make para consumir los endpoints cada 30 minutos
6. ⏳ Testing completo en desarrollo
7. ⏳ Deploy a producción

---

## 🚨 Notas Importantes

- **No elimines** las tablas `crew_member` y `sales_person`, son necesarias
- **No modifiques** los estados existentes en `job_status` si ya hay datos en producción
- **Verifica** que los índices se hayan creado correctamente (pueden tardar en tablas grandes)
- **Monitorea** el tamaño de `job_state_change_log` (crece con cada cambio de estado)
- **Considera** agregar un job de limpieza automática para logs antiguos (ej: > 6 meses)

---

## ❓ Preguntas Frecuentes

### ¿Por qué dos tablas job y job_sync?
- `job`: Tabla existente con lógica de BotZilla
- `job_sync`: Espejo específico para sincronización con AT
- Separa responsabilidades y evita contaminar la tabla original

### ¿Qué pasa si un crew leader no está en nuestra BD?
- El sync detectará que `crew_leader_id = null`
- Se puede agregar lógica para crear el crew_member automáticamente
- O enviar alerta a operation manager para que lo registre

### ¿Qué pasa si AT está caído durante un sync?
- El endpoint retorna error
- Make reintenta según su configuración
- No se pierde data, el próximo sync lo detectará

### ¿Cómo sé si un job ya fue notificado?
- Verificar `job_sync.notification_sent = true`
- O buscar en `job_state_change_log` si existe un registro

---

## 📞 Contacto

Si algo no queda claro durante la implementación, revisar:
1. Este documento
2. El archivo SQL con comentarios
3. La conversación original con el contexto completo

---

**Creado:** 2025-10-02  
**Versión:** 1.0  
**Estado:** Listo para aplicar en desarrollo

