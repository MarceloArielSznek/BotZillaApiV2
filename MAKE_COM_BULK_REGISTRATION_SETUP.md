# 📧 Make.com - Configuración de Bulk Registration Reminders

## 🎯 Objetivo
Modificar el webhook existente de Make.com para recibir **múltiples employees en un solo payload** y enviar un email a cada uno.

---

## 📦 Payload que Recibe Make.com

### Formato Nuevo (Bulk):

```json
{
  "event": "bulk_registration_reminder",
  "timestamp": "2025-10-14T18:30:00.000Z",
  "count": 3,
  "employees": [
    {
      "id": 1,
      "first_name": "Mike",
      "last_name": "Reynolds",
      "full_name": "Mike Reynolds",
      "email": "mreynolds@atticprojects-sd.com",
      "role": "crew_leader",
      "branch": "San Diego",
      "registration_date": "2025-10-14T00:00:00.000Z",
      "registration_url": "http://your-url/employee-registration"
    },
    {
      "id": 2,
      "first_name": "Evelyn",
      "last_name": "Crew",
      "full_name": "Evelyn Crew",
      "email": "evelynb@menaia.com",
      "role": "crew_leader",
      "branch": "San Diego",
      "registration_date": "2025-10-14T00:00:00.000Z",
      "registration_url": "http://your-url/employee-registration"
    },
    {
      "id": 3,
      "first_name": "Sergio",
      "last_name": "Cervantes",
      "full_name": "Sergio Cervantes",
      "email": "sergio.cervantes96@gmail.com",
      "role": "crew_leader",
      "branch": "San Diego",
      "registration_date": "2025-10-14T00:00:00.000Z",
      "registration_url": "http://your-url/employee-registration"
    }
  ],
  "environment": "production"
}
```

### Caso Especial: 1 Solo Employee

Si se envía reminder individual (botón "Send Reminder"), el array tiene 1 elemento:

```json
{
  "event": "bulk_registration_reminder",
  "timestamp": "2025-10-14T18:30:00.000Z",
  "count": 1,
  "employees": [
    {
      "id": 1,
      "first_name": "Mike",
      "last_name": "Reynolds",
      "email": "mreynolds@atticprojects-sd.com",
      // ... más campos
    }
  ]
}
```

---

## 🔧 Configuración del Flujo en Make.com

### Opción 1: Modificar Webhook Existente (Recomendado)

#### Paso 1: Webhook Receiver
```
Module: Webhooks > Custom Webhook
URL: (Mismo URL que ya tienes en MAKE_REGISTRATION_REMINDER_WEBHOOK_URL)
```

#### Paso 2: Iterator
Agregar módulo **Iterator** después del webhook:

```
Module: Flow Control > Iterator
Array: employees
```

Esto toma el array `employees` y ejecuta el resto del flujo para cada elemento.

#### Paso 3: Email Module (Gmail/SendGrid/etc.)
```
Module: Gmail > Send an Email (o tu módulo de email actual)

Para cada iteración:
- To: {{employees[].email}}
- Subject: Complete Your BotZilla Registration
- Body: 
  Hi {{employees[].first_name}} {{employees[].last_name}},
  
  Please complete your BotZilla registration by clicking the link below:
  {{employees[].registration_url}}
  
  Branch: {{employees[].branch}}
  Role: {{employees[].role}}
  
  Thank you!
```

---

### Opción 2: Crear Nuevo Flujo (Si prefieres separar)

Si prefieres mantener el webhook anterior intacto:

1. Crear nuevo webhook en Make.com
2. Copiar URL nueva
3. Actualizar variable de entorno:
   ```env
   MAKE_BULK_REGISTRATION_REMINDER_WEBHOOK_URL=https://hook.us1.make.com/xxxxx
   ```
4. Crear flujo con Iterator como arriba

---

## 🔄 Flujo Visual Completo

