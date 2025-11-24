# 🚀 Instrucciones para Agente de Producción - BotZilla API V2

## 📋 Resumen
Deploy del sistema completo de Follow-Up Tickets + mejoras varias.
**Tiempo estimado**: 30-45 minutos
**Riesgo**: Bajo (con backup)

---

## ⚠️ PASO 1: BACKUP (CRÍTICO - NO OMITIR)

```bash
# Crear backup completo de la base de datos
pg_dump -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -F c -b -v \
  -f backup_botzilla_$(date +%Y%m%d_%H%M%S).dump

# Verificar que el archivo se creó
ls -lh backup_botzilla_*.dump
```

**✅ Guardar este archivo en un lugar seguro fuera del servidor**

---

## 📥 PASO 2: Pull del Código

```bash
# Navegar al directorio del proyecto
cd /path/to/BotZillaApiV2

# Pull del código más reciente
git pull origin master

# Verificar que estás en el commit correcto
git log --oneline -3
```

**Deberías ver:**
```
fb06c61 docs: Agregar instrucciones completas de deploy a producción
3ad7140 fix: Corregir aliases de asociaciones en estimates controller
8a0e65f feat: Complete Follow-Up System for Lost Estimates (4 days work)
```

---

## 🗄️ PASO 3: Ejecutar Migración de Base de Datos

```bash
# Opción A: Desde terminal del servidor
cd backend/src/migrations
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -f PROD_MIGRATION_MASTER_COMPLETE.sql

# Opción B: Copiar contenido y ejecutar en cliente SQL
# Abrir el archivo PROD_MIGRATION_MASTER_COMPLETE.sql
# Copiar TODO el contenido
# Pegarlo en DBeaver/pgAdmin y ejecutar
```

**✅ Al finalizar DEBE mostrar:**
```
🎉 Migration completed successfully!
✅ 10 new tables created
✅ 6 new columns added to estimate
✅ Payment methods seeded (4 records)
✅ Follow-up statuses seeded (3 records)
✅ Follow-up labels seeded (3 records)
✅ WA tax rates seeded (52 ZIP codes)
```

**❌ Si hay algún error, detener aquí y reportar**

---

## ✅ PASO 4: Verificar Base de Datos

```sql
-- Verificar que se crearon las 10 tablas nuevas
SELECT COUNT(*) as tablas_nuevas 
FROM information_schema.tables 
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
-- Debe retornar: 10

-- Verificar que se agregaron las 6 columnas nuevas en estimate
SELECT COUNT(*) as columnas_nuevas
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
-- Debe retornar: 6

-- Verificar datos iniciales
SELECT 'Payment Methods' as tipo, COUNT(*) as cantidad FROM payment_method
UNION ALL
SELECT 'Follow-Up Statuses', COUNT(*) FROM follow_up_status
UNION ALL
SELECT 'Follow-Up Labels', COUNT(*) FROM follow_up_label
UNION ALL
SELECT 'WA Tax Rates', COUNT(*) FROM wa_tax_rate;
-- Debe retornar:
-- Payment Methods: 4
-- Follow-Up Statuses: 3
-- Follow-Up Labels: 3
-- WA Tax Rates: 52
```

**✅ Si todos los números coinciden, continuar**
**❌ Si faltan tablas/columnas, revisar logs de migración**

---

## 📦 PASO 5: Instalar Dependencias

```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

---

## 🔄 PASO 6: Reiniciar Servicios

### Backend

```bash
# Opción A: Si usas PM2
pm2 restart botzilla-api

# Ver logs para verificar que inició correctamente
pm2 logs botzilla-api --lines 50

# Opción B: Si usas systemd
sudo systemctl restart botzilla-api
journalctl -u botzilla-api -f -n 50
```

**✅ Verificar que NO hay errores en logs**
**❌ Si hay errores tipo "column does not exist", la migración falló**

### Frontend

```bash
# Opción A: Si frontend está separado con PM2
cd frontend
npm run build
pm2 restart botzilla-frontend

# Opción B: Si usas Nginx
cd frontend
npm run build
sudo systemctl restart nginx

