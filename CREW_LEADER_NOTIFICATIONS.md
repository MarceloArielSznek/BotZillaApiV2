# 🔔 Sistema de Notificaciones para Crew Leaders

## 🎯 Objetivo

Notificar automáticamente a los Crew Leaders cuando se les asigna un job, manejando dos escenarios:

1. ✅ **Crew Leader CON `telegram_id`** → Genera notificación (el sistema existente la envía cada 15 min)
2. ⚠️ **Crew Leader SIN `telegram_id`** → Alerta inmediata al admin para que le pida registrarse

---

## 📊 Flujo Completo

### Escenario 1: Estado cambia a "Plans In Progress"
```
Job en Attic Tech:
"Requires Crew Lead" → "Plans In Progress" + Crew Leader asignado
                ↓
        Job Sync se ejecuta (cada 15 min)
                ↓
    ┌───────────────────────────────┐
    │ ¿Crew Leader tiene telegram_id? │
    └───────────────────────────────┘
            /              \
        SÍ ✅            NO ⚠️
          ↓                ↓
   Genera          Webhook Alert
   Notificación    (inmediato)
          ↓                ↓
   Sistema         Email al Admin
   existente       (vía Make.com)
   la envía        
   (cada 15min)
```

### Escenario 2: Se asigna Crew Leader a job existente
```
Job ya en "Plans In Progress" (sin crew leader asignado)
                ↓
    Se asigna Crew Leader en Attic Tech
                ↓
        Job Sync detecta cambio
                ↓
    ┌───────────────────────────────┐
    │ ¿Crew Leader tiene telegram_id? │
    └───────────────────────────────┘
            /              \
        SÍ ✅            NO ⚠️
          ↓                ↓
   Genera          Webhook Alert
   Notificación    (inmediato)
          ↓                ↓
   Sistema         Email al Admin
   existente       (vía Make.com)
   la envía        
   (cada 15min)
```

---

## 🔧 Implementación Técnica

### 1. **Detección de Cambios que Requieren Notificación**

**Archivo:** `backend/src/controllers/jobSync.controller.js`

**Escenario 1: Cambio de Estado**
```javascript
// Líneas 358-381
if (statusChanged && 
    oldStatusName === 'Requires Crew Lead' && 
    newStatusName === 'Plans In Progress') {
    
    if (crewLeader) {
        shouldNotify = true;
        logger.info(`🔔 Escenario 1: Estado cambió a "Plans In Progress" con Crew Leader asignado`);
        
        // Verificar si tiene telegram_id
        if (!crewLeader.telegram_id) {
            // Enviar alerta de registro
            await makeWebhookService.sendCrewLeaderRegistrationAlert({
                crewLeaderId: crewLeader.id,
                crewLeaderName: crewLeader.name,
                crewLeaderEmail: crewLeader.email,
                jobName: atJob.name,
                branchName: branch?.name,
                registrationUrl: `${FRONTEND_URL}/employee-registration`
            });
        }
    }
}
```

**Escenario 2: Asignación de Crew Leader a Job Existente**
```javascript
// Líneas 383-407
const crewLeaderChanged = existingJob.crew_leader_id !== jobData.crew_leader_id;
const isPlansInProgress = newStatusName === 'Plans In Progress';
const hadNoCrewLeader = !existingJob.crew_leader_id;
const nowHasCrewLeader = !!crewLeader;

if (!shouldNotify && isPlansInProgress && crewLeaderChanged && 
    hadNoCrewLeader && nowHasCrewLeader) {
    
    shouldNotify = true;
    logger.info(`🔔 Escenario 2: Crew Leader asignado a job existente en "Plans In Progress"`);
    
    // Verificar si tiene telegram_id
    if (!crewLeader.telegram_id) {
        // Enviar alerta de registro
        await makeWebhookService.sendCrewLeaderRegistrationAlert({
            crewLeaderId: crewLeader.id,
            crewLeaderName: crewLeader.name,
            crewLeaderEmail: crewLeader.email,
            jobName: atJob.name,
            branchName: branch?.name,
            registrationUrl: `${FRONTEND_URL}/employee-registration`
        });
    }
}
```

### 2. **Generación de Notificación (Con `telegram_id`)**

**Archivo:** `backend/src/controllers/jobSync.controller.js`

```javascript
// Línea 386-395
if (shouldNotify && !existingJob.notification_sent && crewLeader && crewLeader.telegram_id) {
    const notification = await generateNotification(atJob, crewLeader, branch, estimate);
    
    // Agregar a la lista de notificaciones
    // El sistema existente (que se ejecuta cada 15 min) las procesará
    notifications.push(notification);
    
    logger.info(`📨 Notificación generada para Crew Leader: ${crewLeader.name}`);
}
```

