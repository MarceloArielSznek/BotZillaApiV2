# 🚀 Deployment Instructions - Branch Configuration & Multiplier Ranges

## 📋 Resumen de Cambios

Este deployment introduce una nueva estructura para gestionar configuraciones de branches y multiplier ranges con relación **muchos a muchos**.

### Nuevas Tablas:
- ✅ `branch_configuration` - Configuraciones de branches (baseConstants, financeFactors)
- ✅ `multiplier_range` - Rangos de multiplicadores (renombrada de `branch_multiplier_config`)
- ✅ `branch_configuration_multiplier_range` - Tabla junction (many-to-many)

### Modificaciones:
- ✅ `branch` - Agregado `attic_tech_branch_id` y `branch_configuration_id`

---

## 🔧 Pasos para Deploy en Producción

### **1️⃣ Backend: Push del Código**

```bash
# En tu local
git add .
git commit -m "feat: add branch configuration with multiplier ranges (many-to-many)"
git push origin main
```

### **2️⃣ Base de Datos: Ejecutar Migración**

**En el servidor de producción**, ejecuta el script SQL:

```bash
# Opción A: Desde psql
psql -h DB_HOST -p DB_PORT -U DB_USER -d DB_NAME -f backend/src/migrations/PROD_MIGRATION_branch_configuration_complete.sql

# Opción B: Con password en variable de entorno
PGPASSWORD=your_password psql -h DB_HOST -p DB_PORT -U DB_USER -d DB_NAME -f backend/src/migrations/PROD_MIGRATION_branch_configuration_complete.sql
```

**Resultado esperado:**
```
CREATE TABLE
CREATE INDEX
ALTER TABLE
ALTER TABLE
CREATE TABLE
...
✅ Migration completed successfully
```

### **3️⃣ Verificar la Migración**

```sql
-- Verificar que las tablas existen
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'botzilla' 
AND table_name IN ('branch_configuration', 'multiplier_range', 'branch_configuration_multiplier_range');

-- Verificar columnas nuevas en branch
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'branch' 
AND column_name IN ('attic_tech_branch_id', 'branch_configuration_id');

-- Verificar que multiplier_range existe (renombrada)
SELECT COUNT(*) as existing_ranges FROM botzilla.multiplier_range;
```

### **4️⃣ Backend: Reiniciar el Servidor**

```bash
# Si usas PM2
pm2 restart botzilla-api

# Si usas systemctl
sudo systemctl restart botzilla-api

# Verificar que inició correctamente
pm2 logs botzilla-api --lines 50
```

### **5️⃣ Sincronizar Datos desde Attic Tech**

**Ejecutar el endpoint de sync** (desde Postman, Insomnia, o curl):

```bash
curl -X GET "https://yallaprojects.com/api/automations/multiplier-ranges-sync?all=true" \
  -H "x-api-key: YOUR_API_KEY"
```

**Este endpoint automáticamente:**
1. ✅ Consulta todos los branches con `attic_tech_branch_id`
2. ✅ Para cada branch, obtiene su configuración desde Attic Tech
3. ✅ Crea/actualiza `branch_configuration` con todos los baseConstants
4. ✅ Crea/actualiza todos los `multiplier_range`
5. ✅ Crea las relaciones en la tabla junction
6. ✅ Actualiza `branch.branch_configuration_id` (FK)

**Respuesta esperada:**

```json
{
  "success": true,
  "message": "✅ Multiplier ranges sync completed. Total ranges: 18, Created: 18, Updated: 0",
  "summary": {
    "branches_processed": 6,
    "total_ranges_fetched": 18,
    "total_ranges_created": 18,
    "total_ranges_updated": 0
  },
  "results": [
    {
      "branch_name": "San Diego",
      "at_branch_id": 4,
      "at_config_id": 4,
      "config_name": "San Diego CA Config",
      "total_ranges": 3,
      "ranges_created": 3,
      "ranges_updated": 0,
      "status": "success"
    }
    // ... más branches
  ]
}
```

### **6️⃣ Verificar Resultado Final**

