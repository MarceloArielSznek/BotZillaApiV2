# New Performance System

## Overview

El **New Performance System** es una evolución del sistema de Performance actual que permite:

1. ✅ **Tracking diario de shifts**: Importar shifts día a día mientras los jobs están activos
2. ✅ **Shifts individuales con fecha**: Cada shift mantiene su fecha específica (no se agregan)
3. ✅ **Detección de jobs cerrados**: Buscar jobs que se cerraron en un rango de fechas
4. ✅ **Conexión directa a Attic DB**: Consulta en tiempo real a la base de datos de BuilderTrend/Attic

---

## Arquitectura

### Backend

#### 1. **MS SQL Connection** (`backend/src/config/mssql.js`)
- Configuración de conexión a la base de datos MS SQL Server de Attic
- Pool de conexiones reutilizable
- Variables de entorno en `.env`:
  ```bash
  MSSQL_HOST=attic-datalake.c7kiyyaoqxhb.us-west-1.rds.amazonaws.com
  MSSQL_PORT=1433
  MSSQL_USER=dwh_read
  MSSQL_PASSWORD=Att1c2024!
  MSSQL_DATABASE=AtticBI_DWH
  MSSQL_ENCRYPT=true
  ```

#### 2. **Attic Service** (`backend/src/services/attic.service.js`)
Servicio para consultar la base de datos de Attic. Métodos disponibles:

- `getShiftsByDate(date, branchId?)` - Obtener shifts de una fecha específica
- `getShiftsByDateRange(fromDate, toDate, branchId?)` - Shifts en un rango de fechas
- `getClosedJobsByDateRange(fromDate, toDate, branchId?)` - Jobs cerrados en un rango
- `getBranches()` - Obtener todos los branches de Attic
- `getJobByGk(jobGk)` - Información de un job específico
- `searchJobsByName(jobName, branchId?)` - Buscar jobs por nombre

**Tablas consultadas en Attic DB:**
- `dbo.fact_time_clock` - Shifts con fecha, horas, crew member
- `dbo.dim_jobsite` - Información de jobs (nombre, status, etc.)
- `dbo.dim_attic_branch` - Branches
- `dbo.fact_invoice_items` - Revenue y fechas de pago

#### 3. **New Performance Controller** (`backend/src/controllers/newPerformance.controller.js`)
Controlador con endpoints:

- `GET /api/new-performance/shifts?date=YYYY-MM-DD&branch_id=X`
- `GET /api/new-performance/shifts/range?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&branch_id=X`
- `GET /api/new-performance/closed-jobs?from_date=YYYY-MM-DD&to_date=YYYY-MM-DD&branch_id=X`
- `POST /api/new-performance/sync-daily-shifts` (body: `{ date, branch_id }`)
- `GET /api/new-performance/attic-branches`

#### 4. **Routes** (`backend/src/routes/newPerformance.routes.js`)
Rutas protegidas con autenticación y rol (admin, office_manager)

---

## Estructura de Datos de Attic

### fact_time_clock (Shifts)
```javascript
{
  branch_id: 1,
  branch_desc: "San Diego",
  job_gk: 12345,
  job_name: "John Doe Residence",
  job_id: "J-2024-001",
  job_status: "Open" | "Closed",
  employee_name: "Marcelo Rodriguez", // name field in DB
  report_date: "2025-11-25", // Fecha del shift
  clocked_in_at: "2025-11-25T08:00:00",
  clocked_out_at: "2025-11-25T17:00:00",
  regular_time: 480, // minutos
  minutes_overtime: 60, // minutos
  minutes_double_overtime: 0,
  Actual_Reg_Hrs: 8.0, // horas decimales
  Actual_OT_Hrs: 1.0,
  Actual_double_OT_Hrs: 0.0,
  total_minutes: 540,
  total_hours: 9.0
}
```

### dim_jobsite (Jobs)
```javascript
{
  job_gk: 12345,
  job_id: "J-2024-001",
  job_name: "John Doe Residence",
  job_status: "Open" | "Closed",
  branch_id: 1,
  date_opened: "2024-10-15",
  street: "123 Main St",
  city: "San Diego",
  state: "CA",
  zip: "92101"
}
```

