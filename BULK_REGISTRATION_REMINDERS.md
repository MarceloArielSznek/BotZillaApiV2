# 📧 Bulk Registration Reminders - Implementación Completa

## ✅ Implementado

### 🎯 Objetivo
Permitir enviar invitaciones de registro masivas a múltiples employees desde Attic Tech, con validación de usuarios bloqueados.

---

## 🔧 Backend

### 1. Nuevo Endpoint: Envío Masivo
**Ruta**: `POST /api/employees/send-bulk-reminders`  
**Archivo**: `backend/src/controllers/employee.controller.js` (líneas 473-617)

**Body**:
```json
{
  "employeeIds": [1, 2, 3, 4, 5]
}
```

**Respuesta**:
```json
{
  "success": true,
  "message": "Sent 5 of 5 reminders successfully.",
  "data": {
    "total": 5,
    "sent": 5,
    "blocked": 0,
    "alreadyRegistered": 0,
    "errors": []
  }
}
```

### 2. Validación de Usuarios Bloqueados
El endpoint verifica **automáticamente** si cada employee está bloqueado en Attic Tech:

```javascript
// Línea 530-557
if (employee.attic_tech_user_id && apiKey) {
    const userResponse = await axios.get(
        `https://www.attic-tech.com/api/users/${employee.attic_tech_user_id}`
    );
    
    if (userResponse.data.isBlocked) {
        // ⚠️ Skip y agregar a errors
        results.blocked++;
        results.errors.push({
            employeeId: employee.id,
            email: employee.email,
            reason: 'User is blocked in Attic Tech'
        });
        continue;
    }
}
```

### 3. Webhook a Make.com (BULK - 1 Solo Llamado)
Se envía **UN SOLO webhook** con array de todos los employees no bloqueados:

```javascript
// Línea 597-619
// Acumula todos los employees válidos
const employeesToSend = []; // Array con todos los employees

// ... validaciones ...

// Enviar UN SOLO webhook con todos
await makeWebhookService.sendBulkRegistrationReminders(employeesToSend);
```

**Payload enviado a Make.com**:
```javascript
{
    event: 'bulk_registration_reminder',
    timestamp: '2025-10-14T...',
    count: 10,  // Número de employees
    employees: [  // Array con TODOS los employees
        {
            id: 1,
            first_name: 'Mike',
            last_name: 'Reynolds',
            email: 'mreynolds@atticprojects-sd.com',
            role: 'crew_leader',
            branch: 'San Diego',
            registration_url: 'http://your-url/employee-registration'
        },
        {
            id: 2,
            first_name: 'Evelyn',
            last_name: 'Crew',
            email: 'evelynb@menaia.com',
            role: 'crew_leader',
            branch: 'San Diego',
            registration_url: 'http://your-url/employee-registration'
        }
        // ... más employees
    ]
}
```

**✅ Ventaja**: 10 employees seleccionados = **1 webhook HTTP** (no 10)

---

## 🎨 Frontend

### 1. Servicio Actualizado
**Archivo**: `frontend/src/services/employeeService.ts` (líneas 86-99)

Nueva función:
```typescript
sendBulkRegistrationReminders: async (employeeIds: number[]): Promise<{
    success: boolean;
    message: string;
    data: {
        total: number;
        sent: number;
        blocked: number;
        errors: Array<{...}>;
    };
}>
```

### 2. UI con Selección Múltiple
**Archivo**: `frontend/src/components/employees/AwaitingRegistrationTable.tsx`

#### Nuevas Características:

1. **Checkbox en cada fila** (línea 330-335)
   - Permite seleccionar employees individualmente
   - Filas seleccionadas se destacan con color

2. **Checkbox "Select All" en el header** (línea 305-310)
   - Selecciona/deselecciona todos los employees filtrados
   - Muestra estado "indeterminate" cuando hay selección parcial

3. **Botón "Send to Selected"** (línea 201-213)
   - Solo aparece cuando hay selecciones
   - Muestra el número de employees seleccionados: `Send to Selected (10)`
   - Loading state durante envío

4. **Mensajes de Resultado Detallados** (línea 110-121)
   ```javascript
   ✅ Successfully sent 10 registration reminders!
   // o
   ✅ Sent 8 of 10 reminders. ⚠️ 2 employees are blocked in Attic Tech.
   ```

---

## 📊 Flujo Completo

```
┌─────────────────────────────────────────────────────────────┐
│  1. Admin selecciona employees en la tabla                  │
│     - Checkbox individual o "Select All"                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Click "Send to Selected (N)"                            │
│     - Llama a POST /api/employees/send-bulk-reminders       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. Backend valida CADA employee                            │
│     - ¿Tiene attic_tech_user_id?                           │
│     - ✅ Sí → Verifica en AT si está bloqueado             │
│     - ❌ No → Agrega a array de válidos                    │
│     - Acumula todos los NO bloqueados en array             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Envía 1 SOLO webhook con array completo                │
│     ⚡ 10 employees = 1 llamada HTTP                       │
│     - Payload: { count: 10, employees: [...] }             │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. Make.com recibe webhook                                 │
│     - Iterator itera sobre array "employees"                │
│     - Envía 1 email por cada employee en el array           │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  6. Frontend muestra resultados                             │
│     - ✅ X enviados exitosamente                           │
│     - ⚠️ Y bloqueados en AT                                │
│     - ❌ Z con errores                                     │
│     - Limpia selección y recarga tabla                      │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Seguridad

