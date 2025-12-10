# 🚀 Instrucciones de Deploy a Producción - RESUMEN RÁPIDO

## ⚡ Pasos Principales (30-45 minutos)

### 1️⃣ BACKUP (5 min) ⚠️ **CRÍTICO**
```bash
pg_dump -h <HOST> -U <USER> -d <DB> -F c -b -v \
  -f backup_$(date +%Y%m%d_%H%M%S).dump
```

### 2️⃣ PULL DEL CÓDIGO (2 min)
```bash
cd /path/to/BotZillaApiV2
git pull origin master
# Verificar commit: 3ad7140 (fix aliases) + 8a0e65f (follow-up system)
```

### 3️⃣ MIGRACIÓN SQL (5 min)
```bash
cd backend/src/migrations
psql -h <HOST> -U <USER> -d <DB> -f PROD_MIGRATION_MASTER_COMPLETE.sql
```

**Verificar que termine con**: `🎉 Migration completed successfully!`

### 4️⃣ VERIFICAR BASE DE DATOS (3 min)
```sql
-- Debe retornar 10 tablas nuevas
SELECT table_name FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'payment_method', 'branch_configuration', 'multiplier_range',
    'branch_multiplier_config', 'wa_tax_rate', 'follow_up_ticket',
    'follow_up_status', 'follow_up_label', 'chat', 'chat_message'
);

-- Debe retornar 6 columnas nuevas
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'estimate' 
AND column_name IN (
    'payment_method_id', 'snapshot_multiplier_ranges',
    'sub_services_retail_cost', 'wa_tax_rate',
    'wa_tax_amount', 'follow_up_ticket_id'
);
```

### 5️⃣ INSTALAR DEPENDENCIAS (5 min)
```bash
cd backend && npm install
cd ../frontend && npm install
```

### 6️⃣ REINICIAR SERVICIOS (5 min)
```bash
# Backend
pm2 restart botzilla-api
pm2 logs botzilla-api --lines 50

# Frontend (si aplica)
cd frontend && npm run build
pm2 restart botzilla-frontend
# O si usas nginx:
sudo systemctl restart nginx
```

### 7️⃣ VERIFICAR FRONTEND (10 min)

**Test 1: Dashboard Estimates** → `/dashboard/estimates`
- ✅ Branch, Salesperson, Status se ven (no "N/A")
- ✅ Filtros funcionan
- ✅ Búsqueda funciona

**Test 2: Follow-Up** → `/follow-up/estimates`
- ✅ Solo muestra estimates "Lost"
- ✅ Botón de ticket (💬) abre modal
- ✅ Modal permite cambiar Status, Label
- ✅ Chat funciona

**Test 3: Mailchimp Export**
- ✅ Exporta con columna "Status"
- ✅ Filtros de fecha y estado funcionan

### 8️⃣ SINCRONIZAR DATOS (5 min)
```bash
# Opción 1: Desde frontend
# Ir a /dashboard/estimates → "Sync with Attic Tech"
# Seleccionar últimos 30 días → Click "Sync"

# Opción 2: Ejecutar escenario en Make.com
```

Esto creará automáticamente Follow-Up Tickets para todos los estimates "Lost".

---

## 🆘 Rollback (Si algo falla)

### Rollback de Base de Datos
```bash
pg_restore -h <HOST> -U <USER> -d <DB> -c -v backup_YYYYMMDD_HHMMSS.dump
```

### Rollback de Código
```bash
git reset --hard <commit_anterior>
pm2 restart all
```

### Rollback Manual de SQL
```bash
psql -h <HOST> -U <USER> -d <DB> -f backend/src/migrations/ROLLBACK_COMPLETE.sql
```

---

## ✅ Checklist Mínimo

- [ ] Backup realizado y verificado
- [ ] Migración SQL ejecutada sin errores
- [ ] 10 tablas nuevas + 6 columnas nuevas verificadas
- [ ] Backend reiniciado sin errores en logs
- [ ] Frontend funciona (estimates no muestran "N/A")
- [ ] Follow-Up modal funciona
- [ ] Mailchimp export funciona
- [ ] Sync ejecutado y crea tickets automáticamente

---

## 📚 Documentación Completa

Para más detalles, ver: `DEPLOY_TO_PRODUCTION.md`

---

## 🎯 ¿Qué se deployó?

### Base de Datos (10 tablas nuevas)
1. `payment_method` - Cash, Credit, Financing, Check
2. `branch_configuration` - Configuración por branch
3. `multiplier_range` - Rangos de multiplicadores
4. `branch_multiplier_config` - Relación many-to-many
5. `wa_tax_rate` - 52 códigos postales de Washington
6. `follow_up_ticket` - Tickets de seguimiento
7. `follow_up_status` - Lost, Sold, Negotiating
8. `follow_up_label` - PMP, Discount, Other
9. `chat` - Conversaciones
10. `chat_message` - Mensajes individuales

### Backend (3 controllers nuevos, 3 routes nuevos)
- `branchConfiguration.controller.js` + routes
- `followUpTickets.controller.js` + routes
- `estimates.controller.js` (modificado)
- `automations.controller.js` (modificado - auto-crea tickets)

### Frontend (3 páginas/componentes nuevos)
- `FollowUpEstimates.tsx` (página dedicada)
- `FollowUpTicketModal.tsx` (modal de tickets)
- `MailchimpExportModal.tsx` (exportador mejorado)
- `BranchConfiguration.tsx` (gestión de configuración)
- `EstimateDetailsModal.tsx` (mejorado con pricing breakdown)

### Features Nuevos
- ✨ Effective Multiplier (multiplier real después de descuentos)
- ✨ Payment Method tracking (Cash/Credit/Financing/Check)
- ✨ WA Tax calculation (automático por ZIP code)
- ✨ Snapshot de Multiplier Ranges (histórico de precios)
- ✨ Sistema completo de Follow-Up con chat integrado
- ✨ Auto-creación de tickets para Lost estimates
- ✨ Mailchimp export con filtros avanzados

---

## 📞 Contacto

Si tienes problemas:
1. Revisar logs: `pm2 logs botzilla-api`
2. Verificar base de datos con queries del PASO 4
3. Revisar `DEPLOY_TO_PRODUCTION.md` sección Troubleshooting

---

**Tiempo estimado total**: 30-45 minutos  
**Commits**: `3ad7140` + `8a0e65f`  
**Última actualización**: Noviembre 24, 2025





