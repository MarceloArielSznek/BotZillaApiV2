# 🚀 Instrucciones para Migración MASTER en Producción

## Sistema Completo de Follow-Up para Estimates (4 DÍAS DE TRABAJO)

**Fecha:** 2025-11-18  
**Archivo SQL:** `PROD_MIGRATION_MASTER_COMPLETE.sql`  
**Duración estimada:** 5-10 segundos

---

## 📦 ¿Qué incluye esta migración?

Este script incluye **TODAS** las funcionalidades implementadas en los últimos 4 días:

### 1. ✅ Payment Methods
- Tabla `payment_method` (credit, cash, financing, check)
- Campo `payment_method_id` en `estimate`
- Afecta cálculos de pricing multipliers

### 2. ✅ Branch Configuration + Multiplier Ranges
- Tabla `branch_configuration` (baseConstants de AT)
- Tabla `multiplier_range` (rangos de precio y multiplicadores)
- Tabla junction `branch_configuration_multiplier_range` (many-to-many)
- Campos `attic_tech_branch_id` y `branch_configuration_id` en `branch`

### 3. ✅ Washington State Tax Calculation
- Tabla `wa_tax_rates` (50+ ZIP codes precargados)
- 8 campos de tax en `estimate` (rates, amounts, prices)
- Cálculo automático durante estimate-sync

### 4. ✅ Snapshot Multiplier Ranges
- Campo `snapshot_multiplier_ranges` (JSONB) en `estimate`
- Guarda los multiplicadores vigentes al momento de crear el estimate
- Permite análisis histórico de pricing

### 5. ✅ Follow-up System
- Tabla `follow_up_status` (Lost, Sold, Negotiating)
- Tabla `follow_up_label` (PMP, Discount, Other)
- Tabla `chat` (contenedor de conversaciones)
- Tabla `chat_message` (mensajes individuales)
- Tabla `follow_up_ticket` (ticket principal)
- Relación bidireccional con `estimate`

---

## ⚠️ Pre-requisitos

### 1. Hacer Backup
```bash
# OBLIGATORIO: Backup completo de la base de datos
pg_dump -h <host> -U <user> -d <database> \
  -F c -b -v -f backup_master_migration_$(date +%Y%m%d_%H%M%S).backup

# O en formato SQL plano
pg_dump -h <host> -U <user> -d <database> \
  > backup_master_migration_$(date +%Y%m%d_%H%M%S).sql
```

### 2. Verificar Tablas Requeridas
```sql
-- Conectarse a la base
psql -h <host> -U <user> -d <database>

-- Verificar que existen las tablas base
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
  AND table_name IN ('estimate', 'branch', 'user')
ORDER BY table_name;

-- Debe mostrar: branch, estimate, user (3 tablas)
```

### 3. Verificar Espacio en Disco
```sql
-- Ver tamaño actual de la base
SELECT 
    pg_database.datname,
    pg_size_pretty(pg_database_size(pg_database.datname)) AS size
FROM pg_database
WHERE datname = current_database();

-- Necesitas al menos 100 MB libres
```

---

## 🚀 Ejecutar la Migración

### Opción A: Desde archivo SQL (RECOMENDADO)

```bash
# 1. Subir el archivo al servidor
scp PROD_MIGRATION_MASTER_COMPLETE.sql user@server:/tmp/

# 2. Conectarse al servidor
ssh user@server

# 3. Ejecutar la migración
psql -h <host> -U <user> -d <database> \
  -f /tmp/PROD_MIGRATION_MASTER_COMPLETE.sql

# Si todo sale bien, verás al final:
# ✅ VERIFICACIÓN EXITOSA: Todas las tablas, columnas y datos fueron creados correctamente
# COMMIT
```

### Opción B: Copiar y pegar

