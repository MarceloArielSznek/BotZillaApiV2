# 📱 Sistema de Agrupación y Envío Masivo de SMS - Diseño Arquitectónico

## 🎯 Objetivo
Permitir crear grupos/batches de lost estimates y enviar mensajes SMS personalizados masivamente usando un builder con campos dinámicos de la base de datos.

---

## 🗄️ Arquitectura de Base de Datos

### Tabla 1: `sms_batch` (Grupos de Estimates)
```sql
CREATE TABLE botzilla.sms_batch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_by INTEGER REFERENCES botzilla."user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'draft', -- draft, ready, sent, cancelled
    total_estimates INTEGER DEFAULT 0,
    sent_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    metadata JSONB DEFAULT '{}' -- Guarda los filtros aplicados
);
```

**Campos clave:**
- `name`: Nombre del batch (ej: "Orange County - Dec 2025")
- `description`: Descripción opcional
- `status`: Estado del batch (draft, ready, sent, cancelled)
- `metadata`: JSON con los filtros usados para crear el batch

### Tabla 2: `sms_batch_estimate` (Relación Many-to-Many)
```sql
CREATE TABLE botzilla.sms_batch_estimate (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES botzilla.sms_batch(id) ON DELETE CASCADE,
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id) ON DELETE CASCADE,
    added_at TIMESTAMP DEFAULT NOW(),
    status VARCHAR(50) DEFAULT 'pending', -- pending, sent, failed, skipped
    sent_at TIMESTAMP,
    error_message TEXT,
    UNIQUE(batch_id, estimate_id)
);
```

**Propósito:** Relaciona estimates con batches, permite tracking individual

### Tabla 3: `sms_template` (Plantillas de Mensajes)
```sql
CREATE TABLE botzilla.sms_template (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    content TEXT NOT NULL, -- Template con placeholders
    created_by INTEGER REFERENCES botzilla."user"(id),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    is_default BOOLEAN DEFAULT false,
    metadata JSONB DEFAULT '{}' -- Variables disponibles, ej: {customer_name, final_price, branch_name}
);
```

**Ejemplo de content:**
```
Hello {{customer_name}}!

We noticed you were interested in our services. 
Special discount today: {{discount_percentage}}% off!

Final price: {{final_price}}

Reply STOP to opt out.
```

### Tabla 4: `sms_campaign` (Campañas de Envío)
```sql
CREATE TABLE botzilla.sms_campaign (
    id SERIAL PRIMARY KEY,
    batch_id INTEGER NOT NULL REFERENCES botzilla.sms_batch(id),
    template_id INTEGER REFERENCES botzilla.sms_template(id),
    message_content TEXT NOT NULL, -- Mensaje final renderizado (ejemplo)
    sent_by INTEGER REFERENCES botzilla."user"(id),
    scheduled_at TIMESTAMP, -- Para envíos programados
    sent_at TIMESTAMP,
    status VARCHAR(50) DEFAULT 'pending', -- pending, queued, sending, completed, failed
    total_recipients INTEGER,
    success_count INTEGER DEFAULT 0,
    failed_count INTEGER DEFAULT 0,
    webhook_url VARCHAR(500), -- URL de Make.com o Quo
    webhook_provider VARCHAR(50), -- 'make_com' o 'quo'
    webhook_request_id VARCHAR(255), -- ID de la request enviada
    webhook_response JSONB, -- Respuesta del webhook
    metadata JSONB DEFAULT '{}'
);
```

### Tabla 5: `sms_message_log` (Log de Mensajes Individuales)
```sql
CREATE TABLE botzilla.sms_message_log (
    id SERIAL PRIMARY KEY,
    campaign_id INTEGER REFERENCES botzilla.sms_campaign(id),
    batch_estimate_id INTEGER REFERENCES botzilla.sms_batch_estimate(id),
    estimate_id INTEGER NOT NULL REFERENCES botzilla.estimate(id),
    phone_number VARCHAR(20) NOT NULL,
    message_content TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'pending', -- pending, queued, sent, delivered, failed, bounced
    webhook_request_id VARCHAR(255), -- ID de la request al webhook
    webhook_response JSONB, -- Respuesta del webhook
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    error_code VARCHAR(50),
    error_message TEXT,
    callback_received_at TIMESTAMP, -- Cuando recibimos callback de Make/Quo
    metadata JSONB DEFAULT '{}'
);
```

