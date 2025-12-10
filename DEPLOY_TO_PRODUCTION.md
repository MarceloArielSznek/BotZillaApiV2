# 🚀 Despliegue a Producción - BotZilla API V2

## 📋 Resumen Ejecutivo

Este documento contiene las instrucciones completas para desplegar todos los cambios desarrollados en los últimos 4 días:

- ✅ Sistema de Payment Methods (Cash, Credit, Financing, Check)
- ✅ Branch Configuration + Multiplier Ranges (many-to-many)
- ✅ Washington State Tax Calculation (50+ ZIP codes)
- ✅ Snapshot Multiplier Ranges (datos históricos de pricing)
- ✅ **Sistema Completo de Follow-Up Tickets** (statuses, labels, chat, asignaciones)
- ✅ Exportador Mailchimp mejorado (con filtros de fecha y estado)
- ✅ Effective Multiplier (multiplier real después de descuentos)

---

## 🎯 Prerequisitos

- [x] Acceso SSH al servidor de producción
- [x] Acceso a la base de datos de producción
- [x] Backup completo de la base de datos
- [x] Git pull del repositorio en producción

---

## 📦 PASO 1: Pull del Código en Producción

```bash
# Conectarse al servidor de producción
ssh user@production-server

# Ir al directorio del proyecto
cd /path/to/BotZillaApiV2

# Pull del código más reciente
git pull origin master

# Verificar que estés en el commit correcto
git log --oneline -5
# Deberías ver: 3ad7140 fix: Corregir aliases de asociaciones...
# Y antes: 8a0e65f feat: Complete Follow-Up System for Lost Estimates...
```

---

## 🗄️ PASO 2: Backup de la Base de Datos

**⚠️ CRÍTICO: NO CONTINUAR SIN BACKUP**

```bash
# Backup completo de la base de datos
pg_dump -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -F c -b -v \
  -f backup_before_followup_system_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el backup se creó correctamente
ls -lh backup_*.dump
```

**Guardar este archivo en un lugar seguro fuera del servidor.**

---

## 🔧 PASO 3: Ejecutar Migración SQL

### 3.1 Conectarse a la Base de Datos

```bash
# Opción 1: Via psql
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME>

# Opción 2: Via cliente SQL (DBeaver, pgAdmin, etc.)
```

### 3.2 Ejecutar el Script de Migración

El script está en: `backend/src/migrations/PROD_MIGRATION_MASTER_COMPLETE.sql`

**Opción A: Desde el servidor**
```bash
cd backend/src/migrations
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> -f PROD_MIGRATION_MASTER_COMPLETE.sql
```

**Opción B: Copiar y pegar en cliente SQL**
1. Abrir el archivo `PROD_MIGRATION_MASTER_COMPLETE.sql`
2. Copiar todo el contenido
3. Pegarlo en tu cliente SQL
4. Ejecutar

### 3.3 Verificar que la Migración fue Exitosa

Deberías ver mensajes como:
```sql
✅ Payment Methods table created
✅ Branch Configuration tables created
✅ WA Tax Rates table created
✅ Estimate table updated with new columns
✅ Follow-Up System tables created
🎉 Migration completed successfully!
```

---

## 📊 PASO 4: Verificación Post-Migración

Ejecutar las siguientes consultas para verificar:

```sql
-- 1. Verificar nuevas tablas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'payment_method',
    'branch_configuration',
    'multiplier_range',
    'branch_multiplier_config',
    'wa_tax_rate',
    'follow_up_ticket',
    'follow_up_status',
    'follow_up_label',
    'chat',
    'chat_message'
);
-- Debería retornar 10 tablas

-- 2. Verificar nuevas columnas en estimate
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'estimate' 
AND column_name IN (
    'payment_method_id',
    'snapshot_multiplier_ranges',
    'sub_services_retail_cost',
    'wa_tax_rate',
    'wa_tax_amount',
    'follow_up_ticket_id'
);
-- Debería retornar 6 columnas

-- 3. Verificar datos iniciales (Payment Methods)
SELECT * FROM payment_method ORDER BY id;
-- Debería retornar: Cash, Credit, Financing, Check

-- 4. Verificar datos iniciales (Follow-Up Statuses)
SELECT * FROM follow_up_status ORDER BY id;
-- Debería retornar: Lost, Sold, Negotiating

-- 5. Verificar datos iniciales (Follow-Up Labels)
SELECT * FROM follow_up_label ORDER BY id;
-- Debería retornar: PMP, Discount, Other

-- 6. Verificar WA Tax Rates (debe haber ~50 registros)
SELECT COUNT(*) as total_zip_codes FROM wa_tax_rate;
-- Debería retornar: total_zip_codes | 52
```

