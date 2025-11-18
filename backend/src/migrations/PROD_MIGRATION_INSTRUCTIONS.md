# 🚀 Instrucciones para Migración en Producción

## Sistema de Follow-Up para Estimates

**Fecha:** 2025-11-18  
**Archivo SQL:** `PROD_MIGRATION_follow_up_system.sql`

---

## ⚠️ Pre-requisitos

Antes de ejecutar la migración, verifica:

1. ✅ **Backup de la base de datos**
   ```bash
   pg_dump -h <host> -U <user> -d <database> > backup_pre_followup_$(date +%Y%m%d_%H%M%S).sql
   ```

2. ✅ **Verificar que existen las tablas requeridas:**
   - `botzilla.estimate` (debe existir)
   - `botzilla.user` (debe existir, no `users`)

3. ✅ **Conexión a la base de datos de producción:**
   ```bash
   psql -h <host> -U <user> -d <database>
   ```

---

## 📋 Pasos para Ejecutar la Migración

### Paso 1: Verificar estado actual

```sql
-- Ver si ya existen las tablas del sistema de follow-up
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
  AND table_name IN ('follow_up_status', 'follow_up_label', 'chat', 'chat_message', 'follow_up_ticket')
ORDER BY table_name;

-- Debería retornar 0 filas (o las tablas que ya existan)
```

### Paso 2: Ejecutar la migración

**Opción A: Desde archivo SQL**
```bash
psql -h <host> -U <user> -d <database> -f PROD_MIGRATION_follow_up_system.sql
```

**Opción B: Copiar y pegar en psql**
```bash
# Conectarse a la base
psql -h <host> -U <user> -d <database>

# Copiar y pegar todo el contenido de PROD_MIGRATION_follow_up_system.sql
```

### Paso 3: Verificar resultado

Después de ejecutar, deberías ver:

```
✅ Verificación exitosa: Todas las tablas, datos y columnas fueron creados correctamente
COMMIT
```

---

## ✅ Queries de Verificación Post-Migración

Ejecutar estas queries para confirmar que todo está correcto:

### 1. Ver las tablas creadas

```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'botzilla' 
    AND tablename IN ('follow_up_status', 'follow_up_label', 'chat', 'chat_message', 'follow_up_ticket')
ORDER BY tablename;
```

**Resultado esperado:** 5 tablas listadas

---

### 2. Ver los estados insertados

```sql
SELECT id, name, description, color FROM botzilla.follow_up_status ORDER BY id;
```

**Resultado esperado:**
| id | name | description | color |
|----|------|-------------|-------|
| 1 | Lost | Customer decided not to proceed | #EF4444 |
| 2 | Sold | Customer accepted and purchased | #10B981 |
| 3 | Negotiating | Actively negotiating with customer | #F59E0B |

---

### 3. Ver los labels insertados

```sql
SELECT id, name, description, color FROM botzilla.follow_up_label ORDER BY id;
```

**Resultado esperado:**
| id | name | description | color |
|----|------|-------------|-------|
| 1 | PMP | Price Match Promise follow-up | #3B82F6 |
| 2 | Discount | Discount offer follow-up | #8B5CF6 |
| 3 | Other | Other follow-up reasons | #6B7280 |

---

### 4. Verificar columna en estimate

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'botzilla'
  AND table_name = 'estimate'
  AND column_name = 'follow_up_ticket_id';
```

**Resultado esperado:** 1 fila mostrando la nueva columna

---

### 5. Verificar índices

```sql
SELECT
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'botzilla'
    AND tablename IN ('follow_up_ticket', 'chat_message')