### Tabla 6: `sms_webhook_config` (Configuración de Webhooks)
```sql
CREATE TABLE botzilla.sms_webhook_config (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL, -- 'Make.com Production', 'Quo Staging', etc.
    provider VARCHAR(50) NOT NULL, -- 'make_com' o 'quo'
    webhook_url VARCHAR(500) NOT NULL,
    api_key VARCHAR(255), -- Si requiere autenticación
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    metadata JSONB DEFAULT '{}' -- Headers adicionales, timeout, etc.
);
```

---

## 🔄 Flujo de Trabajo (User Journey)

```
┌─────────────────────────────────────────────────────────────────┐
│                   1. CREAR BATCH                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Opción A: Filtrar por condiciones │
        │  - Rango de precios                 │
        │  - Rango de fechas                  │
        │  - Branch                           │
        │  - Salesperson                      │
        │  - Follow-up status                 │
        │  - Follow-up label                  │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Opción B: Selección manual         │
        │  - Checkboxes en tabla              │
        │  - Seleccionar múltiples            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Preview de estimates seleccionados │
        │  - Mostrar lista                    │
        │  - Contador total                    │
        │  - Opción de editar filtros         │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Guardar Batch                      │
        │  - Nombre del batch                 │
        │  - Descripción (opcional)           │
        └─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   2. CREAR/EDITAR TEMPLATE                      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  SMS Builder                        │
        │  - Editor de texto                  │
        │  - Insertar variables dinámicas     │
        │  - Preview con datos reales          │
        │  - Validación de caracteres         │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Variables disponibles:             │
        │  {{customer_name}}                  │
        │  {{final_price}}                    │
        │  {{discount_percentage}}            │
        │  {{branch_name}}                    │
        │  {{salesperson_name}}               │
        │  {{estimate_id}}                    │
        │  {{follow_up_date}}                 │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Guardar Template                    │
        │  - Nombre                            │
        │  - Marcar como default (opcional)    │
        └─────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   3. ENVIAR CAMPAÑA                            │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Seleccionar Batch                   │
        │  - Lista de batches guardados       │
        │  - Ver detalles del batch            │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Seleccionar Template                │
        │  - Usar template guardado           │
        │  - O crear uno nuevo                 │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Preview de Campaña                  │
        │  - Ver mensaje renderizado           │
        │  - Ver lista de destinatarios        │
        │  - Verificar números de teléfono     │
        │  - Costo estimado                    │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Confirmar Envío                    │
        │  - Programar (opcional)             │
        │  - Enviar ahora                     │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Procesamiento                       │
        │  - Renderizar mensajes               │
        │  - Validar números                   │
        │  - Enviar webhook a Make.com/Quo    │
        │  - Guardar request IDs               │
        │  - Actualizar status a "queued"      │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Make.com / Quo                     │
        │  - Recibe webhook                   │
        │  - Procesa y envía SMS              │
        │  - Envía callback con resultados    │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Webhook Callback Handler            │
        │  - Recibe resultados                 │
        │  - Actualiza status de mensajes      │
        │  - Actualiza campaña                 │
        └─────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────┐
        │  Dashboard de Resultados            │
        │  - Enviados: X                      │
        │  - Fallidos: Y                      │
        │  - Ver logs individuales             │
        └─────────────────────────────────────┘
```

---

## 🎨 Estructura de Frontend

