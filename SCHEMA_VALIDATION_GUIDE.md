# 📊 GUÍA DE VALIDACIÓN DE SCHEMA DE BASE DE DATOS
## BotZilla V2 - Production Schema Validation

**Fecha:** 2025-10-14  
**Base de datos:** `botzilla_production` (PostgreSQL)  
**Propósito:** Validar que la estructura de producción coincida con desarrollo  

---

## 📋 ARCHIVOS INCLUIDOS

Este paquete contiene 3 archivos para validación de schema:

1. **`expected_schema.sql`** - Schema completo exportado desde desarrollo
2. **`verify_schema.sql`** - Script de verificación automatizada
3. **`SCHEMA_VALIDATION_GUIDE.md`** - Este documento (guía de uso)

---

## 🎯 OBJETIVO

Después de ejecutar las migraciones SQL, necesitas **validar** que la estructura de la base de datos en producción sea **idéntica** a la de desarrollo. Este proceso asegura que:

✅ Todas las tablas existen  
✅ Todas las columnas necesarias están presentes  
✅ Todos los índices fueron creados correctamente  
✅ Todas las foreign keys están configuradas  
✅ Los tipos de datos son correctos  
✅ Los datos de referencia (roles, statuses) están cargados  

---

## 🔧 MÉTODO 1: VERIFICACIÓN AUTOMATIZADA (RECOMENDADO)

Este es el método más rápido y efectivo. Usa el script `verify_schema.sql`.

### Ejecución

```bash
# Ejecutar el script de verificación
psql -U postgres -d botzilla_production -f verify_schema.sql
```

### Qué Verifica

El script realiza **12 secciones de verificación**:

1. ✅ **Tablas Principales** - Verifica que todas las tablas críticas existan
2. ✅ **Columnas en Employee** - Verifica columnas nuevas como `attic_tech_user_id`
3. ✅ **Columnas en Job** - Verifica columnas de sync como `attic_tech_job_id`
4. ✅ **Índices Críticos** - Verifica todos los índices de performance
5. ✅ **Foreign Keys** - Verifica relaciones entre tablas
6. ✅ **Roles de Usuario** - Verifica que el rol "operation manager" exista
7. ✅ **Estados de Job** - Verifica los 9 estados requeridos
8. ✅ **Constraints Unique** - Verifica unicidad de campos
9. ✅ **Tipos de Datos** - Verifica que los tipos sean correctos
10. ✅ **Estadísticas Generales** - Cuenta tablas, índices, constraints
11. ✅ **Integridad de Datos** - Verifica que los datos sean consistentes
12. ✅ **Resumen Final** - Resultado consolidado ✅ PASS o ❌ FAIL

### Interpretación de Resultados

**Si ves esto:**
```
✅ PASS - Schema is correct and ready for production
```
**→ Todo está perfecto. Puedes continuar con el deployment del código.**

**Si ves esto:**
```
❌ FAIL - Schema has issues that need to be fixed
```
**→ Revisa las secciones anteriores para identificar qué falta.**

---

## 🔧 MÉTODO 2: COMPARACIÓN MANUAL DE SCHEMA

Si prefieres una verificación más detallada o si el Método 1 mostró problemas, puedes comparar el schema completo.

### Paso 1: Exportar Schema de Producción

```bash
# Exportar solo la estructura (sin datos)
pg_dump -U postgres -d botzilla_production --schema-only --schema=botzilla > /tmp/production_schema.sql
```

### Paso 2: Comparar con Schema Esperado

```bash
# Usar diff para comparar
diff expected_schema.sql /tmp/production_schema.sql

# O usar una herramienta más visual
vimdiff expected_schema.sql /tmp/production_schema.sql
```

### Paso 3: Analizar Diferencias

Las diferencias **aceptables** incluyen:
- Comentarios adicionales
- Orden diferente de constraints
- Nombres de secuencias (ids autoincrementales)
- Ownership de objetos

Las diferencias **NO aceptables** incluyen:
- Columnas faltantes
- Índices faltantes
- Tablas faltantes
- Tipos de datos diferentes
- Foreign keys faltantes

---

## 🔍 VERIFICACIONES MANUALES ESPECÍFICAS

