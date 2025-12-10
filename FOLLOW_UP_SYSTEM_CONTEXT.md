# 🎯 Sistema de Follow-Up - Documentación Completa para Agentes

## 📋 Resumen Ejecutivo

El **Sistema de Follow-Up** es un módulo completo para gestionar el seguimiento de estimates "Lost" (perdidos). Permite al equipo de ventas hacer follow-up con clientes que no cerraron, categorizarlos, asignar responsables y mantener un historial de conversaciones.

**Fecha de implementación**: Noviembre 2025  
**Commits principales**: `8a0e65f`, `3ad7140`, `618eebb`  
**Status**: ✅ En producción  

---

## 🏗️ Arquitectura del Sistema

### Base de Datos (5 tablas)

```
┌─────────────────────┐
│  estimate           │
│  ├─ id              │
│  └─ follow_up_ticket_id ←──┐
└─────────────────────┘       │
                              │
┌─────────────────────────────┴───────┐
│  follow_up_ticket                   │
│  ├─ id (PK)                         │
│  ├─ estimate_id (FK → estimate)     │
│  ├─ status_id (FK → follow_up_status)│
│  ├─ label_id (FK → follow_up_label) │
│  ├─ chat_id (FK → chat)             │
│  ├─ followed_up (boolean)           │
│  ├─ follow_up_date                  │
│  ├─ assigned_to (FK → user)         │
│  └─ notes (text)                    │
└─────────────────────────────────────┘
         │      │      │
         │      │      └─────────────┐
         │      │                    │
         │      └─────────┐          │
         │                │          │
         ▼                ▼          ▼
┌────────────────┐ ┌─────────────┐ ┌──────────────┐
│follow_up_status│ │follow_up_   │ │   chat       │
│ ├─ Lost        │ │   label     │ │ ├─ id        │
│ ├─ Sold        │ │ ├─ PMP      │ │ └─ messages[]│
│ └─ Negotiating │ │ ├─ Discount │ └──────────────┘
└────────────────┘ │ └─ Other    │         │
                   └─────────────┘         │
                                           ▼
                                  ┌─────────────────┐
                                  │  chat_message   │
                                  │ ├─ id           │
                                  │ ├─ chat_id      │
                                  │ ├─ user_id      │
                                  │ ├─ message      │
                                  │ └─ created_at   │
                                  └─────────────────┘
```

#### Tabla: `follow_up_ticket`
```sql
CREATE TABLE follow_up_ticket (
    id SERIAL PRIMARY KEY,
    estimate_id INTEGER NOT NULL REFERENCES estimate(id),
    status_id INTEGER REFERENCES follow_up_status(id),
    label_id INTEGER REFERENCES follow_up_label(id),
    chat_id INTEGER REFERENCES chat(id),
    followed_up BOOLEAN DEFAULT false,
    follow_up_date TIMESTAMP,
    assigned_to INTEGER REFERENCES "user"(id),
    notes TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: `follow_up_status`
Valores predefinidos:
- **Lost** - Customer decided not to proceed (color: #EF4444)
- **Sold** - Customer accepted and purchased (color: #10B981)
- **Negotiating** - Follow-up in progress (color: #F59E0B)

#### Tabla: `follow_up_label`
Valores predefinidos:
- **PMP** - Price Match Promise follow-up (color: #3B82F6)
- **Discount** - Discount offer follow-up (color: #8B5CF6)
- **Other** - Other type of follow-up (color: #6B7280)

#### Tabla: `chat`
```sql
CREATE TABLE chat (
    id SERIAL PRIMARY KEY,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);
