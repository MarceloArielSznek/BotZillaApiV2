# 🚀 PLAN DE DEPLOYMENT A PRODUCCIÓN
## BotZilla V2 - Employee Onboarding & Job Sync System

**Fecha:** 2025-10-14  
**Responsable:** Marce  
**Duración estimada:** 15-20 minutos  
**Downtime requerido:** No (rolling deployment)

---

## 📦 RESUMEN DE CAMBIOS

### **1. Sistema de Employee Onboarding**
- Sincronización con Attic Tech (usuarios AT → Employee)
- Flujo de registro simplificado para empleados AT
- Dashboard de onboarding con estadísticas
- Activación de employees (pending → active → crew/sales)
- Recordatorios de registro por email
- **Sincronización de registros legacy** (sales_person/crew_member antiguos)

### **2. Sistema de Job Sync**
- Sincronización automática de jobs desde Attic Tech
- Detección de cambios de estado
- Notificaciones a Crew Leaders cuando se les asigna un job
- Notificaciones a Operation Managers para nuevos jobs
- Campo de status en tabla de Jobs
- Vista de estimate dentro del Job Details Modal

### **3. Mejoras Generales**
- Nuevos middlewares de autenticación flexible (JWT + API Key)
- Nuevos roles: Operation Manager
- Mejoras en validaciones del modelo Employee
- Cleanup de código legacy

---

## 🗄️ MIGRACIONES DE BASE DE DATOS (CRÍTICAS)

### **Migración 1: Operation Manager Role**
**Archivo:** `backend/src/migrations/add_operation_manager_role.sql`

```sql
-- Agregar rol "operation manager"
INSERT INTO botzilla.user_rol (name) 
VALUES ('operation manager')
ON CONFLICT (name) DO NOTHING;
```

### **Migración 2: Attic Tech User ID en Employee**
**Archivo:** `backend/src/migrations/add_attic_tech_user_id_to_employee.sql`

```sql
-- Agregar columna para vincular con usuarios de Attic Tech
ALTER TABLE botzilla.employee 
ADD COLUMN IF NOT EXISTS attic_tech_user_id INTEGER UNIQUE;

CREATE INDEX IF NOT EXISTS idx_employee_attic_tech_user_id 
ON botzilla.employee(attic_tech_user_id);
```

### **Migración 3: Sync Fields en Job**
**Archivo:** `backend/src/migrations/add_sync_fields_to_job.sql`

```sql
-- Agregar campos para sincronización con Attic Tech
ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS attic_tech_job_id INTEGER UNIQUE,
ADD COLUMN IF NOT EXISTS attic_tech_estimate_id INTEGER,
ADD COLUMN IF NOT EXISTS last_known_status_id INTEGER REFERENCES botzilla.job_status(id),
ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS last_notification_sent_at TIMESTAMP;

-- Asegurar que notification_sent existe y tiene default
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

-- Crear índices
CREATE INDEX IF NOT EXISTS idx_job_attic_tech_job_id ON botzilla.job(attic_tech_job_id);
CREATE INDEX IF NOT EXISTS idx_job_attic_tech_estimate_id ON botzilla.job(attic_tech_estimate_id);
CREATE INDEX IF NOT EXISTS idx_job_last_synced_at ON botzilla.job(last_synced_at);
CREATE INDEX IF NOT EXISTS idx_job_last_known_status_id ON botzilla.job(last_known_status_id);
CREATE INDEX IF NOT EXISTS idx_job_notification_sent ON botzilla.job(notification_sent);

-- Insertar los 9 estados oficiales de Attic Tech (si no existen)
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

---

## 📝 ORDEN DE DEPLOYMENT

### **PASO 1: Backup de Base de Datos** ⚠️
```bash
# En servidor de producción
pg_dump -U postgres -d botzilla_production > backup_pre_deployment_$(date +%Y%m%d_%H%M%S).sql
```

### **PASO 2: Ejecutar Migraciones SQL**
```bash
# En servidor de producción
psql -U postgres -d botzilla_production -f backend/src/migrations/add_operation_manager_role.sql
psql -U postgres -d botzilla_production -f backend/src/migrations/add_attic_tech_user_id_to_employee.sql
psql -U postgres -d botzilla_production -f backend/src/migrations/add_sync_fields_to_job.sql
```

### **PASO 3: Commit de Cambios**
```bash
# En dev
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2

# Agregar archivos modificados
git add backend/src/app.js
git add backend/src/controllers/automations.controller.js
git add backend/src/controllers/employee.controller.js
git add backend/src/controllers/employeeRegistration.controller.js
git add backend/src/controllers/jobs.controller.js
git add backend/src/models/Employee.js
git add backend/src/models/Job.js
git add backend/src/routes/employees.routes.js
git add backend/src/services/makeWebhook.service.js