---

## 🔄 PASO 5: Instalar Dependencias (si es necesario)

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 🚀 PASO 6: Reiniciar Servicios

### 6.1 Reiniciar Backend

```bash
# Si usas PM2
pm2 restart botzilla-api

# Si usas systemd
sudo systemctl restart botzilla-api

# Verificar logs
pm2 logs botzilla-api
# O
journalctl -u botzilla-api -f
```

### 6.2 Reiniciar Frontend (si aplica)

```bash
# Si usas PM2
pm2 restart botzilla-frontend

# Si usas nginx (recompilar y reiniciar)
cd frontend
npm run build
sudo systemctl restart nginx
```

---

## ✅ PASO 7: Verificaciones Funcionales

### 7.1 Verificar API Backend

```bash
# Health check
curl http://localhost:3000/health

# Verificar endpoints nuevos
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/follow-up-tickets/statuses

curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/branch-configurations
```

### 7.2 Verificar Frontend

1. **Navegar a** `/dashboard/estimates`
   - ✅ Verificar que Branch, Salesperson y Status se muestren correctamente (no "N/A")
   - ✅ Verificar filtros funcionan

2. **Navegar a** `/follow-up/estimates`
   - ✅ Verificar que se muestren solo estimates "Lost"
   - ✅ Verificar columna "Details" muestra Effective Multiplier cuando aplica
   - ✅ Click en ícono de ticket (💬) abre modal de Follow-Up Ticket

3. **Abrir Modal de Follow-Up Ticket**
   - ✅ Puede seleccionar Status (Lost, Sold, Negotiating)
   - ✅ Puede seleccionar Label (PMP, Discount, Other)
   - ✅ Puede escribir y enviar mensajes en el chat
   - ✅ Se guarda correctamente al hacer clic en "Save"

4. **Probar Exportador Mailchimp**
   - ✅ Click en "Export to Mailchimp"
   - ✅ Seleccionar rango de fechas
   - ✅ Seleccionar estados (por defecto "Lost" pre-seleccionado)
   - ✅ Descargar Excel y verificar columna "Status"

5. **Verificar Branch Configuration**
   - ✅ Navegar a `/dashboard/branch-configuration` (si existe en menú)
   - ✅ Verificar que se pueden ver/editar multiplier ranges

---

## 🔄 PASO 8: Sincronizar Datos de Attic Tech

Esto es importante para:
- Traer los últimos estimates de Attic Tech
- Crear automáticamente Follow-Up Tickets para estimates "Lost"
- Actualizar snapshots de multiplier ranges

```bash
# Opción 1: Via Frontend (Recomendado)
# 1. Ir a /dashboard/estimates
# 2. Click en "Sync with Attic Tech"
# 3. Seleccionar rango de fechas (ej: últimos 30 días)
# 4. Click "Sync"

# Opción 2: Via Make.com (si ya está configurado)
# Ejecutar el escenario de sincronización desde Make.com

# Opción 3: Via API directamente
curl -X POST http://localhost:3000/api/automations/estimates/sync-external \
  -H "Authorization: Bearer <AUTOMATION_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2025-11-01",
    "endDate": "2025-11-24"
  }'
```

---

## 🧪 PASO 9: Testing Post-Deploy

### Test Checklist

- [ ] **Estimates Table**: Se muestran correctamente Branch, Salesperson, Status
- [ ] **Follow-Up Estimates**: Solo muestra estimates "Lost"
- [ ] **Follow-Up Tickets**: Se crean automáticamente para estimates Lost
- [ ] **Modal de Ticket**: Se puede editar status, label y chat
- [ ] **Mailchimp Export**: Descarga Excel con columna Status
- [ ] **Search**: Búsqueda por nombre funciona correctamente
- [ ] **Filtros**: Filtros por Branch, Salesperson, Status funcionan
- [ ] **Paginación**: Navegación entre páginas funciona
- [ ] **Effective Multiplier**: Se calcula y muestra correctamente
- [ ] **Payment Methods**: Se asocian correctamente a estimates

---

## 📊 PASO 10: Monitoreo Post-Deploy

### Logs a Monitorear