### Página 1: `/sms-batches` (Gestión de Batches)
```
┌─────────────────────────────────────────────────────────────┐
│  SMS Batches                          [+ Create Batch]      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [Filtros: Status, Date Range, Created By]                   │
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Batch Name        | Estimates | Status | Actions    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Orange Co - Dec   | 45        | Draft  | [Edit][Send]│  │
│  │ SD Lost Leads     | 120       | Sent   | [View]      │  │
│  │ Manual Selection  | 8         | Ready  | [Edit][Send]│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Página 2: `/sms-batches/create` (Crear Batch)
```
┌─────────────────────────────────────────────────────────────┐
│  Create SMS Batch                                           │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Method: ○ Filter by Conditions  ● Manual Selection        │
│                                                              │
│  ┌─ Filter Mode ───────────────────────────────────────┐  │
│  │ Price Range: [$____] to [$____]                      │  │
│  │ Date Range: [____] to [____]                         │  │
│  │ Branch: [Dropdown]                                   │  │
│  │ Salesperson: [Dropdown]                              │  │
│  │ Follow-up Status: [Dropdown]                         │  │
│  │ Follow-up Label: [Dropdown]                          │  │
│  │                                                      │  │
│  │ [Preview Estimates]                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Manual Selection Mode ─────────────────────────────┐  │
│  │ [Volver a tabla de FollowUpEstimates con checkboxes]│  │
│  │                                                      │  │
│  │ Selected: 8 estimates                                │  │
│  │ [Add to Batch]                                       │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Batch Details ─────────────────────────────────────┐  │
│  │ Name: [________________________]                    │  │
│  │ Description: [__________________]                    │  │
│  │                                                      │  │
│  │ Estimates in batch: 45                              │  │
│  │                                                      │  │
│  │ [Cancel] [Save Batch]                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Página 3: `/sms-templates` (Gestión de Templates)
```
┌─────────────────────────────────────────────────────────────┐
│  SMS Templates                          [+ Create Template] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Template Name    | Variables    | Actions            │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Discount Offer   | customer_name, final_price | [Edit]│  │
│  │ Follow-up Remind | customer_name, branch_name | [Edit]│  │
│  │ Default Template | customer_name | [Edit][Set Default]│  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Página 4: `/sms-templates/create` (SMS Builder)
```
┌─────────────────────────────────────────────────────────────┐
│  Create SMS Template                                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Template Name: [________________________]                  │
│                                                              │
│  ┌─ Message Editor ─────────────────────────────────────┐  │
│  │                                                      │  │
│  │ Hello {{customer_name}}!                            │  │
│  │                                                      │  │
│  │ We noticed you were interested in our services.      │  │
│  │ Special discount today: {{discount_percentage}}%!   │  │
│  │                                                      │  │
│  │ Final price: {{final_price}}                        │  │
│  │                                                      │  │
│  │ Reply STOP to opt out.                              │  │
│  │                                                      │  │
│  │ Characters: 145 / 160                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Available Variables ───────────────────────────────┐  │
│  │ [customer_name] [final_price] [discount_percentage] │  │
│  │ [branch_name] [salesperson_name] [estimate_id]      │  │
│  │ [follow_up_date] [retail_price] [true_cost]         │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Preview (with real data) ──────────────────────────┐  │
│  │ Hello Dana Nicholson!                               │  │
│  │                                                      │  │
│  │ We noticed you were interested in our services.      │  │
│  │ Special discount today: 15.0%!                       │  │
│  │                                                      │  │
│  │ Final price: $20,595.46                              │  │
│  │                                                      │  │
│  │ Reply STOP to opt out.                              │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Cancel] [Save Template]                                    │
└─────────────────────────────────────────────────────────────┘
```

### Página 5: `/sms-campaigns/send` (Enviar Campaña)
```
┌─────────────────────────────────────────────────────────────┐
│  Send SMS Campaign                                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Step 1: Select Batch                                       │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Dropdown: Select Batch]                            │  │
│  │                                                      │  │
│  │ Batch: "Orange Co - Dec"                            │  │
│  │ Estimates: 45                                       │  │
│  │ Created: Dec 9, 2025                                │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 2: Select Template                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ [Dropdown: Select Template] [Create New]            │  │
│  │                                                      │  │
│  │ Template: "Discount Offer"                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 3: Preview                                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ Message Preview:                                    │  │
│  │ ┌────────────────────────────────────────────────┐  │
│  │ │ Hello Dana Nicholson!                         │  │
│  │ │ ...                                           │  │
│  │ └────────────────────────────────────────────────┘  │
│  │                                                      │  │
│  │ Recipients: 45                                       │  │
│  │ Estimated Cost: $4.50                                │  │
│  │                                                      │  │
│  │ [View Full Recipient List]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  Step 4: Schedule (Optional)                                │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ ○ Send Now                                           │  │
│  │ ● Schedule for later                                │  │
│  │   Date/Time: [____] [____]                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Cancel] [Send Campaign]                                   │
└─────────────────────────────────────────────────────────────┘
```

### Página 6: `/sms-campaigns/:id` (Resultados de Campaña)
```
┌─────────────────────────────────────────────────────────────┐
│  Campaign Results: "Orange Co - Dec"                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  Status: ✅ Completed                                        │
│  Sent: Dec 9, 2025 at 2:30 PM                               │
│                                                              │
│  ┌─ Statistics ────────────────────────────────────────┐  │
│  │ Total Recipients: 45                                 │  │
│  │ ✅ Sent: 42                                          │  │
│  │ ❌ Failed: 3                                         │  │
│  │ Cost: $4.20                                          │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                              │
│  ┌─ Message Log ────────────────────────────────────────┐  │
│  │ Name            | Phone        | Status    | Time    │  │
│  ├──────────────────────────────────────────────────────┤  │
│  │ Dana Nicholson  | +1234567890  | ✅ Sent   | 2:30 PM │  │
│  │ Dean Daniel     | +1234567891  | ✅ Sent   | 2:30 PM │  │
│  │ Steven Jamura   | +1234567892  | ❌ Failed | 2:30 PM │  │
│  │ ...                                                   │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                              │
│  [Export Log] [Resend Failed]                               │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔌 Backend API Endpoints