1. ✅ **Requiere autenticación**: `verifyToken`
2. ✅ **Solo Admin**: `isAdmin` middleware
3. ✅ **Validación de bloqueados**: Consulta a AT antes de enviar
4. ✅ **Manejo de errores**: No interrumpe si uno falla
5. ✅ **Logs detallados**: Todos los eventos se loguean

---

## 🧪 Testing

### Caso 1: Envío Exitoso
```bash
# Request
POST /api/employees/send-bulk-reminders
{
  "employeeIds": [1, 2, 3]
}

# Response
{
  "success": true,
  "message": "Sent 3 of 3 reminders successfully.",
  "data": {
    "total": 3,
    "sent": 3,
    "blocked": 0,
    "errors": []
  }
}
```

### Caso 2: Con Usuarios Bloqueados
```bash
# Response
{
  "success": true,
  "message": "Sent 2 of 3 reminders successfully.",
  "data": {
    "total": 3,
    "sent": 2,
    "blocked": 1,
    "errors": [
      {
        "employeeId": 2,
        "email": "blocked@example.com",
        "reason": "User is blocked in Attic Tech"
      }
    ]
  }
}
```

---

## 📝 Variables de Entorno Necesarias

Asegúrate de tener configuradas:

```env
# URL del frontend para el link de registro
FRONTEND_URL=http://localhost:5173

# Webhook de Make.com para envío de emails
MAKE_REGISTRATION_REMINDER_WEBHOOK_URL=https://hook.us1.make.com/...

# Credenciales de Attic Tech (para validar bloqueados)
ATTIC_TECH_EMAIL=your-email@example.com
ATTIC_TECH_PASSWORD=your-password
```

---

## 🎯 Ventajas de esta Implementación

1. ✅ **1 webhook en lugar de N** - 10 employees = 1 HTTP call (no 10)
2. ✅ **Reutiliza webhook existente** - Solo agrega Iterator en Make.com
3. ✅ **Validación automática** - Verifica usuarios bloqueados en AT
4. ✅ **UX mejorada** - Selección múltiple con feedback visual
5. ✅ **Informes detallados** - Muestra exactamente qué pasó con cada envío
6. ✅ **Más eficiente** - Menos carga en Make.com y backend
7. ✅ **Funciona para 1 o N** - Si seleccionas 1, el array tiene 1 elemento
8. ✅ **Manejo de errores robusto** - Un employee bloqueado no afecta los demás

---

## 📦 Archivos Modificados

### Backend:
- ✅ `backend/src/controllers/employee.controller.js` (+145 líneas)
- ✅ `backend/src/routes/employees.routes.js` (+12 líneas)
- ✅ `backend/src/services/makeWebhook.service.js` (+60 líneas - nueva función bulk)

### Frontend:
- ✅ `frontend/src/services/employeeService.ts` (+14 líneas)
- ✅ `frontend/src/components/employees/AwaitingRegistrationTable.tsx` (+83 líneas)

### Documentación:
- ✅ `MAKE_COM_BULK_REGISTRATION_SETUP.md` (Guía de configuración de Make.com)

---

## 🚀 Próximos Pasos

### 1. ✅ **COMPLETADO**: Envío masivo de recordatorios
- Backend listo con bulk webhooks
- Frontend con selección múltiple
- Validación de usuarios bloqueados

### 2. ⚠️ **REQUERIDO**: Configurar Make.com
- Ver guía: `MAKE_COM_BULK_REGISTRATION_SETUP.md`
- Agregar módulo **Iterator** al flujo existente
- Actualizar referencias de `employee` a `employees[]`

### 3. 🔜 **Pendiente**: Detección de crew leaders no registrados en JobSync
### 4. 🔜 **Pendiente**: Notificación al admin sobre crew leaders sin telegram_id
### 5. 🔜 **Pendiente**: Frontend mejorado para registro simplificado

---

**Fecha**: Octubre 14, 2025  
**Versión**: 2.0 (Bulk Implementation)  
**Estado**: ✅ Backend Completado | ⚠️ Requiere Configuración Make.com