**Nota:** El sistema existente de notificaciones (que se ejecuta cada 15 minutos) toma estas notificaciones y las envía al bot de Telegram.

---

## 🌐 Webhook de Make.com

### Webhook: Alerta de Crew Leader Sin Registro ⚠️

**Variable:** `MAKE_CREW_LEADER_ALERT_WEBHOOK_URL`

**Payload:**
```json
{
  "event": "crew_leader_needs_registration",
  "timestamp": "2025-10-16T15:30:00.000Z",
  "crew_leader": {
    "id": 123,
    "name": "Mike Reynolds",
    "email": "mreynolds@atticprojects-sd.com",
    "branch": "San Diego"
  },
  "job": {
    "name": "Job #12345 - San Diego Attic",
    "status": "Plans In Progress",
    "assigned_but_not_registered": true
  },
  "registration_url": "https://your-domain.com/employee-registration",
  "environment": "production"
}
```

**Flujo en Make.com:**
```
1. Webhook Receiver
   ↓
2. Email al Admin
   Subject: ⚠️ Crew Leader Needs Registration
   Body:
     Mike Reynolds has been assigned to job "Job #12345"
     but hasn't registered in the system yet.
     
     Please send them a registration link:
     https://your-domain.com/employee-registration
     
     Branch: San Diego
     Email: mreynolds@atticprojects-sd.com
```

---

## 📨 Sistema Existente de Notificaciones

**Para crew leaders CON `telegram_id`:**

El sistema **ya existente** que se ejecuta cada 15 minutos (`/api/job-sync/sync-jobs`) toma las notificaciones generadas y las envía al bot de Telegram automáticamente.

**No se necesita webhook adicional** para este caso, ya que el flujo actual funciona perfectamente.

---

## ⚙️ Configuración

### 1. Variables de Entorno (.env)

```bash
# Backend .env
MAKE_CREW_LEADER_ALERT_WEBHOOK_URL=https://hook.us1.make.com/your-alert-webhook
FRONTEND_URL=https://your-domain.com
```

### 2. Crear Webhook en Make.com

**Webhook de Alerta (Admin Email)**
```
1. Create scenario
2. Add "Custom Webhook" trigger
3. Copy URL → guardar en MAKE_CREW_LEADER_ALERT_WEBHOOK_URL
4. Add "Gmail: Send Email" module
   - To: admin@example.com
   - Subject: ⚠️ Crew Leader Needs Registration - {{crew_leader.name}}
   - Body: (ver template arriba)
5. Save & activate
```

### 3. Reiniciar Backend

```bash
pm2 restart botzilla-backend
```

---

## 🧪 Testing

### Test 1: Crew Leader SIN `telegram_id`

```bash
# 1. En Attic Tech:
#    - Asignar crew leader a un job
#    - Cambiar estado de "Requires Crew Lead" → "Plans In Progress"

# 2. Ejecutar sync
curl -X POST http://localhost:3000/api/job-sync/sync-jobs \
  -H "X-API-KEY: your-key"

# 3. Verificar logs
pm2 logs botzilla-backend | grep "Crew Leader registration alert"

# 4. Verificar email al admin
# Debería recibir email con:
# - Nombre del crew leader
# - Email
# - Job asignado
# - Link de registro
```

### Test 2: Crew Leader CON `telegram_id`

```bash
# 1. En Attic Tech:
#    - Asignar crew leader registrado a un job
#    - Cambiar estado a "Plans In Progress"

# 2. Ejecutar sync
curl -X POST http://localhost:3000/api/job-sync/sync-jobs \
  -H "X-API-KEY: your-key"

# 3. Verificar logs
pm2 logs botzilla-backend | grep "Notificación generada para Crew Leader"

# 4. Esperar hasta 15 minutos
# El sistema existente de notificaciones las procesará automáticamente
# El crew leader recibirá mensaje en Telegram con detalles del job
```

---

## 📋 Casos de Uso

### Caso 1: Nuevo Crew Leader (No Registrado)

```
1. Se asigna job a Mike Reynolds (no registrado)
2. Job sync detecta cambio de estado
3. Sistema verifica: telegram_id = null
4. Envía webhook de alerta
5. Admin recibe email
6. Admin contacta a Mike para que se registre
7. Mike se registra y captura telegram_id
8. Próximas asignaciones → notificación directa
```

### Caso 2: Crew Leader Activo (Registrado)

```
1. Se asigna job a John Smith (ya registrado)
2. Job sync detecta cambio de estado
3. Sistema verifica: telegram_id = "123456789"
4. Envía webhook de notificación
5. John recibe mensaje en Telegram
6. John hace click en el link
7. John ve detalles del job en Attic Tech
```

### Caso 3: Múltiples Jobs al Mismo Crew Leader