ORDER BY tablename, indexname;
```

**Resultado esperado:** Múltiples índices listados para ambas tablas

---

## 🔧 Troubleshooting

### Error: "relation botzilla.user does not exist"

**Causa:** La tabla de usuarios tiene un nombre diferente  
**Solución:** Editar el script y cambiar `botzilla.user` por el nombre correcto (ej: `botzilla.users`)

```sql
-- Línea a modificar (línea 115):
assigned_to INTEGER REFERENCES botzilla.user(id),
-- Cambiar a:
assigned_to INTEGER REFERENCES botzilla.users(id),
```

---

### Error: "relation botzilla.estimate does not exist"

**Causa:** La tabla estimate no existe o está en otro schema  
**Solución:** Verificar el schema correcto

```sql
-- Ver dónde está la tabla estimate
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name = 'estimate';
```

---

### Error: La transacción falla y hace ROLLBACK

**Causa:** Alguna condición de verificación no se cumplió  
**Solución:** 
1. Revisar el mensaje de error específico
2. Verificar que las tablas/columnas requeridas existen
3. Ejecutar las queries del Paso 1 para diagnóstico

---

## 🎯 Post-Migración

### 1. Reiniciar el backend

```bash
# Reiniciar el servicio Node.js para cargar los nuevos modelos
pm2 restart botzilla-api
# o
systemctl restart botzilla-api
```

---

### 2. Verificar logs del backend

```bash
# Ver que no hay errores relacionados con las nuevas tablas
pm2 logs botzilla-api --lines 100
```

---

### 3. Ejecutar estimate-sync

El sync automáticamente creará tickets para todos los estimates "Lost":

```bash
# Ejecutar manualmente o esperar al cron
curl -X POST http://localhost:3000/api/automations/estimate-sync \
  -H "x-api-key: YOUR_API_KEY"
```

---

### 4. Verificar que se crearon tickets

```sql
-- Ver cuántos tickets se crearon automáticamente
SELECT 
    COUNT(*) as total_tickets,
    COUNT(*) FILTER (WHERE followed_up = true) as followed_up,
    COUNT(*) FILTER (WHERE followed_up = false) as pending
FROM botzilla.follow_up_ticket;

-- Ver tickets con detalles
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

---

## 📊 Estadísticas Útiles

### Tickets por estado

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

---

### Tickets por label

```sql
SELECT 
    fl.name as label,
    COUNT(*) as count
FROM botzilla.follow_up_ticket ft
LEFT JOIN botzilla.follow_up_label fl ON ft.label_id = fl.id
GROUP BY fl.name
ORDER BY count DESC;
```

---

### Tickets asignados vs sin asignar

```sql
SELECT 
    CASE 
        WHEN assigned_to IS NOT NULL THEN 'Assigned'
        ELSE 'Unassigned'
    END as assignment_status,
    COUNT(*) as count
FROM botzilla.follow_up_ticket
GROUP BY assignment_status;
```

---

## 🔄 Rollback (Si es necesario)

Si algo sale mal y necesitas revertir:

```sql
-- CUIDADO: Esto eliminará todas las tablas del sistema de follow-up
BEGIN;

-- Eliminar columna de estimate
ALTER TABLE botzilla.estimate DROP COLUMN IF EXISTS follow_up_ticket_id;

-- Eliminar tablas (en orden debido a dependencias)
DROP TABLE IF EXISTS botzilla.follow_up_ticket CASCADE;
DROP TABLE IF EXISTS botzilla.chat_message CASCADE;
DROP TABLE IF EXISTS botzilla.chat CASCADE;
DROP TABLE IF EXISTS botzilla.follow_up_label CASCADE;
DROP TABLE IF EXISTS botzilla.follow_up_status CASCADE;

-- Eliminar función (solo si no se usa en otros lugares)
-- DROP FUNCTION IF EXISTS botzilla.update_updated_at_column() CASCADE;

COMMIT;

-- Restaurar desde backup
-- psql -h <host> -U <user> -d <database> < backup_pre_followup_YYYYMMDD_HHMMSS.sql
```

---

## 📞 Contacto

Si encuentras algún problema durante la migración:
1. 📸 Tomar screenshot del error completo
2. 📋 Copiar el mensaje de error de PostgreSQL
3. 🔍 Verificar los logs del backend
4. 💬 Reportar en el canal de desarrollo

---

## ✅ Checklist Final

- [ ] Backup de base de datos realizado
- [ ] Migración ejecutada sin errores
- [ ] Queries de verificación confirmadas
- [ ] Backend reiniciado
- [ ] Logs del backend sin errores
- [ ] Estimate-sync ejecutado
- [ ] Tickets creados para estimates "Lost"
- [ ] Frontend accesible en `/follow-up/estimates`
- [ ] Modal de follow-up funcional

---

**¡Listo! El sistema de follow-up está operativo en producción.** 🎉

