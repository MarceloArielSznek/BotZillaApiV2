# Feature: Delivery Drop Special Shift

## Descripción

Se agregó soporte para el tag "Delivery Drop" en Performance, funcionando igual que QC:
- Cuando se detecta un crew member con tag "Delivery Drop", se ignora al crew member
- Se crea automáticamente un special shift de **3 horas** por defecto
- Las horas se pueden modificar desde el frontend si es necesario

---

## Implementación

### 1. Detección del Tag

**Archivo**: `backend/src/utils/timeConverter.js`

Nueva función `hasDeliveryDropTag`:
```javascript
function hasDeliveryDropTag(tagsStr) {
    if (!tagsStr || tagsStr.trim() === '') {
        return false;
    }
    // Buscar "Delivery Drop" (case insensitive)
    const deliveryDropPattern = /Delivery\s+Drop/i;
    return deliveryDropPattern.test(tagsStr);
}
```

### 2. Parseo del Excel

**Archivo**: `backend/src/services/builderTrendParser.service.js`

Se agregó la detección de "Delivery Drop" al parsear el Excel:
```javascript
// Detectar Delivery Drop
shift.is_delivery_drop = hasDeliveryDropTag(shift.tags);

// Log detallado para debugging
if (shift.is_delivery_drop) {
    logger.info('📦 DELIVERY DROP TAG DETECTED IN EXCEL', {
        crew_member: shift.crew_member_name,
        job: shift.job_name_raw,
        tags: shift.tags,
        is_delivery_drop: shift.is_delivery_drop
    });
}
```

### 3. Guardado del Special Shift

**Archivo**: `backend/src/services/performancePersistence.service.js`

#### Función Genérica para Special Shifts

Se refactorizó la lógica de QC en una función genérica `saveSpecialShift` que funciona para cualquier tipo de special shift:
```javascript
async function saveSpecialShift(jobId, specialShiftName, hours, autoApprove = false) {
    // Buscar el Special Shift por nombre
    const specialShift = await SpecialShift.findOne({
        where: { name: specialShiftName }
    });
    
    // Crear o actualizar el job_special_shift
    // ...
}
```

#### Funciones Específicas

```javascript
async function saveQCSpecialShift(jobId, hours, autoApprove = false) {
    return saveSpecialShift(jobId, 'QC', hours, autoApprove);
}

async function saveDeliveryDropSpecialShift(jobId, hours, autoApprove = false) {
    return saveSpecialShift(jobId, 'Delivery Drop', hours, autoApprove);
}
```

#### Lógica en savePerformanceDataPermanently

```javascript
// Detectar Delivery Drop
const isDeliveryDrop = modifiedShifts 
    ? shift.tags?.match(/Delivery\s+Drop/i) 
    : shift.is_delivery_drop;

// Si el shift tiene tag Delivery Drop, contarlo pero no crear shift regular
if (isDeliveryDrop) {
    const deliveryDropHours = modifiedShifts ? totalHours : 3;
    deliveryDropShiftsCount += deliveryDropHours;
    continue; // Skip regular shift creation
}

// ... después de guardar shifts regulares ...

// Si hay shifts Delivery Drop, crear Special Shift
if (deliveryDropShiftsCount > 0) {
    const deliveryDropHours = modifiedShifts 
        ? deliveryDropShiftsCount 
        : (deliveryDropShiftsCount * 3);
    await saveDeliveryDropSpecialShift(savedJob.id, deliveryDropHours, autoApprove);
}
```

---

## Prerequisito en Base de Datos

**IMPORTANTE**: Asegúrate de que existe un registro en la tabla `special_shift` con el nombre "Delivery Drop".

### Verificar si existe:

```sql
SELECT * FROM botzilla.special_shift WHERE name = 'Delivery Drop';
```

### Si NO existe, crearlo:

```sql
INSERT INTO botzilla.special_shift (name, description, created_at, updated_at)
VALUES (
    'Delivery Drop',
    'Special shift for delivery drop tasks',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
);
```

---

## Comportamiento

### Desde el Excel (BuilderTrend):

1. **Tag detectado**: "Delivery Drop" (case insensitive)
2. **Horas asignadas**: 3 horas por defecto (por cada crew member con este tag)
3. **Resultado**: Se crea un `job_special_shift` de tipo "Delivery Drop" con el total de horas

### Desde el Frontend (Performance Approval):

1. **Crew member marcado** con tag "Delivery Drop"
2. **Horas editables**: El usuario puede especificar las horas reales trabajadas
3. **Resultado**: Se crea un `job_special_shift` con las horas especificadas

---

## Logs Relevantes

### Cuando se detecta en Excel:
```
[INFO] 📦 DELIVERY DROP TAG DETECTED IN EXCEL
Meta: {
  "crew_member": "Matt Hatcher-Mays",
  "job": "Jeff Riggio - TAC",
  "tags": "Delivery Drop",
  "is_delivery_drop": true
}
```

### Cuando se procesa:
```
[INFO] ✅ DELIVERY DROP SHIFT DETECTED - WILL CREATE SPECIAL SHIFT
Meta: {
  "job_name": "Jeff Riggio - TAC",
  "crew_member": "Matt Hatcher-Mays",
  "hours": 3,
  "tags": "Delivery Drop"
}
```

### Cuando se crea el special shift:
```
[INFO] 🚀 CREATING DELIVERY DROP SPECIAL SHIFT
Meta: {
  "job_id": 123,
  "job_name": "Jeff Riggio - TAC",
  "delivery_drop_shifts_count": 1,
  "total_delivery_drop_hours": 3,
  "auto_approve": true
}

[INFO] ✅ DELIVERY DROP SPECIAL SHIFT CREATED SUCCESSFULLY
Meta: {
  "job_id": 123,
  "job_name": "Jeff Riggio - TAC",
  "delivery_drop_shifts_count": 1,
  "total_delivery_drop_hours": 3
}
```

---

## Archivos Modificados

- ✅ `backend/src/utils/timeConverter.js` - Nueva función `hasDeliveryDropTag`
- ✅ `backend/src/services/builderTrendParser.service.js` - Detección de Delivery Drop
- ✅ `backend/src/services/performancePersistence.service.js` - Lógica de guardado y función genérica

---

## Testing

### Escenario 1: Excel con Delivery Drop

1. Subir un Excel con un crew member que tenga tag "Delivery Drop"
2. Verificar en los logs que se detecta correctamente
3. Aprobar el job
4. Verificar en `job_special_shift` que se creó el registro con 3 horas

### Escenario 2: Frontend con horas custom

1. Subir Performance
2. En la interfaz, marcar un shift con tag "Delivery Drop" y especificar horas (ej: 5)
3. Aprobar
4. Verificar que se creó el special shift con las 5 horas especificadas

---

**Autor**: AI Assistant  
**Fecha**: 2025-10-30  
**Versión**: 1.0