```bash
# 1. Conectarse a la base
psql -h <host> -U <user> -d <database>

# 2. Copiar TODO el contenido de PROD_MIGRATION_MASTER_COMPLETE.sql

# 3. Pegar en el terminal de psql y presionar Enter

# 4. Esperar a que termine (5-10 segundos)
```

---

## ✅ Verificación Post-Migración

### 1. Verificar que el COMMIT fue exitoso

Deberías ver este mensaje al final:

```
✅ VERIFICACIÓN EXITOSA: Todas las tablas, columnas y datos fueron creados correctamente
📊 Resumen:
  - 10 tablas nuevas creadas
  - 6 columnas agregadas (4 a estimate, 2 a branch)
  - Payment methods: 4 registros
  - Follow-up statuses: 3 registros
  - Follow-up labels: 3 registros
  - WA tax rates: 50+ ZIP codes
COMMIT
```

### 2. Ver las tablas creadas

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'botzilla' 
    AND tablename IN (
        'payment_method',
        'branch_configuration',
        'multiplier_range',
        'branch_configuration_multiplier_range',
        'wa_tax_rates',
        'follow_up_status',
        'follow_up_label',
        'chat',
        'chat_message',
        'follow_up_ticket'
    )
ORDER BY tablename;
```

**Resultado esperado:** 10 tablas listadas

### 3. Ver datos insertados

```sql
SELECT 'payment_method' as tabla, COUNT(*) as registros FROM botzilla.payment_method
UNION ALL
SELECT 'follow_up_status', COUNT(*) FROM botzilla.follow_up_status
UNION ALL
SELECT 'follow_up_label', COUNT(*) FROM botzilla.follow_up_label
UNION ALL
SELECT 'wa_tax_rates', COUNT(*) FROM botzilla.wa_tax_rates
ORDER BY tabla;
```

**Resultado esperado:**
| tabla | registros |
|-------|-----------|
| follow_up_label | 3 |
| follow_up_status | 3 |
| payment_method | 4 |
| wa_tax_rates | 50+ |

### 4. Ver columnas agregadas a estimate

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'estimate'
  AND column_name IN (
      'payment_method_id',
      'city_tax_rate',
      'state_tax_rate',
      'total_tax_rate',
      'snapshot_multiplier_ranges',
      'follow_up_ticket_id'
  )
ORDER BY column_name;
```

**Resultado esperado:** 6+ columnas nuevas en estimate

### 5. Ver columnas agregadas a branch

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'branch'
  AND column_name IN ('attic_tech_branch_id', 'branch_configuration_id')
ORDER BY column_name;
```

**Resultado esperado:** 2 columnas nuevas en branch

---

## 🔧 Post-Migración: Pasos Obligatorios

### 1. Reiniciar el Backend

```bash
# Si usas PM2
pm2 restart botzilla-api

# O si usas systemctl
systemctl restart botzilla-api

# Verificar que arrancó bien
pm2 logs botzilla-api --lines 50
# o
journalctl -u botzilla-api -n 50
```

### 2. Sincronizar Branch Configurations

```bash
# Ejecutar el endpoint para traer las configuraciones desde Attic Tech
curl -X GET "https://yallaprojects.com/api/automations/multiplier-ranges-sync?all=true" \
  -H "x-api-key: YOUR_API_KEY"

# Esto llenará:
# - branch_configuration (con datos de AT)
# - branch.branch_configuration_id (FK)
# - branch_configuration_multiplier_range (relaciones)
```

Verificar resultado:
```sql
-- Ver configuraciones sincronizadas
SELECT id, at_config_id, name, sub_multiplier, min_retail_price
FROM botzilla.branch_configuration
ORDER BY id;

-- Ver branches con configuración asignada
SELECT 
    b.id,
    b.name,
    b.attic_tech_branch_id,
    b.branch_configuration_id,
    bc.name as config_name