```

#### Tabla: `chat_message`
```sql
CREATE TABLE chat_message (
    id SERIAL PRIMARY KEY,
    chat_id INTEGER NOT NULL REFERENCES chat(id),
    user_id INTEGER REFERENCES "user"(id),
    message TEXT NOT NULL,
    is_internal BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 🎨 Frontend

### Ubicación de archivos
```
frontend/src/
├── pages/
│   └── FollowUpEstimates.tsx          # Página principal (/follow-up/estimates)
├── components/
│   ├── followUp/
│   │   └── FollowUpTicketModal.tsx    # Modal de gestión de tickets
│   └── estimates/
│       └── EstimateDetailsModal.tsx   # Modal mejorado con info de follow-up
└── services/
    └── followUpTicketService.ts       # Servicio API para tickets
```

### Página: `FollowUpEstimates.tsx`

**Ruta**: `/follow-up/estimates`

**Funcionalidad**:
- Lista SOLO estimates con status "Lost"
- Tabla con columnas:
  - Name (nombre del cliente)
  - Branch
  - Salesperson
  - Final Price
  - Discount
  - Details (muestra Effective Multiplier si aplica)
  - Dates (AT Created / AT Updated)
  - Actions (botón de ticket 💬, view details, export)
- Filtros: Search, Branch, Salesperson, Date Range
- Paginación
- Integración con modal de Follow-Up Ticket

**Características clave**:
```typescript
// Usa endpoint específico para Lost estimates
const response = await estimateService.fetchLostEstimates(params);

// Muestra Effective Multiplier solo si difiere significativamente
{effectiveMultiplier && Math.abs(effectiveMultiplier - theoreticalMultiplier) > 0.05 && (
  <Chip label={`Eff. Mult: ${effectiveMultiplier.toFixed(2)}x`} />
)}
```

### Modal: `FollowUpTicketModal.tsx`

**Funcionalidad**:
- Editar Status (dropdown: Lost / Sold / Negotiating)
- Editar Label (dropdown: PMP / Discount / Other)
- Asignar usuario responsable
- Follow-up date picker
- Campo de notas internas
- **Chat integrado**:
  - Ver historial de mensajes
  - Enviar nuevos mensajes
  - Auto-scroll a último mensaje
  - Identificación de usuario que envió cada mensaje
- Botón "Save" que guarda todos los cambios

**Props**:
```typescript
interface FollowUpTicketModalProps {
  open: boolean;
  onClose: () => void;
  estimate: Estimate | null;
  onSave?: () => void;
}
```

**Flujo de datos**:
1. Al abrir: `loadTicketData()` obtiene ticket existente o crea uno nuevo
2. Usuario edita campos, escribe mensajes
3. Al guardar: `handleSave()` actualiza ticket + `handleSendMessage()` envía mensajes
4. Cierra modal y refresca lista

---

## ⚙️ Backend

### Ubicación de archivos
```
backend/src/
├── models/
│   ├── FollowUpTicket.js
│   ├── FollowUpStatus.js
│   ├── FollowUpLabel.js
│   ├── Chat.js
│   └── ChatMessage.js
├── controllers/
│   ├── followUpTickets.controller.js
│   ├── estimates.controller.js        # Modificado
│   └── automations.controller.js      # Modificado
└── routes/
    └── followUpTickets.routes.js
```

### Controller: `followUpTickets.controller.js`

**Métodos disponibles**:

#### 1. `getTicketByEstimateId(req, res)`
```javascript
GET /api/follow-up-tickets/estimate/:estimateId
```
Retorna el ticket asociado al estimate (o null si no existe).

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 123,
    "estimate_id": 456,
    "status_id": 1,
    "label_id": 2,
    "followed_up": false,
    "follow_up_date": "2025-12-01T10:00:00Z",
    "assigned_to": 5,
    "notes": "Cliente interesado en PMP",
    "status": { "id": 1, "name": "Lost" },
    "label": { "id": 2, "name": "Discount" },
    "chat": { "id": 789, "messages": [...] },
    "assignedUser": { "id": 5, "email": "john@example.com" }
  }
}
```

#### 2. `updateTicket(req, res)`
```javascript
PUT /api/follow-up-tickets/:id
```
Actualiza campos del ticket (status, label, notes, etc.).

**Request body**:
```json
{
  "status_id": 2,
  "label_id": 1,
  "followed_up": true,
  "follow_up_date": "2025-12-15",
  "assigned_to": 3,
  "notes": "Follow-up completado"
}
```

#### 3. `getOrCreateChat(req, res)`
```javascript
GET /api/follow-up-tickets/:ticketId/chat
```
Obtiene el chat del ticket o crea uno nuevo si no existe.

#### 4. `addMessageToChat(req, res)`
```javascript
POST /api/follow-up-tickets/:ticketId/chat/messages
```
Agrega un mensaje al chat del ticket.

**Request body**:
```json
{
  "message": "Cliente confirmó interés, seguir en contacto",
  "is_internal": true
}
```

#### 5. `getAllStatuses(req, res)`
```javascript
GET /api/follow-up-tickets/statuses
```
Lista todos los estados disponibles (Lost, Sold, Negotiating).

#### 6. `getAllLabels(req, res)`
```javascript
GET /api/follow-up-tickets/labels
```
Lista todas las etiquetas disponibles (PMP, Discount, Other).

---

### Auto-creación de Tickets

**Ubicación**: `automations.controller.js` (método `saveEstimatesToDb`)

Cuando se sincronizan estimates desde Attic Tech:
1. Si un estimate tiene status "Lost"
2. Y NO tiene `follow_up_ticket_id` asociado
3. Se crea automáticamente un `FollowUpTicket` con:
   ```javascript
   {
     estimate_id: estimate.id,
     status_id: lostStatusId,
     followed_up: false,
     chat_id: newChatId  // Se crea un chat vacío
   }
   ```

**Código relevante**:
```javascript
// Función helper
async function autoCreateFollowUpTicket(estimate, lostStatusId) {
    const newChat = await Chat.create({});
    const newTicket = await FollowUpTicket.create({
        estimate_id: estimate.id,
        status_id: lostStatusId,
        followed_up: false,
        chat_id: newChat.id
    });
    await estimate.update({ follow_up_ticket_id: newTicket.id });
    return newTicket;
}