### Batches
```
GET    /api/sms-batches              # Listar batches
POST   /api/sms-batches              # Crear batch
GET    /api/sms-batches/:id          # Obtener batch
PUT    /api/sms-batches/:id          # Actualizar batch
DELETE /api/sms-batches/:id          # Eliminar batch
POST   /api/sms-batches/:id/estimates # Agregar estimates al batch
DELETE /api/sms-batches/:id/estimates/:estimateId # Remover estimate
GET    /api/sms-batches/:id/preview  # Preview de estimates en batch
POST   /api/sms-batches/filter       # Crear batch desde filtros
```

### Templates
```
GET    /api/sms-templates            # Listar templates
POST   /api/sms-templates            # Crear template
GET    /api/sms-templates/:id        # Obtener template
PUT    /api/sms-templates/:id        # Actualizar template
DELETE /api/sms-templates/:id        # Eliminar template
POST   /api/sms-templates/:id/preview # Preview con datos reales
GET    /api/sms-templates/variables  # Listar variables disponibles
```

### Campaigns
```
GET    /api/sms-campaigns                    # Listar campañas
POST   /api/sms-campaigns                    # Crear y enviar campaña
GET    /api/sms-campaigns/:id                # Obtener campaña
GET    /api/sms-campaigns/:id/logs           # Obtener logs de mensajes
POST   /api/sms-campaigns/:id/cancel         # Cancelar campaña
POST   /api/sms-campaigns/:id/retry          # Reintentar fallidos
POST   /api/sms-campaigns/webhook/callback   # Callback desde Make.com/Quo
```

### Webhook Configuration
```
GET    /api/sms-webhooks                     # Listar configuraciones
POST   /api/sms-webhooks                     # Crear configuración
GET    /api/sms-webhooks/:id                 # Obtener configuración
PUT    /api/sms-webhooks/:id                 # Actualizar configuración
DELETE /api/sms-webhooks/:id                 # Eliminar configuración
POST   /api/sms-webhooks/:id/test            # Probar webhook
GET    /api/sms-webhooks/active              # Obtener webhook activo
```

---

## 🛠️ Servicios Backend

### `smsBatchService.js`
- `createBatchFromFilters(filters)` - Crear batch desde filtros
- `addEstimatesToBatch(batchId, estimateIds)` - Agregar estimates
- `removeEstimateFromBatch(batchId, estimateId)` - Remover estimate
- `getBatchPreview(batchId)` - Preview de estimates

### `smsTemplateService.js`
- `renderTemplate(template, estimate)` - Renderizar template con datos
- `validateTemplate(template)` - Validar sintaxis
- `getAvailableVariables()` - Listar variables disponibles
- `previewTemplate(templateId, estimateId)` - Preview con datos reales

### `smsCampaignService.js`
- `createCampaign(batchId, templateId, options)` - Crear campaña
- `sendCampaign(campaignId)` - Enviar campaña
- `scheduleCampaign(campaignId, scheduledAt)` - Programar envío
- `getCampaignStatus(campaignId)` - Estado de campaña
- `retryFailedMessages(campaignId)` - Reintentar fallidos

### `smsProviderService.js` (Integración con Twilio/Vonage)
- `sendSMS(phoneNumber, message, options)` - Enviar SMS individual
- `sendBulkSMS(messages)` - Envío masivo
- `getMessageStatus(messageId)` - Estado de mensaje
- `validatePhoneNumber(phoneNumber)` - Validar número