FROM botzilla.branch b
LEFT JOIN botzilla.branch_configuration bc ON b.branch_configuration_id = bc.id
ORDER BY b.id;
```

### 3. Ejecutar Estimate Sync

```bash
# Esto creará automáticamente tickets para estimates "Lost"
curl -X POST "https://yallaprojects.com/api/automations/estimate-sync" \
  -H "x-api-key: YOUR_API_KEY"

# O ejecutar manualmente desde el admin panel
```

Verificar resultado:
```sql
-- Ver tickets creados
SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE followed_up = true) as followed_up,
    COUNT(*) FILTER (WHERE followed_up = false) as pending
FROM botzilla.follow_up_ticket;

-- Ver detalles de tickets
SELECT 
    ft.id,
    e.customer_name,
    e.branch_name,
    fs.name as status,
    fl.name as label,
    ft.followed_up,
    ft.created_at
FROM botzilla.follow_up_ticket ft
JOIN botzilla.estimate e ON ft.estimate_id = e.id
LEFT JOIN botzilla.follow_up_status fs ON ft.status_id = fs.id
LEFT JOIN botzilla.follow_up_label fl ON ft.label_id = fl.id
ORDER BY ft.created_at DESC
LIMIT 20;
```

### 4. Verificar Frontend

```bash
# Acceder a la página de follow-up
https://yallaprojects.com/follow-up/estimates

# Verificar que:
# ✅ Se muestran los estimates "Lost"
# ✅ Se puede abrir el modal de cada ticket (ícono azul 📋)
# ✅ Se pueden seleccionar status y labels
# ✅ Se puede guardar información
```

---

## 🐛 Troubleshooting

### Error: "relation botzilla.user does not exist"

**Causa:** La tabla de usuarios tiene un nombre diferente  
**Solución:** Editar el script y cambiar `botzilla.user` por el nombre correcto (ej: `botzilla.users`)

```sql
-- Buscar el nombre correcto
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
  AND table_name LIKE '%user%';
```

### Error: "duplicate key value violates unique constraint"

**Causa:** Ya existen algunos datos insertados  
**Solución:** El script usa `ON CONFLICT DO NOTHING`, así que esto es normal. Continúa.

### Error: La transacción falla y hace ROLLBACK

**Causa:** Alguna condición de verificación no se cumplió  
**Solución:**
1. Revisar el mensaje de error específico
2. Ejecutar las queries de verificación del Paso 2 (Pre-requisitos)
3. Corregir el problema identificado
4. Volver a ejecutar el script

### Error: "out of shared memory"

**Causa:** PostgreSQL no tiene suficiente memoria compartida  
**Solución:** Ejecutar el script en partes (comentar secciones y ejecutar una por una)

---

## 📊 Queries Útiles Post-Migración

### Estimates con tax calculado

```sql
SELECT 
    id,
    customer_name,
    customer_address,
    final_price,
    total_tax_amount,
    price_after_taxes
FROM botzilla.estimate
WHERE total_tax_amount IS NOT NULL
ORDER BY id DESC
LIMIT 20;
```

### Estimates con multiplier ranges guardados

```sql
SELECT 
    id,
    customer_name,
    true_cost,
    retail_price,
    snapshot_multiplier_ranges
FROM botzilla.estimate
WHERE snapshot_multiplier_ranges IS NOT NULL
ORDER BY id DESC
LIMIT 10;
```

### Estimates con payment method

```sql
SELECT 
    e.id,
    e.customer_name,
    pm.name as payment_method,
    e.final_price
FROM botzilla.estimate e
LEFT JOIN botzilla.payment_method pm ON e.payment_method_id = pm.id
WHERE e.payment_method_id IS NOT NULL
ORDER BY e.id DESC
LIMIT 20;
```

### Follow-up tickets por status

```sql
SELECT 
    fs.name as status,
    COUNT(*) as count,
    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER (), 2) as percentage
