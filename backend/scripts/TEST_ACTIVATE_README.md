# 🧪 Test Script: Activate Employee

Script interactivo para testear el endpoint de activación de empleados.

## 📋 Requisitos

- Backend corriendo en `http://localhost:3000`
- Usuario con permisos de admin/office_manager
- (Opcional) `jq` instalado para formatear JSON: `brew install jq`
- (Opcional) `psql` para verificar la BD

## 🚀 Uso

### Ejecutar el script:

```bash
cd backend/scripts
./testActivateEmployee.sh
```

### El script te pedirá:

1. **Credenciales de login:**
   - Email
   - Password

2. **Datos del empleado:**
   - Employee ID (ej: `45`)
   - Rol final (Crew Member, Crew Leader, Sales Person)
   - Branch IDs (ej: `1,2,3`)
   - Animal (solo para crew members)
   - Telegram Group IDs (ej: `5,7,9`)

3. **(Opcional) Verificación en BD:**
   - Database name
   - Database user

## 📸 Ejemplo de Uso

```bash
$ ./testActivateEmployee.sh

================================
  Test: Activate Employee
================================

📝 Ingresa tus credenciales:
Email: admin@botzilla.com
Password: ********

🔐 Autenticando...
✅ Login exitoso!
Token: eyJhbGciOiJIUzI1Ni...

👤 Datos del empleado a activar:
Employee ID: 45

Selecciona el rol final:
1) Crew Member
2) Crew Leader
3) Sales Person
Opción (1-3): 2

Branch IDs (separados por comas, ej: 1,2,3):
Branches: 1,2

Selecciona un animal:
1) Lion
2) Tiger
3) Bear
...
Opción (1-8): 1

Telegram Group IDs (separados por comas, ej: 5,7,9):
Groups: 5,7

🚀 Activando empleado...

Payload enviado:
{
  "final_role": "crew_leader",
  "branches": [1, 2],
  "is_leader": true,
  "animal": "Lion",
  "telegram_groups": [5, 7]
}

✅ Empleado activado exitosamente!

Respuesta del servidor:
{
  "success": true,
  "message": "Employee Carlos Crewman activated successfully as crew_leader.",
  "data": {
    "employee_id": 45,
    "new_record_id": 123,
    "role": "crew_leader",
    "branches": [1, 2],
    "telegram_groups": [5, 7]
  }
}

📊 ¿Querés verificar los cambios en la base de datos? (y/n)
> y

...
```

## 🔧 Troubleshooting

### Error: "Command not found: jq"
El script funciona sin `jq`, solo se verá menos bonito el JSON.

Para instalarlo:
```bash
brew install jq
```

### Error: "Connection refused"
Asegurate de que el backend esté corriendo:
```bash
cd backend
npm run dev
```

### Error: "Login failed"
Verifica que las credenciales sean correctas y que el usuario tenga permisos de admin.

## 📝 Notas

- El script es **idempotente** (pero solo si el employee sigue en estado `pending`)
- Si ya activaste un employee, no podés volverlo a activar
- El webhook de Telegram se dispara automáticamente si `MAKE_MEMBERSHIP_WEBHOOK_URL` está configurado
- Los logs del webhook se pueden ver en `backend/logs/combined-YYYY-MM-DD.log`

## 🧹 Limpiar Test

Si querés volver a testear el mismo employee:

```sql
-- 1. Eliminar de crew_member o sales_person
DELETE FROM botzilla.crew_member WHERE employee_id = 45;
-- o
DELETE FROM botzilla.sales_person WHERE employee_id = 45;

-- 2. Eliminar de crew_member_branch o sales_person_branch
DELETE FROM botzilla.crew_member_branch WHERE crew_member_id = 123;
-- o
DELETE FROM botzilla.sales_person_branch WHERE sales_person_id = 123;

-- 3. Eliminar grupos asignados
DELETE FROM botzilla.employee_telegram_group WHERE employee_id = 45;

-- 4. Volver employee a pending
UPDATE botzilla.employee 
SET status = 'pending', approved_by = NULL, approved_date = NULL 
WHERE id = 45;
```

