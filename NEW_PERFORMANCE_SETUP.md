# New Performance System - Setup Guide

## 🎯 Objetivo
Sistema para trackear shifts diarios desde BuilderTrend (Attic MS SQL DB) usando los **nombres de branches de BotZilla** como referencia principal.

---

## 📋 Paso 1: Migración de Base de Datos

### Ejecutar migración SQL:

```bash
psql -h 127.0.0.1 -U postgres -d postgres -f backend/src/migrations/add_attic_branch_id_to_branches.sql
```

Esta migración agrega la columna `attic_branch_id` a la tabla `branch`.

---

## 🔗 Paso 2: Mapear Branches de BotZilla a Attic

### Ver branches de Attic:

**GET** `/api/new-performance/attic-branches`

Respuesta ejemplo:
```json
{
  "success": true,
  "data": {
    "branches": [
      { "branch_id": 1, "branch_desc": "San Diego", "branch_short_name": "SD" },
      { "branch_id": 2, "branch_desc": "Orange County", "branch_short_name": "OC" },
      { "branch_id": 3, "branch_desc": "Los Angeles", "branch_short_name": "LA" },
      { "branch_id": 4, "branch_desc": "San Bernardino", "branch_short_name": "SB" },
      { "branch_id": 5, "branch_desc": "Kent", "branch_short_name": "KT" },
      { "branch_id": 6, "branch_desc": "Everett", "branch_short_name": "EV" }
    ]
  }
}
```

### Actualizar mapeo en PostgreSQL:

```sql
-- Mapear branches de BotZilla a Attic
-- Ajusta los IDs según tu BD

UPDATE botzilla.branch SET attic_branch_id = 1 WHERE name = 'San Diego';
UPDATE botzilla.branch SET attic_branch_id = 2 WHERE name = 'Orange County';
UPDATE botzilla.branch SET attic_branch_id = 3 WHERE name = 'Los Angeles';
UPDATE botzilla.branch SET attic_branch_id = 4 WHERE name = 'San Bernardino';
UPDATE botzilla.branch SET attic_branch_id = 5 WHERE name = 'Kent';
UPDATE botzilla.branch SET attic_branch_id = 6 WHERE name = 'Everett';
```

**Verificar:**
```sql
SELECT id, name, attic_branch_id FROM botzilla.branch ORDER BY name;
```

---

## 🚀 Paso 3: Uso de la API

### Endpoints disponibles:

#### 1. **GET /api/new-performance/branches**
Obtener branches de BotZilla con sus mappings a Attic.

**Response:**
```json
{
  "success": true,
  "data": {
    "branches": [
      {
        "id": 1,
        "name": "San Diego",
        "attic_branch_id": 1,
        "address": "123 Main St"
      }
    ]
  }
}
```

---

#### 2. **GET /api/new-performance/shifts?date=YYYY-MM-DD&branch_id=X**
Obtener shifts de una fecha específica.

**Query Params:**
- `date` (required): `2025-11-25`
- `branch_id` (optional): ID del **branch de BotZilla** (no de Attic)

**Ejemplo:**
```bash
GET /api/new-performance/shifts?date=2025-11-25&branch_id=1
```

El backend convierte automáticamente `branch_id=1` (San Diego en BotZilla) a `attic_branch_id=1` (San Diego en Attic).

---

#### 3. **GET /api/new-performance/shifts/range**
Shifts en un rango de fechas.

**Query Params:**
- `from_date` (required): `2025-11-20`
- `to_date` (required): `2025-11-25`
- `branch_id` (optional): ID del branch de BotZilla

**Ejemplo:**
```bash
GET /api/new-performance/shifts/range?from_date=2025-11-20&to_date=2025-11-25&branch_id=1
```

---

#### 4. **GET /api/new-performance/closed-jobs**
Jobs cerrados en un rango de fechas.

**Query Params:**
- `from_date` (required)
- `to_date` (required)
- `branch_id` (optional): ID del branch de BotZilla

---

#### 5. **POST /api/new-performance/sync-daily-shifts**
Sincronizar shifts diarios (guardar en BD de BotZilla).

**Body:**
```json
{
  "date": "2025-11-25",
  "branch_id": 1
}
```

---

## 🔧 Flujo Completo

### Escenario: Usuario quiere ver shifts de San Diego del 20-25 Nov