FROM botzilla.follow_up_ticket ft
JOIN botzilla.follow_up_status fs ON ft.status_id = fs.id
GROUP BY fs.name
ORDER BY count DESC;
```

### Follow-up tickets por branch

```sql
SELECT 
    e.branch_name,
    COUNT(*) as tickets,
    COUNT(*) FILTER (WHERE ft.followed_up = true) as followed_up,
    COUNT(*) FILTER (WHERE ft.followed_up = false) as pending
FROM botzilla.follow_up_ticket ft
JOIN botzilla.estimate e ON ft.estimate_id = e.id
GROUP BY e.branch_name
ORDER BY tickets DESC;
```

---

## 🔄 Rollback (Si es necesario)

⚠️ **CUIDADO:** Esto eliminará todas las tablas y datos creados

```sql
-- SOLO EJECUTAR SI HAY PROBLEMAS GRAVES
BEGIN;

-- 1. Eliminar columnas agregadas a estimate
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS payment_method_id;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS city_tax_rate;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS state_tax_rate;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS total_tax_rate;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS city_tax_amount;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS state_tax_amount;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS total_tax_amount;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS price_before_taxes;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS price_after_taxes;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS snapshot_multiplier_ranges;
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS follow_up_ticket_id;

-- 2. Eliminar columnas agregadas a branch
ALTER TABLE botzilla.branch DROP COLUMN IF EXISTS attic_tech_branch_id;
ALTER TABLE botzilla.branch DROP COLUMN IF EXISTS branch_configuration_id;

-- 3. Eliminar tablas (en orden debido a dependencias)
DROP TABLE IF EXISTS botzilla.follow_up_ticket CASCADE;
DROP TABLE IF EXISTS botzilla.chat_message CASCADE;
DROP TABLE IF EXISTS botzilla.chat CASCADE;
DROP TABLE IF EXISTS botzilla.follow_up_label CASCADE;
DROP TABLE IF EXISTS botzilla.follow_up_status CASCADE;
DROP TABLE IF EXISTS botzilla.branch_configuration_multiplier_range CASCADE;
DROP TABLE IF EXISTS botzilla.multiplier_range CASCADE;
DROP TABLE IF EXISTS botzilla.branch_configuration CASCADE;
DROP TABLE IF EXISTS botzilla.wa_tax_rates CASCADE;
DROP TABLE IF EXISTS botzilla.payment_method CASCADE;

COMMIT;

-- 4. Restaurar desde backup
-- psql -h <host> -U <user> -d <database> < backup_master_migration_YYYYMMDD_HHMMSS.sql
```

---

## ✅ Checklist Final

Antes de considerar la migración completa, verificar:

- [ ] ✅ Backup de base de datos realizado
- [ ] ✅ Script ejecutado sin errores
- [ ] ✅ Mensaje "COMMIT" al final
- [ ] ✅ 10 tablas nuevas creadas
- [ ] ✅ Datos insertados (payment methods, statuses, labels, tax rates)
- [ ] ✅ Backend reiniciado sin errores
- [ ] ✅ Multiplier ranges sincronizados
- [ ] ✅ Estimate sync ejecutado
- [ ] ✅ Tickets creados para estimates "Lost"
- [ ] ✅ Frontend accesible en `/follow-up/estimates`
- [ ] ✅ Modal de follow-up funcional
- [ ] ✅ Se pueden guardar cambios en tickets

---

## 📞 Soporte

Si encuentras algún problema:

1. 📸 **Screenshot del error completo** (mensaje de PostgreSQL)
2. 📋 **Logs del backend** (`pm2 logs` o `journalctl`)
3. 🔍 **Queries de verificación** ejecutadas
4. 💬 **Reportar en el canal de desarrollo**

---

**¡Listo! El sistema completo de follow-up está operativo en producción.** 🎉

**Recuerda:** Este script es **idempotente** - se puede ejecutar múltiples veces sin problemas. Si algo falla, todo se revierte automáticamente (transacción).

