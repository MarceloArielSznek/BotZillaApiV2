# 📋 Guía: Notificaciones para Operation Manager

## 🎯 Objetivo
Cuando un **nuevo job** llega desde Attic Tech con estado **"Requires Crew Lead"**, el sistema debe enviar una notificación automática al **Operation Manager** del branch correspondiente.

---

## 📊 Flujo de Notificación

```
┌─────────────────────────────────────────────────────────────────┐
│  1. Job Sync desde Attic Tech (cada 30 min via Make.com)       │
│     - Fetch jobs con updatedAt >= últimos 30 días              │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. ¿Es un NUEVO job?                                           │
│     - ¿No existe en tabla "job"?                                │
└─────────────────────────────────────────────────────────────────┘
                            ↓ Sí
┌─────────────────────────────────────────────────────────────────┐
│  3. ¿Estado es "Requires Crew Lead"?                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓ Sí
┌─────────────────────────────────────────────────────────────────┐
│  4. Buscar Operation Manager del branch                         │
│     - Rol: "operation manager" (user_rol.id = 4)               │
│     - Branch: Asignado en tabla "user_branch"                   │
│     - Telegram ID: Debe estar configurado en "user"             │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Generar Notificación                                        │
│     {                                                            │
│       "job_name": "Lyn Keenan - SEA",                           │
│       "cx_name": "Lyn Keenan",                                  │
│       "cx_phone": "206-876-0638",                               │
│       "job_address": "3821 39th Ave W, Seattle, WA 98199",      │
│       "branch": "Seattle",                                      │
│       "salesperson_name": "John Doe",                           │
│       "client_email": "lyn@example.com",                        │
│       "job_link": "https://www.attic-tech.com/jobs/12345",     │
│       "notification_type": "New Job - Requires Crew Lead",      │
│       "telegram_id": "123456789"                                │
│     }                                                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Make.com recibe el array "notifications"                    │
│     - Envía mensaje a Telegram usando telegram_id               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗄️ Cambios en Base de Datos

### 1. **Nuevo Rol: `operation manager`**

```sql
-- Script: backend/src/migrations/add_operation_manager_role.sql
INSERT INTO botzilla.user_rol (id, name) 
VALUES (4, 'operation manager')
ON CONFLICT (id) DO NOTHING;
```

| ID | Rol                  | Descripción                                |
|----|----------------------|--------------------------------------------|
| 1  | admin                | Acceso total al sistema                    |
| 2  | user                 | Usuario básico                             |
| 3  | manager              | Branch manager                             |
| 4  | **operation manager** | Recibe notificaciones de nuevos jobs      |

---

## 👤 Configuración de Operation Manager

### **Paso 1: Crear usuario con rol `operation manager`**

```sql
-- Crear usuario
INSERT INTO botzilla.user (email, password, telegram_id, rol_id, phone)
VALUES (
    'ops.manager@botzilla.com',
    '$2a$10$hashedpassword...', -- Password hasheado con bcrypt
    '123456789',                 -- Telegram ID del usuario
    4,                           -- rol_id = 4 (operation manager)
    '+1-555-0123'
);
```

### **Paso 2: Asignar a branches específicos**

```sql
-- Asignar a branch "San Diego" (branch_id = 5)
INSERT INTO botzilla.user_branch (user_id, branch_id)
VALUES (1, 5);

-- Asignar a branch "Orange County" (branch_id = 3)
INSERT INTO botzilla.user_branch (user_id, branch_id)
VALUES (1, 3);
```

**Nota:** Un Operation Manager puede estar asignado a múltiples branches.

---

## 🔍 Consultas Útiles

### **Ver todos los Operation Managers y sus branches**

```sql
SELECT 
    u.id AS user_id,
    u.email,
    u.telegram_id,
    ur.name AS role,
    b.name AS branch_name