// Se llama durante sync de estimates
if (estimate.EstimateStatus?.name === 'Lost' && !estimate.follow_up_ticket_id) {
    await autoCreateFollowUpTicket(estimate, lostStatus.id);
}
```

---

## 🔄 Flujo de Datos Completo

### Escenario 1: Usuario abre modal de Follow-Up

```
1. Usuario hace click en botón 💬 en /follow-up/estimates
   ↓
2. Frontend llama: GET /api/follow-up-tickets/estimate/:estimateId
   ↓
3. Backend busca ticket existente
   ├─ Si existe: retorna ticket completo (con chat, status, label)
   └─ Si no existe: retorna null
   ↓
4. Frontend muestra modal:
   ├─ Si hay ticket: prellenado con datos
   └─ Si no hay: formulario vacío con defaults
   ↓
5. Usuario edita campos, escribe mensaje
   ↓
6. Usuario click "Save"
   ↓
7. Frontend hace 2 llamadas en paralelo:
   ├─ PUT /api/follow-up-tickets/:id (actualizar ticket)
   └─ POST /api/follow-up-tickets/:id/chat/messages (enviar mensaje)
   ↓
8. Backend actualiza BD y retorna success
   ↓
9. Frontend cierra modal y refresca lista
```

### Escenario 2: Sync de estimates crea tickets automáticamente

```
1. Trigger: Manual sync o Make.com ejecuta
   POST /api/automations/estimates/sync-external
   ↓
2. Backend consulta Attic Tech API por estimates
   ↓
3. Para cada estimate:
   ├─ Guardar/actualizar en BD
   ├─ Si status = "Lost" Y no tiene follow_up_ticket_id:
   │  ├─ Crear nuevo Chat (vacío)
   │  ├─ Crear nuevo FollowUpTicket
   │  │  └─ status_id: "Lost"
   │  │  └─ followed_up: false
   │  │  └─ chat_id: chat recién creado
   │  └─ Actualizar estimate.follow_up_ticket_id
   └─ Continuar con siguiente estimate
   ↓
4. Retornar resumen: X estimates synced, Y tickets created
```

---

## 🎯 Casos de Uso Principales

### 1. Ver todos los Lost estimates con follow-up pendiente
```typescript
// Frontend
const response = await estimateService.fetchLostEstimates({
  page: 1,
  limit: 50
});
// Solo retorna estimates con status "Lost"
```

### 2. Gestionar un ticket de follow-up
```typescript
// Obtener ticket
const ticket = await followUpTicketService.getTicketByEstimateId(estimateId);

// Actualizar
await followUpTicketService.updateTicket(ticket.id, {
  status_id: 2,  // Cambiar a "Sold"
  followed_up: true,
  notes: "Cliente aceptó oferta con descuento"
});