---

## 📋 Variables Disponibles en Templates

```javascript
{
  customer_name: "Dana Nicholson",
  customer_phone: "+1234567890",
  customer_email: "dana@example.com",
  estimate_id: "12345",
  estimate_name: "Dana Nicholson HB",
  final_price: "$20,595.46",
  retail_price: "$24,230.00",
  true_cost: "$2,343.42",
  discount_percentage: "15.0%",
  discount_amount: "$3,634.54",
  branch_name: "Orange County",
  salesperson_name: "Vincent Lee",
  follow_up_date: "12/08/2025",
  follow_up_status: "Texted",
  follow_up_label: "PMP",
  at_created_date: "12/04/2025",
  at_updated_date: "12/09/2025"
}
```

---

## 🔌 Estructura de Webhooks

### Payload para Make.com/Quo (Request desde Backend)

```json
{
  "campaign_id": 123,
  "batch_id": 45,
  "template_id": 8,
  "messages": [
    {
      "message_id": "msg_001",
      "estimate_id": 12345,
      "phone_number": "+1234567890",
      "customer_name": "Dana Nicholson",
      "message": "Hello Dana Nicholson!\n\nWe noticed you were interested...",
      "variables": {
        "customer_name": "Dana Nicholson",
        "final_price": "$20,595.46",
        "discount_percentage": "15.0%",
        "branch_name": "Orange County"
      }
    },
    {
      "message_id": "msg_002",
      "estimate_id": 12346,
      "phone_number": "+1234567891",
      "customer_name": "Dean Daniel",
      "message": "Hello Dean Daniel!\n\n...",
      "variables": { ... }
    }
  ],
  "metadata": {
    "total_messages": 45,
    "sent_by": "user@example.com",
    "timestamp": "2025-12-09T14:30:00Z"
  }
}
```

### Callback desde Make.com/Quo (Response al Backend)

```json
{
  "campaign_id": 123,
  "webhook_request_id": "req_abc123",
  "results": [
    {
      "message_id": "msg_001",
      "status": "sent",
      "provider_message_id": "SMS_xyz789",
      "sent_at": "2025-12-09T14:30:15Z",
      "cost": 0.05
    },
    {
      "message_id": "msg_002",
      "status": "failed",
      "error_code": "INVALID_NUMBER",
      "error_message": "Invalid phone number format",
      "sent_at": null
    }
  ],
  "summary": {
    "total": 45,
    "sent": 42,
    "failed": 3,
    "total_cost": 2.10
  }
}
```

### Endpoint de Callback en Backend

```
POST /api/sms-campaigns/webhook/callback
```

**Headers requeridos:**
- `X-Webhook-Signature` (opcional, para validación)
- `Content-Type: application/json`

**Autenticación:**
- API Key en header o query param
- O validación por IP whitelist

## 🔐 Consideraciones de Seguridad

1. **Opt-out**: Todos los mensajes deben incluir "Reply STOP to opt out"
2. **Validación de números**: Validar formato antes de enviar
3. **Rate limiting**: Limitar envíos por minuto/hora
4. **Permisos**: Solo usuarios autorizados pueden enviar SMS
5. **Logs**: Guardar todos los mensajes enviados para auditoría
6. **Webhook Security**: 
   - Validar firma de webhook (si Make/Quo la provee)
   - Whitelist de IPs para callbacks
   - API Key para autenticación
7. **Retry Logic**: Reintentar webhooks fallidos
8. **Timeout Handling**: Manejar timeouts de webhooks

---

## 🚀 Fases de Implementación

### Fase 1: Base de Datos y Backend Core
- Crear tablas (incluyendo `sms_webhook_config`)
- Endpoints básicos de batches
- Endpoints básicos de templates
- Endpoint de configuración de webhooks

### Fase 2: Frontend - Gestión de Batches
- Página de listado de batches
- Crear batch desde filtros
- Crear batch desde selección manual

### Fase 3: Frontend - SMS Builder
- Editor de templates
- Sistema de variables
- Preview con datos reales

### Fase 4: Integración Webhook (Make.com/Quo)
- Servicio de envío de webhooks
- Formateo de payload
- Manejo de errores y timeouts
- Endpoint de callback para recibir resultados
- Sistema de reintentos