```bash
# Backend logs
pm2 logs botzilla-api --lines 100

# Errores específicos
pm2 logs botzilla-api --err

# Frontend logs (si aplica)
pm2 logs botzilla-frontend

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Métricas Clave

- **Response Time**: API debe responder < 500ms
- **Error Rate**: Debe ser < 1%
- **Database Connections**: Monitorear que no haya leaks
- **Memory Usage**: Backend debe mantenerse estable

---

## 🆘 Troubleshooting

### Problema 1: "Column does not exist"

**Síntoma**: Error en logs tipo `column "payment_method_id" does not exist`

**Solución**:
```sql
-- Verificar que la migración se ejecutó completamente
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'estimate' AND column_name LIKE '%payment%';

-- Si no existe, volver a ejecutar la migración
```

### Problema 2: "N/A" en columnas de Estimates

**Síntoma**: Branch, Salesperson o Status muestran "N/A"

**Solución**:
1. Verificar que el backend se reinició después del deploy
2. Verificar en logs si hay errores de Sequelize
3. Hard refresh del frontend (Cmd+Shift+R)

### Problema 3: Follow-Up Tickets no se crean

**Síntoma**: Estimates Lost no tienen ticket asociado

**Solución**:
```bash
# Ejecutar sync de estimates nuevamente
# Esto creará automáticamente tickets para Lost estimates sin ticket
```

### Problema 4: Error de permisos en Base de Datos

**Síntoma**: `permission denied for table XXX`

**Solución**:
```sql
-- Otorgar permisos al usuario de la aplicación
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO <db_user>;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO <db_user>;
```

---

## 🔙 Rollback (Si algo sale mal)

### Opción 1: Rollback de Base de Datos

```bash
# Restaurar desde backup
pg_restore -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -c -v backup_before_followup_system_YYYYMMDD_HHMMSS.dump
```

### Opción 2: Rollback de Código

```bash
# Volver al commit anterior
git log --oneline -10  # Ver commits
git reset --hard <commit_anterior>
git push origin master --force  # ⚠️ Solo si es necesario

# Reiniciar servicios
pm2 restart all
```

### Script SQL de Rollback Completo

Si necesitas revertir TODAS las tablas y columnas nuevas:

```sql
-- Ver archivo: backend/src/migrations/ROLLBACK_COMPLETE.sql
-- (Ejecutar solo en caso de emergencia)
```

---

## 📞 Soporte

Si encuentras algún problema durante el deploy:

1. **Revisar logs**: `pm2 logs` o `journalctl`
2. **Verificar base de datos**: Ejecutar queries de verificación del PASO 4
3. **Contactar al equipo**: Con screenshots de errores y logs relevantes

---

## 📚 Documentación Adicional

- `PROD_MIGRATION_MASTER_INSTRUCTIONS.md` - Detalles de la migración SQL
- `EFFECTIVE_MULTIPLIER_GUIDE.md` - Guía del Effective Multiplier
- `ESTIMATE_COST_BREAKDOWN_ANALYSIS.md` - Análisis de costos
- `MAILCHIMP_EXPORT_FEATURE.md` - Feature del exportador
- `backend/WASHINGTON_TAXES_SETUP.md` - Setup de impuestos WA

---

## ✅ Checklist Final

Antes de considerar el deploy completo:

- [ ] Backup de base de datos realizado y verificado
- [ ] Migración SQL ejecutada exitosamente
- [ ] 10 nuevas tablas creadas
- [ ] 6 nuevas columnas en `estimate`
- [ ] Datos iniciales cargados (payment methods, statuses, labels, WA taxes)
- [ ] Backend reiniciado
- [ ] Frontend reconstruido y reiniciado
- [ ] Estimates table muestra datos correctamente (no "N/A")
- [ ] Follow-Up Estimates funciona y muestra solo Lost
- [ ] Modal de Follow-Up Ticket funciona completamente
- [ ] Mailchimp export descarga Excel con columna Status
- [ ] Sync de Attic Tech ejecutado y crea tickets automáticamente
- [ ] Logs sin errores críticos
- [ ] Equipo notificado del deploy exitoso

---

## 🎉 Deploy Completado

Una vez que todos los checkpoints estén ✅, el deploy está completo.

**Fecha de Deploy**: ___________  
**Deploy realizado por**: ___________  
**Commit**: `3ad7140` (fix aliases) + `8a0e65f` (follow-up system)  
**Tiempo total**: ~______ minutos

---

**¡Felicidades! El sistema de Follow-Up está en producción** 🚀