// Agregar mensaje
await followUpTicketService.addMessageToChat(ticket.id, {
  message: "Contacté al cliente, mostró interés",
  is_internal: true
});
```

### 3. Asignar ticket a un vendedor
```typescript
await followUpTicketService.updateTicket(ticketId, {
  assigned_to: userId,
  follow_up_date: "2025-12-10T14:00:00Z"
});
```

---

## 🔧 Configuración y Setup

### Variables de entorno requeridas
```bash
# .env (backend)
ATTIC_TECH_API_TOKEN=your_token_here
ATTIC_TECH_BASE_URL=https://api.attictech.com
AUTOMATION_API_KEY=your_automation_key
```

### Migración de BD
```bash
# Ya ejecutada en producción, pero para referencia:
psql -h <HOST> -U <USER> -d <DB> \
  -f backend/src/migrations/PROD_MIGRATION_MASTER_COMPLETE.sql
```

La sección relevante está en **SECTION 5** del archivo de migración.

### Verificar instalación
```sql
-- Verificar tablas
SELECT table_name FROM information_schema.tables 
WHERE table_name IN (
  'follow_up_ticket',
  'follow_up_status', 
  'follow_up_label',
  'chat',
  'chat_message'
);
-- Debe retornar 5 filas

-- Verificar datos iniciales
SELECT * FROM follow_up_status;  -- Lost, Sold, Negotiating
SELECT * FROM follow_up_label;   -- PMP, Discount, Other

-- Ver tickets existentes
SELECT COUNT(*) FROM follow_up_ticket;
```

---

## 🐛 Troubleshooting Común

### Problema 1: "No configurations found" en Branch Configuration
**Causa**: Los branches no tienen `attic_tech_branch_id` poblado.

**Solución**:
```sql
-- Opción A: Actualizar desde estimates existentes
UPDATE branch b
SET attic_tech_branch_id = e.at_branch_id
FROM estimate e
WHERE e.branch_id = b.id
  AND e.at_branch_id IS NOT NULL
  AND b.attic_tech_branch_id IS NULL;

-- Opción B: Sincronizar estimates primero
curl -X POST "http://localhost:3000/api/automations/estimates/sync-external" \
  -H "x-api-key: <KEY>" \
  -d '{"startDate": "2025-11-01", "endDate": "2025-11-24"}'
```

### Problema 2: Modal de ticket no carga
**Causa**: Error en la API o ticket no existe.

**Debug**:
```javascript
// En DevTools Console
const estimateId = 123;
const response = await fetch(`/api/follow-up-tickets/estimate/${estimateId}`, {
  headers: { 'Authorization': `Bearer ${token}` }
});
console.log(await response.json());
```

### Problema 3: Chat no muestra mensajes
**Causa**: El ticket no tiene `chat_id` asociado.

**Solución**:
```sql
-- Verificar
SELECT id, chat_id FROM follow_up_ticket WHERE id = <ticket_id>;

-- Si chat_id es NULL, crear uno:
WITH new_chat AS (
  INSERT INTO chat DEFAULT VALUES RETURNING id
)
UPDATE follow_up_ticket 
SET chat_id = (SELECT id FROM new_chat)
WHERE id = <ticket_id>;
```

### Problema 4: "Column at_multiplier_range_id does not exist"
**Causa**: Desincronización entre modelo Sequelize y BD.

**Solución**: Ya corregido en commit `618eebb`. Pull latest y reiniciar backend.

---

## 📊 Métricas y Análisis

### Queries útiles

```sql
-- Tickets por status
SELECT 
    fs.name as status,
    COUNT(*) as cantidad
FROM follow_up_ticket ft
JOIN follow_up_status fs ON ft.status_id = fs.id
GROUP BY fs.name;

-- Tickets sin seguimiento
SELECT COUNT(*) as pendientes
FROM follow_up_ticket
WHERE followed_up = false;

-- Tickets asignados por usuario
SELECT 
    u.email,
    COUNT(*) as tickets_asignados
FROM follow_up_ticket ft
JOIN "user" u ON ft.assigned_to = u.id
WHERE ft.followed_up = false
GROUP BY u.email;

-- Estimates Lost con ticket vs sin ticket
SELECT 
    COUNT(*) FILTER (WHERE follow_up_ticket_id IS NOT NULL) as con_ticket,
    COUNT(*) FILTER (WHERE follow_up_ticket_id IS NULL) as sin_ticket
