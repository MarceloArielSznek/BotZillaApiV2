# 🔧 Fix: Crew Leader ID Reference

## 🎯 Problema

El campo `Job.crew_leader_id` apuntaba a la tabla `crew_member`, pero los crew leaders de Attic Tech se sincronizan primero a la tabla `employee` con estado `pending`.

**Esto causaba que:**
- ❌ Jobs no se asignaban a crew leaders pendientes de aprobación
- ❌ No se enviaban alertas de registro
- ❌ El sistema esperaba que el crew leader ya existiera en `crew_member`

## ✅ Solución

Cambiar la foreign key de `crew_leader_id` para que apunte a la tabla `employee` en lugar de `crew_member`.

**Esto permite:**
- ✅ Asignar jobs a empleados que aún están en estado `pending`
- ✅ Enviar alertas inmediatas cuando un crew leader sin `telegram_id` recibe un job
- ✅ El flujo natural: Employee (pending) → Employee (active) → CrewMember (si aplica)

---

## 📋 Pasos para Aplicar

### 1. **Ejecutar Migración en Producción**

```bash
# Conectarse a la BD de producción
psql -h your-db-host -U your-db-user -d your-db-name

# Ejecutar la migración
\i backend/src/migrations/fix_crew_leader_id_reference.sql

# Verificar
\d botzilla.job
# Deberías ver: crew_leader_id references employee(id)
```

### 2. **Reiniciar Backend**

```bash
pm2 restart botzilla-backend
```

### 3. **Verificar**

```bash
# Ejecutar sync
curl -X POST https://your-domain.com/api/job-sync/sync-jobs \
  -H "X-API-KEY: your-key"

# Ver logs
pm2 logs botzilla-backend --lines 50
```

**Deberías ver:**
```
✅ Crew Leader encontrado en Employee (pendiente de aprobación): Marce test user (marcelo.sznek@gmail.com)
🔔 Escenario 2: Crew Leader asignado a job existente en "Plans In Progress"
⚠️  Crew Leader "Marce test user" no tiene telegram_id. Enviando alerta de registro...
```

---

## 🔍 Lo que Hace la Migración

1. **Elimina** la foreign key existente (`job_crew_leader_id_fkey`)
2. **Limpia** cualquier `crew_leader_id` que apunte a IDs inexistentes en `employee`
3. **Crea** nueva foreign key apuntando a `employee(id)`
4. **Agrega** índice para mejor rendimiento
5. **Documenta** el cambio con un comentario en la columna

---

## ⚠️ Consideraciones

### Seguridad
- La migración usa `ON DELETE SET NULL` para evitar errores si se elimina un empleado
- Usa `ON UPDATE CASCADE` para mantener integridad si cambia el ID

### Performance
- Se crea un índice en `crew_leader_id` para mejorar queries

### Rollback (si es necesario)
```sql
-- Volver atrás (NO recomendado)
ALTER TABLE botzilla.job DROP CONSTRAINT job_crew_leader_id_fkey;
ALTER TABLE botzilla.job
ADD CONSTRAINT job_crew_leader_id_fkey
  FOREIGN KEY (crew_leader_id)
  REFERENCES botzilla.crew_member(id)
  ON DELETE SET NULL;
```

---

## 📊 Impacto

### Jobs Existentes
- Jobs con `crew_leader_id = NULL` → No hay cambios
- Jobs con `crew_leader_id` válido en `employee` → Funciona correctamente
- Jobs con `crew_leader_id` inválido → Se setea a NULL (limpieza automática)

### Flujo Futuro
```
1. Crew leader asignado en AT
2. Sync detecta cambio
3. Busca crew leader en Employee (incluso si está pending)
4. Asigna crew_leader_id = Employee.id
5. Si no tiene telegram_id → Envía alerta
6. Si tiene telegram_id → Genera notificación
```

---

## 🧪 Testing

### Caso 1: Crew Leader Pending (Sin telegram_id)
```sql
-- Setup
INSERT INTO botzilla.employee (first_name, last_name, email, status)
VALUES ('Test', 'Leader', 'test@example.com', 'pending');

-- Asignar en AT y ejecutar sync
-- Resultado esperado:
-- ✅ Job.crew_leader_id = Employee.id
-- ✅ Webhook de alerta enviado
```

### Caso 2: Crew Leader Activo (Con telegram_id)
```sql
-- Setup
UPDATE botzilla.employee
SET telegram_id = '123456789', status = 'active'
WHERE email = 'test@example.com';

INSERT INTO botzilla.crew_member (employee_id, name, telegram_id, is_leader)
VALUES (98, 'Test Leader', '123456789', true);

-- Asignar en AT y ejecutar sync
-- Resultado esperado:
-- ✅ Job.crew_leader_id = Employee.id
-- ✅ Notificación generada
```

---

## 📝 Cambios en Código

### `backend/src/models/Job.js`
```javascript
crew_leader_id: {
  type: DataTypes.INTEGER,
  allowNull: true,
  references: {
    model: 'employee', // ← Cambiado de 'crew_member'
    key: 'id'
  }
}
```

### `backend/src/controllers/jobSync.controller.js`
```javascript
// Ahora busca en Employee si no encuentra en CrewMember
async function findCrewLeader(assignedCrew) {
  // 1. Buscar en CrewMember (aprobados)
  let crewLeader = await CrewMember.findOne({ ... });
  
  // 2. Buscar en Employee (pendientes)
  if (!crewLeader) {
    crewLeader = await Employee.findOne({ ... });
  }
  
  return crewLeader;
}
```

---

**Fecha:** Octubre 16, 2025  
**Versión:** 1.0  
**Estado:** ✅ Listo para Aplicar en Producción