1. **Frontend** hace GET `/api/new-performance/branches`
   - Obtiene: `{ id: 1, name: "San Diego", attic_branch_id: 1 }`

2. **Usuario selecciona** "San Diego" (id=1) y rango de fechas

3. **Frontend** hace:
   ```
   GET /api/new-performance/shifts/range?from_date=2025-11-20&to_date=2025-11-25&branch_id=1
   ```

4. **Backend**:
   - Busca branch con `id=1` en BotZilla
   - Obtiene `attic_branch_id=1`
   - Consulta Attic DB con `branch_id=1`
   - Retorna shifts

---

## 💾 Formato de Respuesta de Shifts

```json
{
  "success": true,
  "data": {
    "from_date": "2025-11-20",
    "to_date": "2025-11-25",
    "total_shifts": 150,
    "shifts": [
      {
        "branch_id": 1,
        "branch_desc": "San Diego",
        "branch_short_name": "SD",
        "job_gk": 12345,
        "job_name": "John Doe Residence",
        "job_id": "J-2024-001",
        "job_status": "Open",
        "employee_name": "Marcelo Rodriguez",
        "report_date": "2025-11-25T00:00:00.000Z",
        "clocked_in_at": "2025-11-25T08:00:00.000Z",
        "clocked_out_at": "2025-11-25T17:00:00.000Z",
        "regular_time": 480,
        "minutes_overtime": 60,
        "minutes_double_overtime": 0,
        "Actual_Reg_Hrs": 8.0,
        "Actual_OT_Hrs": 1.0,
        "Actual_double_OT_Hrs": 0.0,
        "total_minutes": 540,
        "total_hours": 9.0
      }
    ],
    "grouped_by_job": {
      "12345_John Doe Residence": {
        "job_gk": 12345,
        "job_name": "John Doe Residence",
        "job_id": "J-2024-001",
        "job_status": "Open",
        "branch_id": 1,
        "branch_name": "San Diego",
        "employees": {
          "Marcelo Rodriguez": {
            "employee_name": "Marcelo Rodriguez",
            "shifts": [
              {
                "report_date": "2025-11-25T00:00:00.000Z",
                "clocked_in_at": "2025-11-25T08:00:00.000Z",
                "clocked_out_at": "2025-11-25T17:00:00.000Z",
                "regular_hours": 8.0,
                "overtime_hours": 1.0,
                "double_overtime_hours": 0.0,
                "total_hours": 9.0
              }
            ],
            "total_hours": 9.0
          }
        }
      }
    }
  }
}
```

---

## ⚠️ Errores Comunes

### Error: "Branch does not have attic_branch_id configured"
**Solución:** Ejecutar el UPDATE SQL del Paso 2 para mapear el branch.

### Error: "MS SQL connection pool is not available"
**Solución:** Verificar variables en `.env`:
```env
MSSQL_HOST=attic-datalake.c7kiyyaoqxhb.us-west-1.rds.amazonaws.com
MSSQL_PORT=1433
MSSQL_USER=dwh_read
MSSQL_PASSWORD=Att1c2024!
MSSQL_DATABASE=AtticBI_DWH
MSSQL_ENCRYPT=true
```

### Error: "Date is required"
**Solución:** Enviar fecha en formato `YYYY-MM-DD` (ej: `2025-11-25`).

---

## ✅ Checklist de Setup

- [ ] Ejecutar migración SQL
- [ ] Mapear branches (UPDATE SQL)
- [ ] Verificar mapeo (SELECT)
- [ ] Probar endpoint `/attic-branches`
- [ ] Probar endpoint `/branches` (con mapping)
- [ ] Probar `/shifts` con fecha y branch
- [ ] Probar `/shifts/range` con rango
- [ ] Probar `/closed-jobs`

---

## 📊 Ventajas de Este Enfoque

✅ **Frontend usa nombres de BotZilla** - No necesita saber IDs de Attic
✅ **Backend hace el mapping** - Transparente para el frontend
✅ **Único punto de verdad** - Tabla `branch` de BotZilla
✅ **Sin duplicación** - No crear branches nuevos
✅ **Flexible** - Fácil actualizar mapeo si cambian IDs en Attic

---

**¿Listo para producción?**
1. Correr migración
2. Mapear branches
3. ✅ Listo!

