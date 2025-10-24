# 🗄️ INSTRUCCIONES DE MIGRACIÓN SQL - PRODUCCIÓN
## BotZilla V2 - Database Migrations

**Fecha:** 2025-10-14  
**Base de datos:** `botzilla_production` (PostgreSQL)  
**Usuario:** `postgres`  
**Duración estimada:** 5-10 minutos  
**Requiere downtime:** NO

---

## 📌 CONTEXTO

Este documento contiene todas las migraciones SQL necesarias para el deployment del sistema de **Employee Onboarding** y **Job Sync**. Las migraciones agregan nuevas columnas, índices y datos de referencia sin alterar datos existentes.

---

## ⚠️ PASO 0: BACKUP OBLIGATORIO

**ANTES DE EJECUTAR CUALQUIER MIGRACIÓN, HAZ UN BACKUP COMPLETO:**

```bash
# Crear backup con timestamp
pg_dump -U postgres -d botzilla_production > /backup/botzilla_backup_$(date +%Y%m%d_%H%M%S).sql

# Verificar que el backup se creó correctamente
ls -lh /backup/botzilla_backup_*.sql

# Verificar tamaño (debe ser > 0 bytes)
du -h /backup/botzilla_backup_$(date +%Y%m%d_%H%M%S).sql
```

✅ **Solo continúa si el backup fue exitoso.**

---

## 📋 RESUMEN DE MIGRACIONES

| #  | Nombre | Descripción | Impacto |
|----|--------|-------------|---------|
| 1  | `add_operation_manager_role.sql` | Agrega rol "operation manager" | Mínimo - Solo INSERT |
| 2  | `add_attic_tech_user_id_to_employee.sql` | Agrega columna para vincular con AT | Bajo - ALTER TABLE + INDEX |
| 3  | `add_sync_fields_to_job.sql` | Agrega campos de sincronización en Job | Medio - Multiple ALTER + INDEX + INSERT |

**Orden de ejecución:** DEBE ser 1 → 2 → 3 (secuencial)

---

## 🔧 MIGRACIÓN 1: Operation Manager Role

### Descripción
Agrega el nuevo rol "operation manager" a la tabla `user_rol`. Este rol será asignado a usuarios que necesitan recibir notificaciones cuando llegan nuevos jobs que requieren asignación de Crew Lead.

### Código SQL
```sql
-- ============================================================================
-- MIGRACIÓN 1: Agregar rol "operation manager"
-- ============================================================================

-- Verificar que la tabla user_rol existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'user_rol'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.user_rol does not exist!';
    END IF;
END $$;

-- Agregar el nuevo rol (si no existe)
INSERT INTO botzilla.user_rol (name) 
VALUES ('operation manager')
ON CONFLICT (name) DO NOTHING;

-- Verificar que se agregó
SELECT id, name FROM botzilla.user_rol WHERE name = 'operation manager';
```

### Ejecución
```bash
psql -U postgres -d botzilla_production << 'EOF'
-- Verificar que la tabla user_rol existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'user_rol'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.user_rol does not exist!';
    END IF;
END $$;

-- Agregar el nuevo rol (si no existe)
INSERT INTO botzilla.user_rol (name) 
VALUES ('operation manager')
ON CONFLICT (name) DO NOTHING;

-- Verificar que se agregó
SELECT id, name FROM botzilla.user_rol WHERE name = 'operation manager';
EOF
```

### Verificación
```sql
-- Debe devolver al menos 1 fila con el rol "operation manager"
SELECT * FROM botzilla.user_rol WHERE name = 'operation manager';
```

**Resultado esperado:**
```
 id |       name         
----+-------------------
 XX | operation manager
```

---

## 🔧 MIGRACIÓN 2: Attic Tech User ID en Employee

### Descripción
Agrega la columna `attic_tech_user_id` a la tabla `employee` para vincular employees de BotZilla con usuarios de Attic Tech. Esto permite la sincronización bidireccional y evita duplicados.