# Agregar nuevos archivos
git add backend/src/controllers/atticTechSync.controller.js
git add backend/src/controllers/atticTechUser.controller.js
git add backend/src/controllers/jobSync.controller.js
git add backend/src/middleware/auth.flexible.middleware.js
git add backend/src/migrations/*.sql
git add backend/src/routes/atticTechSync.routes.js
git add backend/src/routes/atticTechUser.routes.js
git add backend/src/routes/jobStatus.routes.js
git add backend/src/routes/jobSync.routes.js

# Frontend
git add frontend/src/components/employees/AwaitingRegistrationTable.tsx
git add frontend/src/components/employees/OnboardingDashboard.tsx
git add frontend/src/components/employees/OnboardingTab.tsx
git add frontend/src/components/jobs/JobDetailsModal.tsx
git add frontend/src/pages/EmployeeRegistration.tsx
git add frontend/src/pages/Jobs.tsx
git add frontend/src/services/atticTechSyncService.ts
git add frontend/src/services/atticTechUserService.ts
git add frontend/src/services/employeeService.ts
git add frontend/src/services/jobService.ts
git add frontend/src/services/statusService.ts

# Commit
git commit -m "feat: Employee Onboarding & Job Sync System

- Employee onboarding flow with Attic Tech sync
- Registration simplification for AT employees
- Legacy records synchronization (sales_person/crew_member)
- Job sync system with status change detection
- Notifications for Crew Leaders and Operation Managers
- Job status column in Jobs view
- Estimate details tab in Job modal
- Database migrations for new fields and indexes"

# Push
git push origin master
```

### **PASO 4: Deploy Backend**
```bash
# En servidor de producción
cd /path/to/BotZillaApiV2
git pull origin master
cd backend
npm install
pm2 restart botzilla-api
```

### **PASO 5: Deploy Frontend**
```bash
# En servidor de producción
cd /path/to/BotZillaApiV2/frontend
npm install
npm run build
# Copiar build a nginx o servidor web
```

### **PASO 6: Variables de Entorno**
Asegúrate de que estas variables estén configuradas en producción:

```bash
# Backend (.env)
AUTOMATION_API_KEY=<tu_api_key_segura>  # Para Make.com webhooks
FRONTEND_URL=https://tu-dominio.com     # Para links de registro
```

### **PASO 7: Configurar Make.com**
1. **Crear escenario para Job Sync:**
   - Trigger: HTTP Webhook o Schedule (cada 30 min)
   - Action: POST a `https://api.tu-dominio.com/api/job-sync/sync-jobs`
   - Headers: `X-API-Key: <AUTOMATION_API_KEY>`

2. **Crear escenario para Attic Tech User Sync:**
   - Trigger: Manual o Schedule (diario)
   - Action: POST a `https://api.tu-dominio.com/api/attic-tech-sync/sync-users`
   - Headers: `Authorization: Bearer <JWT_TOKEN>`

3. **Actualizar webhook de notificaciones:**
   - Debe recibir el payload de `job-sync` con `telegram_id`s
   - Enviar mensajes a Telegram Bot

---

## 🧪 TESTING POST-DEPLOYMENT

### **Test 1: Employee Registration (AT Users)**
1. Ir a `/dashboard/on-boarding`
2. Click en "Sync with Attic Tech"
3. Verificar que aparezcan empleados en "Awaiting Registration"
4. Ir a `/employee-registration`
5. Activar toggle "Already registered in Attic Tech?"
6. Buscar un email AT (ej: `agutierrez@atticprojects-oc.com`)
7. Completar formulario y enviar
8. Verificar que aparezca en "Pending Employees Onboarding"

### **Test 2: Legacy Sync**
1. Ir a `/dashboard/on-boarding`
2. Click en "Sync Legacy"
3. Verificar logs: debe mostrar cuántos fueron vinculados
4. Verificar que "Awaiting Registration" disminuya

### **Test 3: Job Sync**
1. Ejecutar el webhook de Make.com manualmente
2. Verificar logs del backend
3. Ir a `/dashboard/jobs`
4. Verificar que aparezcan jobs sincronizados
5. Verificar columna "Status"

### **Test 4: Job Details Modal**
1. Click en un job
2. Verificar que abra el modal
3. Click en tab "Estimate"
4. Verificar que muestre detalles del estimate

### **Test 5: Notifications (Operation Manager)**
1. Crear un usuario con rol "operation manager" en una branch
2. Crear un nuevo job en AT con status "Requires Crew Lead"
3. Ejecutar job sync
4. Verificar que el Operation Manager reciba notificación

### **Test 6: Notifications (Crew Leader)**
1. Tener un job en "Requires Crew Lead"
2. Asignarle un Crew Leader en AT (cambio a "Plans In Progress")
3. Ejecutar job sync
4. Verificar que el Crew Leader reciba notificación

---

## 🔄 ROLLBACK PLAN (SI ALGO FALLA)

### **Opción 1: Rollback de Código**
```bash
# Backend
cd /path/to/BotZillaApiV2/backend
git reset --hard HEAD~1
pm2 restart botzilla-api

# Frontend
cd /path/to/BotZillaApiV2/frontend
git reset --hard HEAD~1
npm run build
```

### **Opción 2: Restaurar Base de Datos**
```bash
psql -U postgres -d botzilla_production < backup_pre_deployment_TIMESTAMP.sql
```

### **Opción 3: Rollback Solo Migraciones (menos disruptivo)**
```sql
-- Revertir add_sync_fields_to_job.sql
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS attic_tech_job_id;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS attic_tech_estimate_id;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_known_status_id;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_synced_at;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS last_notification_sent_at;
DROP INDEX IF EXISTS idx_job_attic_tech_job_id;
DROP INDEX IF EXISTS idx_job_attic_tech_estimate_id;
DROP INDEX IF EXISTS idx_job_last_synced_at;
DROP INDEX IF EXISTS idx_job_last_known_status_id;
DROP INDEX IF EXISTS idx_job_notification_sent;

-- Revertir add_attic_tech_user_id_to_employee.sql
ALTER TABLE botzilla.employee DROP COLUMN IF EXISTS attic_tech_user_id;
DROP INDEX IF EXISTS idx_employee_attic_tech_user_id;

-- Revertir add_operation_manager_role.sql
DELETE FROM botzilla.user_rol WHERE name = 'operation manager';
```

---

## ⚠️ PUNTOS CRÍTICOS A VERIFICAR

1. **Telegram Bot Token:** Asegúrate de que Make.com tenga acceso al bot
2. **API Key de Make.com:** Debe estar configurada en `.env` de producción
3. **CORS:** Asegúrate de que el frontend pueda llamar al backend
4. **SSL:** Certificados válidos para webhooks
5. **Job Statuses:** Verificar que los 9 estados estén en la BD antes del primer sync
6. **Operation Manager:** Al menos un usuario debe tener este rol asignado

---

## 📊 MONITOREO POST-DEPLOYMENT

### **Logs a revistar:**
```bash
# Backend logs
pm2 logs botzilla-api

# Buscar errores específicos
pm2 logs botzilla-api --lines 100 | grep ERROR

# Monitorear job sync
pm2 logs botzilla-api | grep "job sync"
```

### **Endpoints a monitorear:**
- `GET /api/employees/pending` - Debe responder 200
- `GET /api/attic-tech-sync/stats` - Debe devolver estadísticas
- `POST /api/job-sync/sync-jobs` - Debe sincronizar sin errores
- `GET /api/job-statuses` - Debe listar 9 estados

### **Base de datos:**
```sql
-- Verificar registros sincronizados
SELECT COUNT(*) FROM botzilla.employee WHERE attic_tech_user_id IS NOT NULL;
SELECT COUNT(*) FROM botzilla.job WHERE attic_tech_job_id IS NOT NULL;

-- Verificar employees pending
SELECT status, COUNT(*) FROM botzilla.employee GROUP BY status;

-- Verificar notificaciones enviadas
SELECT COUNT(*) FROM botzilla.job WHERE notification_sent = true;
```

---

## ✅ CHECKLIST FINAL

- [ ] Backup de BD completado
- [ ] Migraciones SQL ejecutadas sin errores
- [ ] Código pusheado a master
- [ ] Backend deployado y reiniciado
- [ ] Frontend buildado y deployado
- [ ] Variables de entorno configuradas
- [ ] Make.com webhooks configurados
- [ ] Test 1: Employee Registration (AT Users) ✓
- [ ] Test 2: Legacy Sync ✓
- [ ] Test 3: Job Sync ✓
- [ ] Test 4: Job Details Modal ✓
- [ ] Test 5: Notifications (Operation Manager) ✓
- [ ] Test 6: Notifications (Crew Leader) ✓
- [ ] Logs revisados (sin errores críticos)
- [ ] Monitoreo activo primeras 24h

---

## 📞 CONTACTOS DE EMERGENCIA

- **Developer:** Marce
- **Make.com Support:** [support link]
- **Hosting Provider:** [provider info]

---

**¡IMPORTANTE!** 🚨  
Haz el deployment en horario de bajo tráfico (ej: tarde/noche).  
Mantén el backup de BD por al menos 7 días.