Si necesitas verificar algo específico, usa estos queries:

### Verificar Tabla Employee

```sql
-- Ver estructura completa
\d botzilla.employee

-- Verificar columna attic_tech_user_id
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee' 
AND column_name = 'attic_tech_user_id';

-- Debe devolver:
-- column_name | data_type | is_nullable
-- attic_tech_user_id | integer | YES
```

### Verificar Tabla Job

```sql
-- Ver estructura completa
\d botzilla.job

-- Verificar columnas de sync
SELECT column_name, data_type 
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

-- Debe devolver 6 filas
```

### Verificar Índices

```sql
-- Ver todos los índices de job
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'job' 
AND schemaname = 'botzilla'
ORDER BY indexname;

-- Buscar índices específicos
SELECT indexname 
FROM pg_indexes 
WHERE tablename = 'job' 
AND indexname LIKE 'idx_job_%';

-- Debe incluir al menos:
-- idx_job_attic_tech_job_id
-- idx_job_attic_tech_estimate_id
-- idx_job_last_synced_at
-- idx_job_last_known_status_id
-- idx_job_notification_sent
```

### Verificar Rol "operation manager"

```sql
-- Verificar que existe
SELECT id, name 
FROM botzilla.user_rol 
WHERE name = 'operation manager';

-- Debe devolver 1 fila
```

### Verificar Job Statuses

```sql
-- Ver todos los estados
SELECT id, name 
FROM botzilla.job_status 
ORDER BY name;

-- Contar estados
SELECT COUNT(*) FROM botzilla.job_status;

-- Debe ser >= 9
```

---

## ✅ CHECKLIST DE VALIDACIÓN

Usa esta lista para verificar manualmente:

### Tabla: `employee`
- [ ] Columna `id` existe (PRIMARY KEY)
- [ ] Columna `first_name` existe (VARCHAR, NOT NULL)
- [ ] Columna `last_name` existe (VARCHAR, NOT NULL)
- [ ] Columna `email` existe (VARCHAR, UNIQUE, NOT NULL)
- [ ] Columna `attic_tech_user_id` existe (INTEGER, UNIQUE, NULLABLE) ⭐ NUEVO
- [ ] Índice `idx_employee_attic_tech_user_id` existe ⭐ NUEVO
- [ ] Foreign key a `branch` existe

### Tabla: `job`
- [ ] Columna `id` existe (PRIMARY KEY)
- [ ] Columna `name` existe (VARCHAR, NOT NULL)
- [ ] Columna `status_id` existe (FK a job_status)
- [ ] Columna `attic_tech_job_id` existe (INTEGER, UNIQUE, NULLABLE) ⭐ NUEVO
- [ ] Columna `attic_tech_estimate_id` existe (INTEGER, NULLABLE) ⭐ NUEVO
- [ ] Columna `last_known_status_id` existe (INTEGER, NULLABLE) ⭐ NUEVO
- [ ] Columna `last_synced_at` existe (TIMESTAMP, NULLABLE) ⭐ NUEVO
- [ ] Columna `last_notification_sent_at` existe (TIMESTAMP, NULLABLE) ⭐ NUEVO
- [ ] Columna `notification_sent` existe (BOOLEAN, DEFAULT FALSE) ⭐ NUEVO
- [ ] Índice `idx_job_attic_tech_job_id` existe ⭐ NUEVO
- [ ] Índice `idx_job_attic_tech_estimate_id` existe ⭐ NUEVO
- [ ] Índice `idx_job_last_synced_at` existe ⭐ NUEVO
- [ ] Índice `idx_job_last_known_status_id` existe ⭐ NUEVO
- [ ] Índice `idx_job_notification_sent` existe ⭐ NUEVO
- [ ] Foreign key `last_known_status_id` → `job_status(id)` existe ⭐ NUEVO

### Tabla: `user_rol`
- [ ] Rol "admin" existe
- [ ] Rol "user" existe
- [ ] Rol "office_manager" existe
- [ ] Rol "operation manager" existe ⭐ NUEVO

