# 📊 Tabla de Escenarios - Job → Plans In Progress

## 🎯 Actualizado con Notificación en Escenario 1

| # | Escenario | ¿Existe en BD? | `telegram_id` | ✅ Se Asigna `crew_leader_id` | 📧 Alerta de Registro (Webhook) | 📨 Notificación (Telegram) | `notification_sent` | 📝 Logs | Próximos Pasos |
|---|-----------|----------------|---------------|------------------------------|--------------------------------|---------------------------|-------------------|---------|----------------|
| **1** | **Crew Leader NO registrado**<br>(No existe en nuestra BD) | ❌ NO<br>(Ni en `Employee` ni en `CrewMember`) | N/A | ❌ **NO**<br>`crew_leader_id = NULL` | ✅ **SÍ** ⚠️<br>Envía webhook a Make.com<br>**NUEVO** | ❌ **NO** | `false` | `⚠️ Crew Leader "John Doe" NO encontrado en BD. Enviando alerta de registro...` | 1. **Admin recibe email**<br>2. Ejecutar `sync-users`<br>3. Se creará en `Employee` (pending)<br>4. Próximo sync lo detectará (Escenario 2) |
| **2** | **Crew Leader en Employee**<br>(Pendiente, sin Telegram) | ✅ SÍ<br>En `Employee`<br>estado = `pending` | ❌ **NULL** | ✅ **SÍ**<br>`crew_leader_id = Employee.id` (ej: 98) | ✅ **SÍ**<br>Envía webhook a Make.com<br>(Email al admin) | ❌ **NO**<br>(No tiene `telegram_id`) | `true`<br>(para evitar duplicados) | `✅ Crew Leader encontrado en Employee (pendiente): Mike Reynolds`<br>`🔔 Escenario 1/2: Crew Leader asignado`<br>`⚠️ Crew Leader no tiene telegram_id. Enviando alerta...` | 1. Admin recibe email vía Make.com<br>2. Admin contacta a Mike<br>3. Mike se registra y captura `telegram_id`<br>4. Se aprueba → pasa a Escenario 3 |
| **3** | **Crew Leader Activo**<br>(Registrado con Telegram) | ✅ SÍ<br>En `Employee`<br>estado = `active`<br>+ en `CrewMember` | ✅ **"123456789"** | ✅ **SÍ**<br>`crew_leader_id = Employee.id` (ej: 42) | ❌ **NO**<br>(Ya tiene `telegram_id`) | ✅ **SÍ**<br>Sistema existente la envía<br>(cada 15 min) | `true` | `✅ Crew Leader encontrado en CrewMember: John Smith`<br>`🔔 Escenario 1/2: Crew Leader asignado`<br>`📨 Notificación generada para Crew Leader` | 1. Notificación entra en cola<br>2. Sistema de 15 min la procesa<br>3. Crew Leader recibe mensaje en Telegram<br>4. Ve detalles del job |

---

## 🆕 ¿Qué Cambió?

### Escenario 1 - ANTES ❌
- ❌ No se enviaba ninguna alerta
- ❌ Admin no sabía que había un crew leader asignado sin registro
- ❌ Había que esperar a que se ejecutara `sync-users` manualmente

### Escenario 1 - AHORA ✅
- ✅ **Se envía webhook de alerta inmediata**
- ✅ **Admin recibe email** con datos del crew leader (desde AT)
- ✅ Admin sabe que debe ejecutar `sync-users`
- ✅ Webhook incluye flag `action_required: "run_sync_users_first"`

---

## 📨 Webhook Payload - Escenario 1

```json
{
  "event": "crew_leader_needs_registration",
  "timestamp": "2025-10-16T15:30:00.000Z",
  "crew_leader": {
    "id": null,                        // ← NULL porque no está en nuestra BD
    "name": "John Doe",
    "email": "john@example.com",
    "branch": "San Diego",
    "in_database": false               // ← Flag indicando que NO está en BD
  },
  "job": {
    "name": "Job #12345 - San Diego Attic",
    "status": "Plans In Progress",
    "assigned_but_not_registered": true
  },
  "registration_url": "https://your-domain.com/employee-registration",
  "action_required": "run_sync_users_first", // ← Acción específica para este caso
  "environment": "production"
}
```

### Email al Admin (Make.com)

```
Subject: ⚠️ Crew Leader Not in Database - Action Required

John Doe has been assigned to job "Job #12345"
but is NOT in our database yet.

📧 Email: john@example.com
🏢 Branch: San Diego

ACTION REQUIRED:
1. Run sync-users to import this crew leader from Attic Tech
2. Then send them the registration link
3. Once they register, approve their account

Quick Actions:
- Run Sync Users: [Button]
- View Job in AT: https://www.attic-tech.com/jobs/12345
```

---

## 📨 Webhook Payload - Escenario 2

```json
{
  "event": "crew_leader_needs_registration",
  "timestamp": "2025-10-16T15:30:00.000Z",
  "crew_leader": {
    "id": 98,                          // ← ID de nuestra BD
    "name": "Mike Reynolds",
    "email": "mike@example.com",
    "branch": "San Diego",
    "in_database": true                // ← Flag indicando que SÍ está en BD
  },
  "job": {
    "name": "Job #12345 - San Diego Attic",
    "status": "Plans In Progress",
    "assigned_but_not_registered": true
  },
  "registration_url": "https://your-domain.com/employee-registration",
  "action_required": "send_registration_email", // ← Acción específica para este caso
  "environment": "production"
}
```

### Email al Admin (Make.com)

```
Subject: ⚠️ Crew Leader Needs Registration - Mike Reynolds

Mike Reynolds has been assigned to job "Job #12345"
but hasn't registered with their Telegram ID yet.

📧 Email: mike@example.com
🏢 Branch: San Diego
🆔 Employee ID: 98

ACTION REQUIRED:
Send registration email to Mike Reynolds

Quick Actions:
- Send Registration Email: [Button]
- View Employee Profile: /employees/98
- View Job in AT: https://www.attic-tech.com/jobs/12345
```

---

## 🔄 Flujo Completo - Escenario 1

```
1. Job asignado en AT → Crew Leader "John Doe"
   ↓
2. Sync detecta cambio
   ↓
3. Busca "John Doe" en BD → NO encontrado ❌
   ↓
4. Extrae datos de AT (assignedCrew)
   ↓
5. Envía webhook con datos de AT
   {
     id: null,
     name: "John Doe",
     email: "john@example.com",
     in_database: false,
     action_required: "run_sync_users_first"
   }
   ↓
6. Admin recibe email
   ↓
7. Admin ejecuta POST /api/attic-tech-sync/sync-users
   ↓
8. "John Doe" se crea en Employee (pending)
   ↓
9. Próximo sync lo encuentra → Escenario 2
```

---

## 🔍 Diferencias Clave Entre Escenarios

| Campo | Escenario 1 (No en BD) | Escenario 2 (En BD, Pending) |
|-------|----------------------|------------------------------|
| `crew_leader.id` | `null` | `98` (ID de Employee) |
| `crew_leader.in_database` | `false` | `true` |
| `action_required` | `"run_sync_users_first"` | `"send_registration_email"` |
| `Job.crew_leader_id` | `NULL` | `98` |
| Datos de crew leader | Desde AT (assignedCrew) | Desde nuestra BD |

---

**Fecha:** Octubre 16, 2025  
**Versión:** 2.0  
**Cambio Principal:** ✅ Agregado webhook de alerta en Escenario 1 (crew leader NO en BD)