### fact_invoice_items (Revenue)
```javascript
{
  job_gk: 12345,
  invoice_id: "INV-001",
  total_with_tax: 15000.00, // Total del job
  paid_date: "2025-11-20", // Fecha de pago
  balance: 0.00
}
```

---

## Diferencias con Performance Actual

| Aspecto | Performance Actual | New Performance |
|---------|-------------------|-----------------|
| **Origen de datos** | Excel BuilderTrend + Spreadsheet Make.com | Directo desde Attic DB (MS SQL) |
| **Frecuencia** | Manual, cuando job se cierra | Diaria, mientras job está activo |
| **Shifts** | Agregados (1 shift total por crew member) | Individuales con fecha específica |
| **Campo fecha** | No existe | `report_date` individual por shift |
| **Matching** | Manual via modal | Automático via `job_gk` |
| **Flujo** | Fetch spreadsheet → Upload Excel → Match → Send back | Fetch shifts diarios → Detect closed jobs |

---

## Próximos Pasos (Pending)

### 1. **Decisión sobre almacenamiento de shifts**

**Opción A:** Modificar tabla `shift` actual
- Agregar campo `date` (tipo DATE)
- Cambiar PK de `(crew_member_id, job_id)` a `(crew_member_id, job_id, date)`
- ⚠️ **Riesgo**: Puede afectar datos existentes

**Opción B:** Crear tabla `daily_shift` nueva (RECOMENDADO)
- Tabla independiente para New Performance
- No afecta sistema actual
- Esquema:
  ```sql
  CREATE TABLE botzilla.daily_shift (
    id SERIAL PRIMARY KEY,
    job_id INTEGER REFERENCES botzilla.job(id),
    employee_id INTEGER REFERENCES botzilla.employee(id),
    date DATE NOT NULL,
    regular_hours DECIMAL(10,2),
    overtime_hours DECIMAL(10,2),
    double_overtime_hours DECIMAL(10,2),
    total_hours DECIMAL(10,2) NOT NULL,
    job_gk BIGINT, -- Referencia a Attic
    synced_from_attic BOOLEAN DEFAULT true,
    approved BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(job_id, employee_id, date)
  );
  ```

### 2. **Frontend - New Performance Tab**

Crear tab en `Jobs` página con sub-tabs:
- **Daily Sync**: Importar shifts del día
- **Closed Jobs**: Ver jobs cerrados y sus shifts acumulados
- **History**: Ver shifts históricos por job

Componentes necesarios:
- `frontend/src/pages/NewPerformance.tsx`
- `frontend/src/services/newPerformanceService.ts`
- `frontend/src/components/DailyShiftSync.tsx`
- `frontend/src/components/ClosedJobsDetection.tsx`

### 3. **Testing**

- Test de conexión a MS SQL
- Test de queries a Attic DB
- Test de endpoints de API
- Test de UI en frontend

---

## Uso del Sistema

### Backend: Consultar shifts de ayer

```bash
curl -X GET "http://localhost:3000/api/new-performance/shifts?date=2025-11-24" \
  -H "Authorization: Bearer <token>"
```

### Backend: Consultar jobs cerrados la semana pasada

```bash
curl -X GET "http://localhost:3000/api/new-performance/closed-jobs?from_date=2025-11-18&to_date=2025-11-24" \
  -H "Authorization: Bearer <token>"
```

### Frontend: Cargar shifts diarios

```typescript
import newPerformanceService from '../services/newPerformanceService';

const shifts = await newPerformanceService.getShiftsByDate('2025-11-24');
```

---

## Roadmap

- [x] Setup MS SQL connection
- [x] Create Attic service with queries
- [x] Create New Performance API endpoints
- [ ] Decide on daily_shift table structure
- [ ] Create migration for daily_shift table
- [ ] Create DailyShift model
- [ ] Implement save logic in controller
- [ ] Create frontend New Performance tab
- [ ] Test end-to-end flow
- [ ] Document for production deployment

---

## Support

Para cualquier duda sobre el New Performance System, consultar:
- `attic_sql_context.md` - Documentación de la BD de Attic
- `PERFORMANCE_FEATURE_README.md` - Sistema actual de Performance

---

**Last Updated:** November 25, 2025  
**Status:** 🚧 In Development