### Tabla: `job_status`
- [ ] Al menos 9 estados existen
- [ ] Estado "Requires Scheduling" existe
- [ ] Estado "Requires Crew Lead" existe ⭐ IMPORTANTE
- [ ] Estado "Plans In Progress" existe ⭐ IMPORTANTE
- [ ] Estado "In Production" existe
- [ ] Estado "Production Complete" existe
- [ ] Estado "Closed Job" existe
- [ ] Estado "Cancelled" existe
- [ ] Estado "On Hold" existe
- [ ] Estado "Pending Review" existe

### Tabla: `crew_member`
- [ ] Columna `employee_id` existe (FK a employee)
- [ ] Foreign key a `employee` existe

### Tabla: `sales_person`
- [ ] Columna `employee_id` existe (FK a employee)
- [ ] Foreign key a `employee` existe

---

## 🚨 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: Columna `attic_tech_user_id` no existe en `employee`

**Solución:**
```sql
ALTER TABLE botzilla.employee 
ADD COLUMN attic_tech_user_id INTEGER UNIQUE;

CREATE INDEX idx_employee_attic_tech_user_id 
ON botzilla.employee(attic_tech_user_id);
```

### Problema 2: Columnas de sync no existen en `job`

**Solución:**
Ejecuta la migración 3 completa desde `SQL_MIGRATION_INSTRUCTIONS.md`.

### Problema 3: Rol "operation manager" no existe

**Solución:**
```sql
INSERT INTO botzilla.user_rol (name) 
VALUES ('operation manager')
ON CONFLICT (name) DO NOTHING;
```

### Problema 4: Faltan job statuses

**Solución:**
```sql
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
```

### Problema 5: Índices faltantes

**Solución:**
Ejecuta las secciones de creación de índices desde la migración 3.

---

## 📊 REPORTE DE VALIDACIÓN

Después de ejecutar `verify_schema.sql`, documenta los resultados:

```
====================================
REPORTE DE VALIDACIÓN DE SCHEMA
====================================
Fecha: _______________
Servidor: _______________
Base de datos: botzilla_production

RESULTADOS:
- Sección 1 (Tablas): ✅/❌
- Sección 2 (Employee): ✅/❌
- Sección 3 (Job): ✅/❌
- Sección 4 (Índices): ✅/❌
- Sección 5 (Foreign Keys): ✅/❌
- Sección 6 (Roles): ✅/❌
- Sección 7 (Job Status): ✅/❌
- Sección 8 (Unique Constraints): ✅/❌
- Sección 9 (Tipos de Datos): ✅/❌
- Sección 10 (Estadísticas): ✅/❌
- Sección 11 (Integridad): ✅/❌
- Sección 12 (Resumen): ✅/❌

RESULTADO FINAL: ✅ PASS / ❌ FAIL

NOTAS:
______________________________________
______________________________________
______________________________________

Validado por: _______________
```

---

## 🎯 SIGUIENTES PASOS

### Si la validación fue exitosa (✅ PASS):
1. ✅ Documentar que el schema es correcto
2. ✅ Proceder con el deployment del código backend
3. ✅ Proceder con el deployment del código frontend
4. ✅ Ejecutar tests post-deployment

### Si la validación falló (❌ FAIL):
1. ❌ Identificar las secciones que fallaron
2. ❌ Revisar los detalles del error en la salida del script
3. ❌ Ejecutar las migraciones faltantes desde `SQL_MIGRATION_INSTRUCTIONS.md`
4. ❌ Re-ejecutar `verify_schema.sql`
5. ❌ Repetir hasta obtener ✅ PASS

---

## 📞 CONTACTO EN CASO DE DUDAS

Si tienes preguntas sobre la validación o encuentras discrepancias:

1. Guarda la salida completa de `verify_schema.sql`
2. Documenta las secciones que fallaron
3. Contacta al desarrollador (Marce)

---

## 📝 NOTAS IMPORTANTES

⚠️ **NO modifiques `expected_schema.sql`** - Este archivo es la referencia  
⚠️ **NO ejecutes `expected_schema.sql` directamente** - Solo úsalo para comparación  
✅ **SÍ ejecuta `verify_schema.sql`** - Es seguro y solo hace queries SELECT  
✅ **SÍ documenta todos los resultados** - Para auditoría futura  

---

**¡Éxito en la validación!** 🚀