FROM estimate e
JOIN estimate_status es ON e.status_id = es.id
WHERE es.name = 'Lost';

-- Efectividad de follow-ups (Lost → Sold)
SELECT 
    COUNT(*) FILTER (WHERE ft.status_id = (SELECT id FROM follow_up_status WHERE name = 'Sold')) * 100.0 / 
    COUNT(*) as porcentaje_conversion
FROM follow_up_ticket ft;
```

---

## 🚀 Endpoints de API (Resumen)

### Follow-Up Tickets
```
GET    /api/follow-up-tickets/estimate/:estimateId  # Obtener ticket por estimate
PUT    /api/follow-up-tickets/:id                   # Actualizar ticket
GET    /api/follow-up-tickets/statuses              # Listar statuses
GET    /api/follow-up-tickets/labels                # Listar labels
GET    /api/follow-up-tickets/:ticketId/chat        # Obtener/crear chat
POST   /api/follow-up-tickets/:ticketId/chat/messages  # Agregar mensaje
```

### Estimates (Follow-Up relacionado)
```
GET    /api/estimates/lost                          # Listar solo Lost estimates
GET    /api/estimates/:id                           # Detalle incluye ticket info
```

### Automations (Auto-creación)
```
POST   /api/automations/estimates/sync-external    # Sync + auto-crear tickets
```

**Autenticación**: Todos los endpoints requieren JWT token (excepto automations que usa API key).

---

## 📁 Archivos Importantes

### Para entender el sistema:
- `FOLLOW_UP_SYSTEM_CONTEXT.md` (este archivo)
- `EFFECTIVE_MULTIPLIER_GUIDE.md` - Cálculo de multiplier efectivo
- `ESTIMATE_COST_BREAKDOWN_ANALYSIS.md` - Análisis de pricing

### Para deploy:
- `DEPLOY_TO_PRODUCTION.md` - Guía completa de deploy
- `INSTRUCCIONES_PARA_AGENTE_PROD.md` - Instrucciones paso a paso
- `backend/src/migrations/PROD_MIGRATION_MASTER_COMPLETE.sql` - Migración SQL

### Para rollback:
- `backend/src/migrations/ROLLBACK_COMPLETE.sql` - Rollback de emergencia

---

## 🔍 Testing

### Test manual en frontend:

1. **Navegación**:
   - Ir a `/follow-up/estimates`
   - Verificar que solo muestra estimates "Lost"

2. **Modal de ticket**:
   - Click en botón 💬
   - Modal debe abrir con formulario
   - Seleccionar status "Negotiating"
   - Seleccionar label "PMP"
   - Escribir mensaje "Test message"
   - Click "Save"
   - Reabrir modal → cambios deben persistir

3. **Chat**:
   - Escribir varios mensajes
   - Verificar que aparecen en orden
   - Verificar timestamp y autor

4. **Filtros**:
   - Filtrar por branch
   - Filtrar por salesperson
   - Búsqueda por nombre de cliente

### Test en backend:

```bash
# Get ticket by estimate
curl -H "Authorization: Bearer <TOKEN>" \
  http://localhost:3000/api/follow-up-tickets/estimate/123

# Update ticket
curl -X PUT \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"status_id": 2, "notes": "Test update"}' \
  http://localhost:3000/api/follow-up-tickets/456

# Add message
curl -X POST \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"message": "Test message", "is_internal": true}' \
  http://localhost:3000/api/follow-up-tickets/456/chat/messages