### Código SQL
```sql
-- ============================================================================
-- MIGRACIÓN 2: Agregar columna attic_tech_user_id a employee
-- ============================================================================

-- Verificar que la tabla employee existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'employee'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.employee does not exist!';
    END IF;
END $$;

-- Agregar columna attic_tech_user_id (si no existe)
ALTER TABLE botzilla.employee 
ADD COLUMN IF NOT EXISTS attic_tech_user_id INTEGER;

-- Agregar constraint de UNIQUE (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_attic_tech_user_id_unique'
    ) THEN
        ALTER TABLE botzilla.employee 
        ADD CONSTRAINT employee_attic_tech_user_id_unique 
        UNIQUE (attic_tech_user_id);
    END IF;
END $$;

-- Crear índice para búsquedas rápidas (si no existe)
CREATE INDEX IF NOT EXISTS idx_employee_attic_tech_user_id 
ON botzilla.employee(attic_tech_user_id);

-- Verificar que la columna se agregó
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee' 
AND column_name = 'attic_tech_user_id';
```

### Ejecución
```bash
psql -U postgres -d botzilla_production << 'EOF'
-- Verificar que la tabla employee existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'employee'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.employee does not exist!';
    END IF;
END $$;

-- Agregar columna attic_tech_user_id (si no existe)
ALTER TABLE botzilla.employee 
ADD COLUMN IF NOT EXISTS attic_tech_user_id INTEGER;

-- Agregar constraint de UNIQUE (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'employee_attic_tech_user_id_unique'
    ) THEN
        ALTER TABLE botzilla.employee 
        ADD CONSTRAINT employee_attic_tech_user_id_unique 
        UNIQUE (attic_tech_user_id);
    END IF;
END $$;

-- Crear índice para búsquedas rápidas (si no existe)
CREATE INDEX IF NOT EXISTS idx_employee_attic_tech_user_id 
ON botzilla.employee(attic_tech_user_id);

-- Verificar que la columna se agregó
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee' 
AND column_name = 'attic_tech_user_id';
EOF
```

### Verificación
```sql
-- Debe devolver 1 fila mostrando la nueva columna
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee' 
AND column_name = 'attic_tech_user_id';

-- Verificar índice
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'employee' 
AND indexname = 'idx_employee_attic_tech_user_id';
```

**Resultado esperado:**
```
    column_name      | data_type | is_nullable 
---------------------+-----------+-------------
 attic_tech_user_id | integer   | YES
```

---

## 🔧 MIGRACIÓN 3: Sync Fields en Job

### Descripción
Esta es la migración más importante. Agrega múltiples columnas a la tabla `job` para soportar la sincronización con Attic Tech, tracking de cambios de estado, y sistema de notificaciones. También inserta los 9 estados oficiales de jobs.