# Opción C: Si frontend se sirve desde backend
# No hacer nada, solo el backend es suficiente
```

---

## 🧪 PASO 7: Testing (IMPORTANTE)

### Test 1: Dashboard Estimates (Principal)
1. Abrir navegador en `https://your-domain.com/dashboard/estimates`
2. **Verificar que se ven:**
   - ✅ Columna "Branch" muestra nombre del branch (NO "N/A")
   - ✅ Columna "Salesperson" muestra nombre del vendedor (NO "N/A")
   - ✅ Columna "Status" muestra estado del estimate (NO "N/A")
3. **Probar filtros:**
   - ✅ Filtro por Branch funciona
   - ✅ Filtro por Salesperson funciona
   - ✅ Filtro por Status funciona
   - ✅ Búsqueda por texto funciona

**❌ Si todavía muestra "N/A", el backend no reinició correctamente**

### Test 2: Follow-Up Estimates (Nuevo)
1. Abrir `https://your-domain.com/follow-up/estimates`
2. **Verificar que:**
   - ✅ Solo muestra estimates con status "Lost"
   - ✅ Hay un botón de ticket (💬) en la columna "Actions"
3. **Click en el botón de ticket:**
   - ✅ Abre modal "Follow-Up Ticket"
   - ✅ Puede seleccionar Status: Lost / Sold / Negotiating
   - ✅ Puede seleccionar Label: PMP / Discount / Other
   - ✅ Hay sección de Chat
4. **Escribir mensaje en chat y enviar:**
   - ✅ Mensaje aparece en el chat
5. **Click en "Save":**
   - ✅ Modal se cierra sin errores
6. **Reabrir el mismo ticket:**
   - ✅ Los cambios se guardaron (status, label, mensajes)

### Test 3: Mailchimp Export
1. En `/follow-up/estimates`, click en "Export to Mailchimp"
2. **Verificar modal:**
   - ✅ Hay dropdown de "Estimate Status"
   - ✅ "Lost" está pre-seleccionado
3. Seleccionar rango de fechas y exportar
4. **Verificar Excel descargado:**
   - ✅ Tiene columna "Status" con valores Lost/Sold/etc.

---

## 🔄 PASO 8: Sincronizar Datos (Crear Tickets)

Este paso crea automáticamente Follow-Up Tickets para todos los estimates "Lost" que no tengan ticket.

### Opción A: Desde el Frontend (Recomendado)
1. Ir a `/dashboard/estimates`
2. Click en botón verde "Sync with Attic Tech"
3. Seleccionar:
   - **From Date**: Hace 30 días
   - **To Date**: Hoy
4. Click "Sync"
5. Esperar que termine (puede tomar 2-5 minutos)
6. **Verificar mensaje:** "X estimates synced successfully"

### Opción B: Via Make.com
Si ya tienen un escenario configurado en Make.com:
1. Ir a Make.com
2. Ejecutar el escenario de "Sync Estimates"
3. Verificar que termine exitosamente

### Verificar que se crearon tickets:
```sql
-- Ver cuántos tickets se crearon
SELECT COUNT(*) as total_tickets FROM follow_up_ticket;

-- Ver tickets por status
SELECT 
    fs.name as status,
    COUNT(*) as cantidad
FROM follow_up_ticket ft
JOIN follow_up_status fs ON ft.status_id = fs.id
GROUP BY fs.name
ORDER BY cantidad DESC;
```

---

## ✅ CHECKLIST FINAL

Antes de considerar el deploy completo:

- [ ] ✅ Backup de BD realizado y guardado
- [ ] ✅ Git pull ejecutado (commit fb06c61)
- [ ] ✅ Migración SQL ejecutada sin errores
- [ ] ✅ 10 tablas nuevas verificadas
- [ ] ✅ 6 columnas nuevas en estimate verificadas
- [ ] ✅ Datos iniciales cargados (4+3+3+52 registros)
- [ ] ✅ Backend reiniciado sin errores en logs
- [ ] ✅ Frontend reconstruido (si aplica)
- [ ] ✅ Test 1: Dashboard estimates muestra datos (no "N/A")
- [ ] ✅ Test 2: Follow-up modal funciona completamente
- [ ] ✅ Test 3: Mailchimp export descarga con columna Status
- [ ] ✅ Sync ejecutado y creó tickets automáticamente
- [ ] ✅ No hay errores en logs del backend
- [ ] ✅ No hay errores en consola del navegador