FROM botzilla.user u
JOIN botzilla.user_rol ur ON u.rol_id = ur.id
LEFT JOIN botzilla.user_branch ub ON u.id = ub.user_id
LEFT JOIN botzilla.branch b ON ub.branch_id = b.id
WHERE ur.name = 'operation manager'
ORDER BY u.email, b.name;
```

### **Ver jobs pendientes de asignación ("Requires Crew Lead")**

```sql
SELECT 
    j.id,
    j.name AS job_name,
    js.name AS status,
    b.name AS branch,
    j.attic_tech_job_id,
    j.notification_sent,
    j.last_notification_sent_at
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.branch b ON j.branch_id = b.id
WHERE js.name = 'Requires Crew Lead'
ORDER BY j.last_synced_at DESC;
```

---

## 🛠️ Código Implementado

### **1. Función: `findOperationManager(branchId)`**

**Ubicación:** `backend/src/controllers/jobSync.controller.js`

**Propósito:** Busca el Operation Manager asignado a un branch específico.

```javascript
async function findOperationManager(branchId) {
    const operationManagerRole = await UserRol.findOne({
        where: { name: 'operation manager' }
    });

    const operationManager = await User.findOne({
        where: { rol_id: operationManagerRole.id },
        include: [{
            model: Branch,
            as: 'branches',
            where: { id: branchId },
            through: { attributes: [] }
        }],
        attributes: ['id', 'email', 'telegram_id']
    });

    return operationManager;
}
```

---

### **2. Función: `generateOperationManagerNotification(atJob, branch, estimate)`**

**Ubicación:** `backend/src/controllers/jobSync.controller.js`

**Propósito:** Genera la notificación con todos los datos del job para Make.com.

```javascript
async function generateOperationManagerNotification(atJob, branch, estimate) {
    const notification = {
        job_name: atJob.name,
        cx_name: atJob.job_estimate?.customer?.name || 'N/A',
        cx_phone: atJob.job_estimate?.customer?.phone || null,
        job_address: atJob.job_estimate?.customer?.address || 'N/A',
        branch: branch?.name || 'N/A',
        salesperson_name: atJob.job_estimate?.salesperson?.name || 'N/A',
        client_email: atJob.job_estimate?.customer?.email || null,
        job_link: `https://www.attic-tech.com/jobs/${atJob.id}`,
        notification_type: 'New Job - Requires Crew Lead',
        telegram_id: null
    };

    const operationManager = await findOperationManager(branch.id);
    if (operationManager?.telegram_id) {
        notification.telegram_id = operationManager.telegram_id;
        return notification;
    }

    return null;
}
```

---

### **3. Lógica de Detección en `saveJobsToDb()`**

**Ubicación:** `backend/src/controllers/jobSync.controller.js`

**Propósito:** Detecta nuevos jobs con estado "Requires Crew Lead" y genera notificaciones.

```javascript
} else {
    // Crear nuevo job
    await Job.create(jobData);
    newCount++;

    // NOTIFICACIÓN AL OPERATION MANAGER
    const newStatus = status?.name;
    if (newStatus === 'Requires Crew Lead' && branch) {
        const notification = await generateOperationManagerNotification(
            atJob, 
            branch, 
            estimate
        );
        if (notification) {
            notifications.push(notification);
        }
    }
}
```

---

## 📡 Respuesta del Endpoint `/api/job-sync/sync-jobs`

### **Ejemplo de Respuesta:**

```json
{
    "success": true,
    "message": "Job sync completed",
    "data": {
        "totalJobs": 15,
        "newJobs": 3,
        "updatedJobs": 12,
        "errors": [],
        "syncPeriod": "2025-09-13 to 2025-10-13",
        "notifications": [
            {
                "job_name": "Lyn Keenan - SEA",
                "cx_name": "Lyn Keenan",
                "cx_phone": "206-876-0638",
                "job_address": "3821 39th Ave W, Seattle, WA 98199",
                "branch": "Seattle",
                "salesperson_name": "John Doe",
                "client_email": "lyn@example.com",
                "job_link": "https://www.attic-tech.com/jobs/12345",
                "notification_type": "New Job - Requires Crew Lead",
                "telegram_id": "123456789"
            },
            {
                "job_name": "Matt Anderson - SD",
                "cx_name": "Matt Anderson",
                "cx_phone": "619-555-1234",
                "job_address": "1234 Main St, San Diego, CA 92101",
                "branch": "San Diego",
                "salesperson_name": "Jane Smith",
                "client_email": "matt@example.com",
                "job_link": "https://www.attic-tech.com/jobs/54321",
                "notification_type": "Crew Leader Assigned",
                "telegram_id": "987654321"
            }
        ]
    }
}
```

---

## 🧪 Testing

### **1. Ejecutar Migration**

```bash
cd /Users/marce/Desktop/Development/botzilla-dev/BotZillaApiV2/backend
psql -U postgres -d botzilla -f src/migrations/add_operation_manager_role.sql
```

### **2. Crear un Operation Manager de Prueba**

```sql
-- Crear usuario
INSERT INTO botzilla.user (email, password, telegram_id, rol_id, phone)
VALUES (
    'test.ops@botzilla.com',
    '$2a$10$dummyhashedpassword',
    '999999999', -- Tu Telegram ID para pruebas
    4,
    '+1-555-TEST'
);

-- Asignar a un branch (ej: San Diego)
INSERT INTO botzilla.user_branch (user_id, branch_id)
VALUES (
    (SELECT id FROM botzilla.user WHERE email = 'test.ops@botzilla.com'),
    5 -- branch_id de San Diego
);
```

### **3. Probar el Sync**

```bash
# Con JWT Token
curl -X POST http://localhost:3000/api/job-sync/sync-jobs \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Con API Key
curl -X POST http://localhost:3000/api/job-sync/sync-jobs \
  -H "X-API-Key: YOUR_AUTOMATION_API_KEY"
```

### **4. Verificar Logs**

```bash
tail -f backend/logs/combined-$(date +%Y-%m-%d).log | grep "Operation Manager"
```

Busca estas líneas:
- `✅ Operation Manager encontrado para branch X`
- `📨 Notificación generada para Operation Manager`
- `🔔 Nuevo job con estado "Requires Crew Lead"`

---

## ⚠️ Consideraciones

1. **Telegram ID Obligatorio:** El Operation Manager **DEBE** tener un `telegram_id` configurado, de lo contrario no recibirá notificaciones.

2. **Asignación a Branch:** El Operation Manager debe estar asignado en `user_branch` al branch del job.

3. **Un OM por Branch:** El sistema selecciona el **primer** Operation Manager que encuentre para ese branch. Si hay varios, solo el primero recibirá la notificación.

4. **Make.com:** Make.com debe estar configurado para leer el campo `notification_type` y enviar mensajes diferentes según el tipo:
   - `"New Job - Requires Crew Lead"` → Mensaje al Operation Manager
   - `"Crew Leader Assigned"` → Mensaje al Crew Leader

---

## 📝 Próximos Pasos

- [ ] Ejecutar migration para agregar rol `operation manager`
- [ ] Crear usuarios Operation Manager en producción
- [ ] Asignarlos a sus branches correspondientes
- [ ] Configurar sus Telegram IDs
- [ ] Actualizar Make.com para manejar el nuevo `notification_type`
- [ ] Testear en desarrollo
- [ ] Deployment a producción

---

**Última actualización:** 2025-10-13  
**Autor:** BotZilla Dev Team