### Fase 5: Frontend - Campañas
- Página de envío
- Dashboard de resultados
- Logs de mensajes
- Configuración de webhooks

### Fase 6: Mejoras y Optimizaciones
- Programación de envíos
- Reintento automático
- Analytics y reportes
- Validación de callbacks
- Webhook health monitoring

---

## 📊 Diagrama de Relaciones

```
┌─────────────┐
│   User      │
└──────┬──────┘
       │
       │ creates
       ▼
┌─────────────┐      ┌──────────────────┐
│  SMS Batch  │◄─────┤ Batch Estimate   │
└──────┬──────┘      └────────┬──────────┘
       │                      │
       │ uses                 │ references
       ▼                      ▼
┌─────────────┐      ┌──────────────────┐
│  Campaign   │      │    Estimate      │
└──────┬──────┘      └──────────────────┘
       │
       │ uses              │ uses
       ▼                   ▼
┌─────────────┐    ┌──────────────────┐
│  Template   │    │ Webhook Config   │
└─────────────┘    └──────────────────┘
       │                   │
       │ generates         │ sends to
       ▼                   ▼
┌─────────────┐    ┌──────────────────┐
│ Message Log │    │  Make.com / Quo  │
└─────────────┘    └────────┬──────────┘
                            │
                            │ callback
                            ▼
                   ┌──────────────────┐
                   │  Callback Handler│
                   │  (Updates status)│
                   └──────────────────┘
```

## 🔄 Flujo de Webhook Detallado

```
┌─────────────────────────────────────────────────────────┐
│  Backend (BotZilla)                                     │
│                                                          │
│  1. Usuario crea campaña                                │
│  2. Renderizar mensajes con variables                   │
│  3. Formatear payload para webhook                      │
│  4. Enviar HTTP POST a Make.com/Quo                     │
│     POST https://hook.make.com/xxxxx                    │
│     Body: { campaign_id, messages: [...] }              │
│  5. Guardar request_id y status = "queued"              │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP POST
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Make.com / Quo                                         │
│                                                          │
│  1. Recibe webhook                                      │
│  2. Procesa cada mensaje                                │
│  3. Envía SMS vía su proveedor                          │
│  4. Recolecta resultados                                │
│  5. Envía callback a BotZilla                           │
│     POST https://botzilla.com/api/sms-campaigns/        │
│          webhook/callback                                │
│     Body: { campaign_id, results: [...] }               │
└─────────────────────────────────────────────────────────┘
                        │
                        │ HTTP POST (Callback)
                        ▼
┌─────────────────────────────────────────────────────────┐
│  Backend (BotZilla) - Callback Handler                  │
│                                                          │
│  1. Valida callback (API key, signature)                │
│  2. Actualiza status de cada mensaje                    │
│  3. Actualiza contadores de campaña                     │
│  4. Guarda logs detallados                              │
│  5. Notifica al usuario (opcional)                      │
└─────────────────────────────────────────────────────────┘
```

## ⚙️ Configuración de Webhooks

### Variables de Entorno

```env
# Make.com Webhook
SMS_WEBHOOK_MAKE_URL=https://hook.make.com/xxxxx
SMS_WEBHOOK_MAKE_API_KEY=your_api_key_here

# Quo Webhook
SMS_WEBHOOK_QUO_URL=https://api.quo.com/webhook/xxxxx
SMS_WEBHOOK_QUO_API_KEY=your_api_key_here

# Callback URL (para Make/Quo)
SMS_CALLBACK_URL=https://botzilla.com/api/sms-campaigns/webhook/callback
SMS_CALLBACK_API_KEY=secure_callback_key

# Timeout y Retry
SMS_WEBHOOK_TIMEOUT=30000  # 30 segundos
SMS_WEBHOOK_MAX_RETRIES=3
SMS_WEBHOOK_RETRY_DELAY=5000  # 5 segundos
```

### Ejemplo de Configuración en BD

```sql
INSERT INTO botzilla.sms_webhook_config (name, provider, webhook_url, api_key, is_active, is_default)
VALUES 
  ('Make.com Production', 'make_com', 'https://hook.make.com/abc123', 'key_xyz', true, true),
  ('Quo Staging', 'quo', 'https://api.quo.com/webhook/def456', 'key_abc', true, false);
```

---

¿Te parece bien esta estructura? ¿Quieres que ajuste algo antes de comenzar la implementación?