---

## 🆘 PROBLEMAS COMUNES Y SOLUCIONES

### Problema 1: Todavía se ve "N/A" en columnas
**Solución:**
```bash
# Reiniciar backend nuevamente
pm2 restart botzilla-api
# Hard refresh en navegador: Cmd+Shift+R (Mac) o Ctrl+Shift+R (Windows)
```

### Problema 2: Error "column does not exist"
**Causa:** La migración SQL no se ejecutó completamente
**Solución:**
```bash
# Volver a ejecutar la migración (es idempotente)
psql -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -f backend/src/migrations/PROD_MIGRATION_MASTER_COMPLETE.sql
```

### Problema 3: Modal de ticket no abre
**Solución:**
```bash
# Verificar logs del backend
pm2 logs botzilla-api --err
# Verificar consola del navegador (F12)
```

### Problema 4: Sync falla
**Solución:**
```bash
# Verificar que las variables de entorno están configuradas
cat .env | grep ATTIC_TECH
# Debe tener: ATTIC_TECH_API_TOKEN y ATTIC_TECH_BASE_URL
```

---

## 🔙 ROLLBACK (Solo si algo sale MUY mal)

### Rollback Completo de Base de Datos
```bash
# Restaurar desde el backup
pg_restore -h <DB_HOST> -U <DB_USER> -d <DB_NAME> \
  -c -v backup_botzilla_YYYYMMDD_HHMMSS.dump

# Reiniciar servicios
pm2 restart all
```

### Rollback de Código
```bash
git reset --hard <commit_anterior>
pm2 restart all
```

**⚠️ Contactar al equipo de desarrollo antes de hacer rollback**

---

## 📞 CONTACTO DE SOPORTE

Si encuentras algún problema:

1. **Logs del backend**: `pm2 logs botzilla-api --lines 100`
2. **Logs de la base de datos**: Revisar output de la migración
3. **Consola del navegador**: F12 → Console (buscar errores en rojo)
4. **Reportar** con screenshots y logs

---

## 📊 QUÉ SE DEPLOYÓ (Para Referencia)

### Nuevas Funcionalidades
- ✨ Sistema completo de Follow-Up Tickets con chat
- ✨ Exportador Mailchimp mejorado con filtros de estado
- ✨ Tracking de Payment Methods (Cash/Credit/Financing/Check)
- ✨ Cálculo automático de impuestos de Washington
- ✨ Effective Multiplier (multiplier real después de descuentos)
- ✨ Branch Configuration con Multiplier Ranges
- ✨ Auto-creación de tickets para Lost estimates

### Tablas Nuevas (10)
1. `payment_method` - Métodos de pago
2. `branch_configuration` - Configuración por branch
3. `multiplier_range` - Rangos de multiplicadores
4. `branch_multiplier_config` - Relación many-to-many
5. `wa_tax_rate` - Tasas de impuestos de WA
6. `follow_up_ticket` - Tickets de seguimiento
7. `follow_up_status` - Lost/Sold/Negotiating
8. `follow_up_label` - PMP/Discount/Other
9. `chat` - Conversaciones
10. `chat_message` - Mensajes individuales

### Columnas Nuevas en `estimate` (6)
- `payment_method_id`
- `snapshot_multiplier_ranges`
- `sub_services_retail_cost`
- `wa_tax_rate`
- `wa_tax_amount`
- `follow_up_ticket_id`

---

**Fecha de Deploy**: _______________
**Ejecutado por**: _______________
**Tiempo total**: ___________ minutos
**Estado**: ✅ EXITOSO / ❌ REQUIERE ATENCIÓN

---

## ✅ FIRMA DE APROBACIÓN

Una vez completados todos los pasos y verificaciones:

**Agente de Producción**: _______________  
**Fecha/Hora**: _______________  
**Notas adicionales**: _______________

---

**Fin de las instrucciones** 🎉