```sql
-- Ver configuraciones creadas
SELECT 
    id,
    at_config_id,
    name,
    base_hourly_rate,
    finance_factors
FROM botzilla.branch_configuration;

-- Ver branches con sus configuraciones
SELECT 
    b.id,
    b.name as branch_name,
    b.attic_tech_branch_id,
    bc.at_config_id,
    bc.name as config_name
FROM botzilla.branch b
LEFT JOIN botzilla.branch_configuration bc 
    ON b.branch_configuration_id = bc.id
ORDER BY b.name;

-- Ver multiplier ranges por configuración
SELECT 
    bc.name as config_name,
    mr.name as range_name,
    mr.min_cost,
    mr.max_cost,
    mr.lowest_multiple,
    mr.highest_multiple
FROM botzilla.branch_configuration bc
JOIN botzilla.branch_configuration_multiplier_range junction 
    ON bc.id = junction.branch_configuration_id
JOIN botzilla.multiplier_range mr 
    ON junction.multiplier_range_id = mr.id
ORDER BY bc.name, mr.min_cost;

-- Verificar totales
SELECT 
    'Configurations' as tipo,
    COUNT(*) as total
FROM botzilla.branch_configuration
UNION ALL
SELECT 
    'Multiplier Ranges' as tipo,
    COUNT(*) as total
FROM botzilla.multiplier_range
UNION ALL
SELECT 
    'Config-Range Relations' as tipo,
    COUNT(*) as total
FROM botzilla.branch_configuration_multiplier_range
UNION ALL
SELECT 
    'Branches with Config' as tipo,
    COUNT(*) as total
FROM botzilla.branch
WHERE branch_configuration_id IS NOT NULL;
```

**Resultado esperado:**

| tipo | total |
|------|-------|
| Configurations | 6 |
| Multiplier Ranges | 15-20 |
| Config-Range Relations | 18-24 |
| Branches with Config | 6 |

---

## 🔄 Sincronización Recurrente (Opcional)

Para mantener los datos actualizados, puedes configurar un cron job o automation en Make.com:

```bash
# Ejecutar cada 24 horas
GET https://yallaprojects.com/api/automations/multiplier-ranges-sync?all=true
Headers: x-api-key: YOUR_API_KEY
```

---

## 🆘 Rollback (Si algo sale mal)

Si necesitas revertir los cambios:

```sql
-- SOLO SI ES NECESARIO - ESTO BORRARÁ DATOS

-- 1. Eliminar tabla junction
DROP TABLE IF EXISTS botzilla.branch_configuration_multiplier_range CASCADE;

-- 2. Eliminar tabla de configuraciones
DROP TABLE IF EXISTS botzilla.branch_configuration CASCADE;

-- 3. Renombrar multiplier_range de vuelta (si quieres)
ALTER TABLE botzilla.multiplier_range RENAME TO branch_multiplier_config;

-- 4. Eliminar columnas agregadas a branch
ALTER TABLE botzilla.branch DROP COLUMN IF EXISTS branch_configuration_id;
ALTER TABLE botzilla.branch DROP COLUMN IF EXISTS attic_tech_branch_id;
```

---

## 📊 Monitoreo Post-Deploy

### Verificar Logs del Backend

```bash
# Ver últimas 100 líneas
pm2 logs botzilla-api --lines 100

# Buscar errores
pm2 logs botzilla-api --err
```

### Verificar Endpoint de Sync

```bash
# Test rápido
curl -X GET "https://yallaprojects.com/api/automations/multiplier-ranges-sync?all=true" \
  -H "x-api-key: YOUR_API_KEY" \
  | jq '.summary'
```

---

## ✅ Checklist de Deploy

- [ ] Código pusheado a producción
- [ ] Migración SQL ejecutada sin errores
- [ ] Tablas verificadas en base de datos
- [ ] Backend reiniciado correctamente
- [ ] Endpoint de sync ejecutado exitosamente
- [ ] Datos verificados en base de datos
- [ ] Logs del backend sin errores
- [ ] Prueba manual del flujo completo

---

## 📞 Contacto

Si algo falla durante el deploy, verifica:
1. Logs del backend para errores de código
2. Logs de PostgreSQL para errores de BD
3. Respuesta del endpoint de sync para errores de API

---

## 🎯 Próximos Pasos (Después del Deploy)

Una vez que todo esté funcionando:
1. Implementar cálculo de precios usando los multiplier ranges
2. Aplicar finance_factors según método de pago
3. Usar baseConstants en cálculos de estimates