### Código SQL
```sql
-- ============================================================================
-- MIGRACIÓN 3: Agregar campos de sincronización a tabla job
-- ============================================================================

-- Verificar que la tabla job existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.job does not exist!';
    END IF;
END $$;

-- Verificar que la tabla job_status existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job_status'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.job_status does not exist!';
    END IF;
END $$;

-- ============================================================================
-- PASO 1: Agregar nuevas columnas
-- ============================================================================

-- Columna para ID del job en Attic Tech (debe ser único)
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_job_id INTEGER;

-- Columna para ID del estimate en Attic Tech
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_estimate_id INTEGER;

-- Columna para tracking del último estado conocido (detectar cambios)
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_known_status_id INTEGER;

-- Columna para timestamp de última sincronización
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

-- Columna para timestamp de última notificación enviada
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;

-- ============================================================================
-- PASO 2: Agregar constraints y foreign keys
-- ============================================================================

-- Agregar constraint UNIQUE para attic_tech_job_id (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_attic_tech_job_id_unique'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD CONSTRAINT job_attic_tech_job_id_unique 
        UNIQUE (attic_tech_job_id);
    END IF;
END $$;

-- Agregar foreign key para last_known_status_id (si no existe)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_last_known_status_fkey'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD CONSTRAINT job_last_known_status_fkey 
        FOREIGN KEY (last_known_status_id) 
        REFERENCES botzilla.job_status(id);
    END IF;
END $$;

-- ============================================================================
-- PASO 3: Asegurar que notification_sent existe y tiene default
-- ============================================================================

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'notification_sent'
    ) THEN
        ALTER TABLE botzilla.job ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
    ELSE
        ALTER TABLE botzilla.job ALTER COLUMN notification_sent SET DEFAULT FALSE;
    END IF;
END $$;

-- ============================================================================
-- PASO 4: Crear índices para performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_attic_tech_job_id 
ON botzilla.job(attic_tech_job_id);

CREATE INDEX IF NOT EXISTS idx_job_attic_tech_estimate_id 
ON botzilla.job(attic_tech_estimate_id);

CREATE INDEX IF NOT EXISTS idx_job_last_synced_at 
ON botzilla.job(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_job_last_known_status_id 
ON botzilla.job(last_known_status_id);

CREATE INDEX IF NOT EXISTS idx_job_notification_sent 
ON botzilla.job(notification_sent);

-- ============================================================================
-- PASO 5: Insertar los 9 estados oficiales de Attic Tech
-- ============================================================================

INSERT INTO botzilla.job_status (name) VALUES
('Requires Scheduling'),
('Requires Crew Lead'),
('Plans In Progress'),
('In Production'),
('Production Complete'),
('Closed Job'),
('Cancelled'),
('On Hold'),
('Pending Review')
ON CONFLICT (name) DO NOTHING;

-- ============================================================================
-- PASO 6: Verificación final
-- ============================================================================

-- Verificar columnas agregadas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job' 
AND column_name IN (
    'attic_tech_job_id',
    'attic_tech_estimate_id',
    'last_known_status_id',
    'last_synced_at',
    'last_notification_sent_at',
    'notification_sent'
)
ORDER BY column_name;

-- Verificar índices creados
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'job' 
AND indexname LIKE 'idx_job_%'
ORDER BY indexname;

-- Verificar job_status (debe haber al menos 9)
SELECT COUNT(*), STRING_AGG(name, ', ' ORDER BY name) as statuses
FROM botzilla.job_status;
```

### Ejecución
```bash
psql -U postgres -d botzilla_production << 'EOF'
-- Verificar que la tabla job existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.job does not exist!';
    END IF;
END $$;

-- Verificar que la tabla job_status existe
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job_status'
    ) THEN
        RAISE EXCEPTION 'Table botzilla.job_status does not exist!';
    END IF;
END $$;

-- PASO 1: Agregar nuevas columnas
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_job_id INTEGER;

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_estimate_id INTEGER;

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_known_status_id INTEGER;

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP;

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;

-- PASO 2: Agregar constraints y foreign keys
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_attic_tech_job_id_unique'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD CONSTRAINT job_attic_tech_job_id_unique 
        UNIQUE (attic_tech_job_id);
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'job_last_known_status_fkey'
    ) THEN
        ALTER TABLE botzilla.job 
        ADD CONSTRAINT job_last_known_status_fkey 
        FOREIGN KEY (last_known_status_id) 
        REFERENCES botzilla.job_status(id);
    END IF;
END $$;

-- PASO 3: Asegurar que notification_sent existe y tiene default
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'notification_sent'
    ) THEN
        ALTER TABLE botzilla.job ADD COLUMN notification_sent BOOLEAN DEFAULT FALSE;
    ELSE
        ALTER TABLE botzilla.job ALTER COLUMN notification_sent SET DEFAULT FALSE;
    END IF;
END $$;

-- PASO 4: Crear índices para performance
CREATE INDEX IF NOT EXISTS idx_job_attic_tech_job_id 
ON botzilla.job(attic_tech_job_id);

CREATE INDEX IF NOT EXISTS idx_job_attic_tech_estimate_id 
ON botzilla.job(attic_tech_estimate_id);

CREATE INDEX IF NOT EXISTS idx_job_last_synced_at 
ON botzilla.job(last_synced_at);

CREATE INDEX IF NOT EXISTS idx_job_last_known_status_id 
ON botzilla.job(last_known_status_id);

CREATE INDEX IF NOT EXISTS idx_job_notification_sent 
ON botzilla.job(notification_sent);

-- PASO 5: Insertar los 9 estados oficiales de Attic Tech
INSERT INTO botzilla.job_status (name) VALUES
('Requires Scheduling'),
('Requires Crew Lead'),
('Plans In Progress'),
('In Production'),
('Production Complete'),
('Closed Job'),
('Cancelled'),
('On Hold'),
('Pending Review')
ON CONFLICT (name) DO NOTHING;

-- PASO 6: Verificación final
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job' 
AND column_name IN (
    'attic_tech_job_id',
    'attic_tech_estimate_id',
    'last_known_status_id',
    'last_synced_at',
    'last_notification_sent_at',
    'notification_sent'
)
ORDER BY column_name;

SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'job' 
AND indexname LIKE 'idx_job_%'
ORDER BY indexname;

SELECT COUNT(*), STRING_AGG(name, ', ' ORDER BY name) as statuses
FROM botzilla.job_status;
EOF
```