```
┌─────────────────────────────────────────────────────────────┐
│  1. Webhook Receiver                                        │
│     Recibe payload con array de employees                   │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  2. Iterator                                                │
│     Itera sobre el array "employees"                        │
│     Si count = 1, itera 1 vez                              │
│     Si count = 10, itera 10 veces                          │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  3. [OPCIONAL] Filter                                       │
│     Verificar que email no esté vacío                       │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  4. Send Email (Gmail/SendGrid/etc.)                        │
│     To: {{employees[].email}}                               │
│     Subject: Complete Your BotZilla Registration           │
│     Body: Template con link de registro                     │
└─────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────┐
│  5. [OPCIONAL] Log Success                                  │
│     Registrar envío exitoso                                 │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Template de Email Sugerido

### Subject:
```
Complete Your BotZilla Registration - {{employees[].branch}}
```

### Body (HTML):
```html
<!DOCTYPE html>
<html>
<head>
    <style>
        body { font-family: Arial, sans-serif; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background-color: #4472C4; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background-color: #f9f9f9; }
        .button { 
            display: inline-block; 
            padding: 12px 24px; 
            background-color: #4472C4; 
            color: white; 
            text-decoration: none; 
            border-radius: 4px;
            margin: 20px 0;
        }
        .footer { padding: 20px; text-align: center; color: #666; font-size: 12px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔧 Welcome to BotZilla!</h1>
        </div>
        <div class="content">
            <p>Hi <strong>{{employees[].first_name}} {{employees[].last_name}}</strong>,</p>
            
            <p>You've been added to the BotZilla system as a <strong>{{employees[].role}}</strong> for the <strong>{{employees[].branch}}</strong> branch.</p>
            
            <p>To complete your registration and gain access to the system, please click the button below:</p>
            
            <a href="{{employees[].registration_url}}" class="button">
                Complete Registration
            </a>
            
            <p>Or copy this link to your browser:</p>
            <p style="color: #4472C4; word-break: break-all;">{{employees[].registration_url}}</p>
            
            <p><strong>What's next?</strong></p>
            <ul>
                <li>Fill out your personal information</li>
                <li>Provide your Telegram ID</li>
                <li>Wait for admin approval</li>
                <li>Start receiving job notifications!</li>
            </ul>
        </div>
        <div class="footer">
            <p>If you have any questions, please contact your branch manager.</p>
            <p>&copy; 2025 BotZilla - Automated Job Management System</p>
        </div>
    </div>
</body>
</html>
```

---

## 🧪 Testing

### Test con 1 Employee:
```bash
curl -X POST https://hook.us1.make.com/xxxxx \
  -H "Content-Type: application/json" \
  -d '{
    "event": "bulk_registration_reminder",
    "count": 1,
    "employees": [
      {
        "id": 999,
        "first_name": "Test",
        "last_name": "User",
        "email": "test@example.com",
        "role": "crew_leader",
        "branch": "Test Branch",
        "registration_url": "http://localhost:5173/employee-registration"
      }
    ]
  }'
```

### Test con Múltiples Employees:
```bash
curl -X POST https://hook.us1.make.com/xxxxx \
  -H "Content-Type: application/json" \
  -d '{
    "event": "bulk_registration_reminder",
    "count": 3,
    "employees": [
      {
        "id": 1,
        "first_name": "Test1",
        "email": "test1@example.com",
        "role": "crew_leader",
        "branch": "Branch A",
        "registration_url": "http://localhost:5173/employee-registration"
      },
      {
        "id": 2,
        "first_name": "Test2",
        "email": "test2@example.com",
        "role": "crew_member",
        "branch": "Branch B",
        "registration_url": "http://localhost:5173/employee-registration"
      },
      {
        "id": 3,
        "first_name": "Test3",
        "email": "test3@example.com",
        "role": "salesperson",
        "branch": "Branch C",
        "registration_url": "http://localhost:5173/employee-registration"
      }
    ]
  }'
```

---

## ⚠️ Consideraciones Importantes

### 1. Rate Limiting
- Make.com tiene límites de operaciones
- Con Iterator, 10 employees = 10 emails = 10 operaciones
- Verifica tu plan de Make.com

### 2. Error Handling
- Agrega módulo de **Error Handler** en Make.com
- Si un email falla, continúa con los demás
- Considera agregar retry logic

### 3. Logs
- Agrega módulo de **Data Store** para loguear:
  - Cuántos emails se enviaron
  - Cuáles fallaron
  - Timestamp

### 4. Validación
- Agrega **Filter** antes del email para verificar:
  - Email no está vacío
  - Email tiene formato válido
  - first_name y last_name existen

---

## 📊 Ventajas de Esta Implementación

✅ **1 webhook en lugar de N webhooks**
- 10 employees seleccionados = 1 llamada HTTP (no 10)

✅ **Más eficiente**
- Menos carga en Make.com
- Más rápido desde el frontend

✅ **Mismo webhook para individual y bulk**
- Si seleccionas 1 employee → array con 1 elemento
- Si seleccionas 10 employees → array con 10 elementos
- Make.com itera sobre el array automáticamente

✅ **Fácil de mantener**
- Un solo flujo en Make.com
- Un solo webhook URL

---

## 🔄 Migración desde Webhook Anterior

Si ya tienes el webhook anterior funcionando:

### Opción A: Modificar el existente
1. Agregar **Iterator** antes del módulo de email
2. Actualizar referencias de `employee` a `employees[]`
3. Listo ✅

### Opción B: Mantener ambos (Temporal)
1. Crear nuevo flujo para bulk
2. Mantener antiguo para compatibilidad
3. Una vez confirmado, eliminar el antiguo

---

## 📧 Contacto para Soporte

Si tienes problemas configurando Make.com, revisa:
- Logs en Make.com (History)
- Logs en backend de BotZilla (`backend/logs/`)
- Network tab en el navegador

---

**Fecha**: Octubre 14, 2025  
**Versión**: 2.0 (Bulk Implementation)  
**Estado**: ✅ Ready for Configuration