```

---

## 💡 Tips para el Nuevo Agente

### Cuando trabajes con este sistema:

1. **Estimates vs Tickets**: Son entidades relacionadas pero separadas.
   - `estimate` = Dato de Attic Tech (cliente, precio, branch)
   - `follow_up_ticket` = Dato interno (seguimiento, notas, chat)

2. **Auto-creación**: Los tickets se crean automáticamente durante sync.
   - No necesitas crearlos manualmente
   - Si un Lost estimate no tiene ticket, ejecuta sync

3. **Status vs Label**:
   - **Status**: Estado del seguimiento (Lost/Sold/Negotiating)
   - **Label**: Categoría de oferta (PMP/Discount/Other)

4. **Chat interno**: Los mensajes son para comunicación interna del equipo.
   - NO se envían al cliente automáticamente
   - Son notas/recordatorios para el equipo de ventas

5. **Effective Multiplier**: Es un cálculo que muestra el multiplier real después de descuentos.
   - Se calcula en backend (`estimates.controller.js`)
   - Se muestra en frontend solo si difiere del teórico

6. **Relación bidireccional**:
   ```
   estimate.follow_up_ticket_id → FollowUpTicket.id
   FollowUpTicket.estimate_id → estimate.id
   ```
   Ambas foreign keys existen para facilitar queries.

---

## 🎓 Conceptos Clave

### Effective Multiplier
Multiplier real que se aplicó al estimate considerando descuentos y sub-services:
```javascript
effectiveMultiplier = 
  (retailPrice / paymentMethodFactor - subRetailCost) / trueCostNonSub
```

### True Cost
Costo base antes de aplicar multipliers:
- **True Cost Non-Sub**: Material + Labor (sin sub-services)
- **True Cost Total**: Material + Labor + Sub services

### Sub Services
Servicios con multiplicador especial (ej: warranty, instalación):
- Se suman AL retail price, no se multiplican por el multiplier general

### Payment Method Factor
Factor adicional según método de pago:
- Cash: 1.00 (sin recargo)
- Credit: 1.065 (6.5% recargo)
- Financing: varía según términos
- Check: 1.00

---

## 🔗 Relaciones con Otros Módulos

### Estimates Module
- Provee los datos base (cliente, precio, branch)
- Follow-Up extiende funcionalidad para Lost estimates

### Branch Configuration
- Determina multipliers aplicables
- Afecta cálculo de Effective Multiplier

### Mailchimp Export
- Integrado en `/follow-up/estimates`
- Permite exportar Lost estimates con filtros

### User Management
- Asignación de tickets a usuarios
- Autoría de mensajes en chat

---

## 📞 Preguntas Frecuentes para el Nuevo Agente

**Q: ¿Cómo sé si un estimate tiene ticket?**  
A: Verifica `estimate.follow_up_ticket_id !== null`

**Q: ¿Puedo crear un ticket manualmente desde la API?**  
A: Sí, pero no es recomendado. El sistema los crea automáticamente durante sync.

**Q: ¿Qué pasa si elimino un estimate?**  
A: El ticket se elimina automáticamente (CASCADE en FK).

**Q: ¿Los mensajes del chat se envían al cliente?**  
A: No, son internos. Para contactar al cliente usa otro sistema (email, phone).

**Q: ¿Puedo cambiar un estimate de Lost a Sold desde el modal?**  
A: No. El modal cambia el STATUS del TICKET (seguimiento interno).  
Para cambiar el status del ESTIMATE, usa el modal principal de estimates.

**Q: ¿Cómo funciona `followed_up`?**  
A: Es un boolean que marca si ya se hizo seguimiento.  
True = ya se contactó, False = pendiente de contactar.

**Q: ¿Qué es `is_internal` en chat_message?**  
A: Reservado para futuro. Permite distinguir mensajes internos vs externos.  
Por ahora todos son internos.

---

## ✅ Checklist de Funcionalidad Completa

- [x] Base de datos (5 tablas creadas)
- [x] Modelos Sequelize (5 modelos)
- [x] Controller backend (6 métodos)
- [x] Routes backend (6 endpoints)
- [x] Página frontend (/follow-up/estimates)
- [x] Modal de ticket con chat
- [x] Auto-creación durante sync
- [x] Integración con estimates
- [x] Filtros y búsqueda
- [x] Paginación
- [x] Export a Mailchimp
- [x] Effective Multiplier display
- [x] Testing funcional
- [x] Documentación completa
- [x] Deploy a producción

---

## 🎉 Estado Actual

**✅ EN PRODUCCIÓN**

- Commit: `618eebb` (último fix)
- Fecha: Noviembre 24, 2025
- Todos los tickets se crean automáticamente para Lost estimates
- Modal funcional con chat integrado
- Branch configuration sincronizada
- Sin errores conocidos

---

**Última actualización**: Noviembre 24, 2025  
**Autor**: Claude (Anthropic)  
**Para**: Grok / Nuevo Agente  
**Contacto del proyecto**: Marcelo