```
1. Se asignan 3 jobs a Mike el mismo día
2. Job sync ejecuta (cada hora o manualmente)
3. Sistema envía 3 notificaciones separadas
4. Mike recibe 3 mensajes en Telegram
5. Campo notification_sent evita duplicados
```

---

## 🔄 Job Sync Automatizado

### Opción 1: Cron Job

```bash
# Ejecutar cada hora
0 * * * * curl -X POST http://localhost:3000/api/job-sync/sync-jobs -H "X-API-KEY: your-key"
```

### Opción 2: Make.com Scheduler

```
1. Create scenario
2. Add "Scheduler" trigger (every 1 hour)
3. Add "HTTP: Make a Request"
   - URL: https://your-domain.com/api/job-sync/sync-jobs
   - Method: POST
   - Headers: X-API-KEY: your-key
4. Save & activate
```

### Opción 3: PM2 Cron

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'job-sync',
    script: './backend/scripts/jobSyncCron.js',
    cron_restart: '0 * * * *', // Cada hora
    autorestart: false
  }]
};
```

---

## 📊 Métricas y Logs

### Logs Importantes

```bash
# Ver alertas de registro
pm2 logs botzilla-backend | grep "Crew Leader registration alert"

# Ver notificaciones enviadas
pm2 logs botzilla-backend | grep "Crew leader job notification"

# Ver errores de webhook
pm2 logs botzilla-backend | grep "Error sending crew leader"
```

### Métricas en DB

```sql
-- Crew leaders sin telegram_id
SELECT COUNT(*) 
FROM botzilla.crew_member 
WHERE telegram_id IS NULL 
  AND is_leader = true;

-- Jobs con notificación pendiente
SELECT COUNT(*) 
FROM botzilla.job 
WHERE notification_sent = false 
  AND status_id = (SELECT id FROM botzilla.job_status WHERE name = 'Plans In Progress')
  AND crew_leader_id IS NOT NULL;

-- Notificaciones enviadas hoy
SELECT COUNT(*) 
FROM botzilla.job 
WHERE notification_sent = true 
  AND updated_at >= CURRENT_DATE;
```

---

## 🎯 Estado Actual

1. ✅ **COMPLETADO**: Detección automática de crew leaders asignados
2. ✅ **COMPLETADO**: Alerta inmediata cuando crew leader NO está registrado
3. ✅ **COMPLETADO**: Integración con sistema existente de notificaciones (cada 15 min)
4. 🔜 **Pendiente**: Dashboard de crew leaders pendientes de registro
5. 🔜 **Pendiente**: Métricas de tasa de registro de crew leaders

---

## 🐛 Troubleshooting

### Problema: Crew leader no recibe notificación

**Verificar:**
```bash
# 1. ¿Tiene telegram_id?
SELECT id, name, telegram_id FROM botzilla.crew_member WHERE id = 123;

# 2. ¿La notificación fue generada?
pm2 logs botzilla-backend | grep "Notificación generada para Crew Leader"

# 3. ¿El sistema de notificaciones está corriendo?
# El sistema existente se ejecuta cada 15 minutos automáticamente

# 4. Esperar hasta 15 minutos
# Las notificaciones se procesan en batch cada 15 min
```

### Problema: Admin no recibe email de alerta

**Verificar:**
```bash
# 1. ¿El webhook está configurado?
echo $MAKE_CREW_LEADER_ALERT_WEBHOOK_URL

# 2. ¿El crew leader NO tiene telegram_id?
SELECT telegram_id FROM botzilla.crew_member WHERE id = 123;

# 3. ¿Los logs muestran el envío?
pm2 logs botzilla-backend | grep "Crew Leader registration alert"

# 4. ¿Make.com tiene el email configurado?
# Ver scenario en Make.com
```

---

## 🔍 Notas Técnicas Importantes

### Depth del API de Attic Tech

**Cambio:** `depth=2` → `depth=3`

**Razón:** Con `depth=2`, el API de Attic Tech **NO** incluía el array `assignedCrew` en los jobs. Al aumentar a `depth=3`, ahora sí trae toda la información de los crew members asignados, incluyendo:

- ID del crew member
- Nombre
- Email  
- Roles (incluyendo "Crew Leader")
- Branches
- Estado de verificación

**Archivo:** `backend/src/controllers/jobSync.controller.js` (línea 49)

```javascript
const params = {
    depth: 3, // Aumentado para traer assignedCrew completo
    limit: 1000,
    'where[updatedAt][greater_than_equal]': fromDate
};
```

---

**Fecha:** Octubre 16, 2025  
**Versión:** 1.1  
**Estado:** ✅ Implementado y Listo para Testing  
**Última actualización:** Agregados 2 escenarios de detección + depth=3 en API de AT