### Verificación
```sql
-- Verificar todas las columnas nuevas
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job' 
AND column_name IN (
    'attic_tech_job_id',
    'attic_tech_estimate_id',
    'last_known_status_id',
    'last_synced_at',
    'last_notification_sent_at',
    'notification_sent'
)
ORDER BY column_name;

-- Verificar índices
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'job' 
AND indexname LIKE 'idx_job_%';

-- Verificar job_status (debe mostrar al menos 9)
SELECT id, name FROM botzilla.job_status ORDER BY name;
```

**Resultado esperado:**
```
6 columnas creadas
5 índices creados
9+ estados en job_status
```

---

## ✅ VERIFICACIÓN COMPLETA POST-MIGRACIONES

Ejecuta este script para verificar que TODO está correcto:

```sql
-- ============================================================================
-- SCRIPT DE VERIFICACIÓN COMPLETA
-- ============================================================================

\echo '========================================='
\echo 'VERIFICACIÓN 1: Operation Manager Role'
\echo '========================================='
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM botzilla.user_rol WHERE name = 'operation manager')
        THEN '✅ PASS: Role exists'
        ELSE '❌ FAIL: Role not found'
    END as result;

\echo ''
\echo '========================================='
\echo 'VERIFICACIÓN 2: Employee attic_tech_user_id'
\echo '========================================='
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'employee' 
            AND column_name = 'attic_tech_user_id'
        )
        THEN '✅ PASS: Column exists'
        ELSE '❌ FAIL: Column not found'
    END as result;

SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE tablename = 'employee' 
            AND indexname = 'idx_employee_attic_tech_user_id'
        )
        THEN '✅ PASS: Index exists'
        ELSE '❌ FAIL: Index not found'
    END as result;

\echo ''
\echo '========================================='
\echo 'VERIFICACIÓN 3: Job sync fields'
\echo '========================================='
SELECT 
    column_name,
    CASE 
        WHEN column_name IS NOT NULL THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (
    VALUES 
        ('attic_tech_job_id'),
        ('attic_tech_estimate_id'),
        ('last_known_status_id'),
        ('last_synced_at'),
        ('last_notification_sent_at'),
        ('notification_sent')
) expected(column_name)
LEFT JOIN information_schema.columns c 
    ON c.column_name = expected.column_name 
    AND c.table_schema = 'botzilla' 
    AND c.table_name = 'job';

\echo ''
\echo '========================================='
\echo 'VERIFICACIÓN 4: Job indexes'
\echo '========================================='
SELECT 
    indexname,
    '✅ EXISTS' as status
FROM pg_indexes 
WHERE tablename = 'job' 
AND indexname LIKE 'idx_job_%'
ORDER BY indexname;

\echo ''
\echo '========================================='
\echo 'VERIFICACIÓN 5: Job statuses'
\echo '========================================='
SELECT 
    COUNT(*) as total_statuses,
    CASE 
        WHEN COUNT(*) >= 9 THEN '✅ PASS: All statuses present'
        ELSE '❌ FAIL: Missing statuses'
    END as result
FROM botzilla.job_status;

SELECT name FROM botzilla.job_status ORDER BY name;

\echo ''
\echo '========================================='
\echo '✅ VERIFICACIÓN COMPLETA'
\echo '========================================='
```

Guarda esto en un archivo y ejecútalo:

```bash
psql -U postgres -d botzilla_production -f verification.sql
```

---

## 🔄 PLAN DE ROLLBACK (EN CASO DE ERROR)

Si algo sale mal, ejecuta estos comandos para revertir TODAS las migraciones:

```sql
-- ============================================================================
-- ROLLBACK COMPLETO (Solo ejecutar si es necesario)
-- ============================================================================

BEGIN;

-- Rollback Migración 3: Job sync fields
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS attic_tech_job_id CASCADE;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS attic_tech_estimate_id CASCADE;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_known_status_id CASCADE;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_synced_at CASCADE;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_notification_sent_at CASCADE;

DROP INDEX IF EXISTS botzilla.idx_job_attic_tech_job_id;
DROP INDEX IF EXISTS botzilla.idx_job_attic_tech_estimate_id;
DROP INDEX IF EXISTS botzilla.idx_job_last_synced_at;
DROP INDEX IF EXISTS botzilla.idx_job_last_known_status_id;
DROP INDEX IF EXISTS botzilla.idx_job_notification_sent;

-- Rollback Migración 2: Employee attic_tech_user_id
ALTER TABLE botzilla.employee DROP COLUMN IF EXISTS attic_tech_user_id CASCADE;
DROP INDEX IF EXISTS botzilla.idx_employee_attic_tech_user_id;

-- Rollback Migración 1: Operation Manager Role
DELETE FROM botzilla.user_rol WHERE name = 'operation manager';

COMMIT;

-- Verificar rollback
SELECT 'Rollback completed' as status;
```

**⚠️ IMPORTANTE:** Solo usa el rollback si las migraciones causaron problemas. Si ya desplegaste el código del backend, el rollback causará errores en la aplicación.

---

## 📊 ESTADÍSTICAS POST-MIGRACIÓN

Después de ejecutar las migraciones, puedes revisar estas estadísticas:

```sql
-- Total de employees
SELECT 
    COUNT(*) as total_employees,
    COUNT(attic_tech_user_id) as with_at_id,
    COUNT(*) - COUNT(attic_tech_user_id) as without_at_id
FROM botzilla.employee;

-- Total de jobs
SELECT 
    COUNT(*) as total_jobs,
    COUNT(attic_tech_job_id) as synced_from_at,
    COUNT(*) - COUNT(attic_tech_job_id) as manual_jobs
FROM botzilla.job;

-- Job statuses disponibles
SELECT COUNT(*) as total_statuses FROM botzilla.job_status;

-- Roles disponibles
SELECT name FROM botzilla.user_rol ORDER BY name;
```

---

## ✅ CHECKLIST FINAL

Marca cada paso conforme lo completes:

- [ ] **PASO 0:** Backup de base de datos completado y verificado
- [ ] **MIGRACIÓN 1:** Operation Manager Role ejecutada ✓
- [ ] **MIGRACIÓN 1:** Verificación exitosa ✓
- [ ] **MIGRACIÓN 2:** Employee attic_tech_user_id ejecutada ✓
- [ ] **MIGRACIÓN 2:** Verificación exitosa ✓
- [ ] **MIGRACIÓN 3:** Job sync fields ejecutada ✓
- [ ] **MIGRACIÓN 3:** Verificación exitosa ✓
- [ ] **VERIFICACIÓN COMPLETA:** Script ejecutado sin errores ✓
- [ ] **ESTADÍSTICAS:** Revisadas y correctas ✓

---

## 📞 CONTACTO EN CASO DE PROBLEMAS

Si encuentras algún error durante la ejecución de las migraciones:

1. **NO CONTINÚES** con las siguientes migraciones
2. **GUARDA** el mensaje de error completo
3. **CONTACTA** al desarrollador (Marce)
4. **CONSIDERA** hacer rollback si el error es crítico

---

## 🎯 RESUMEN EJECUTIVO

**Qué hace cada migración:**
1. ✅ Agrega rol "operation manager" (1 INSERT)
2. ✅ Agrega columna `attic_tech_user_id` en Employee (1 ALTER + 1 INDEX)
3. ✅ Agrega 6 columnas de sync en Job + 5 índices + 9 estados (Multiple ALTERs)

**Impacto:**
- ✅ Sin pérdida de datos
- ✅ Sin downtime requerido
- ✅ Todas las operaciones son idempotentes (se pueden ejecutar múltiples veces)

**Tiempo estimado:** 5-10 minutos

---

**¡Éxito en el deployment!** 🚀

