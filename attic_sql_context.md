# Attic / Time & Jobs SQL Context

This file describes the SQL Server schema and provides example queries so an AI agent (in Cursor) can generate new queries and help build a JS front‑end that reports on time‑clock data and job revenue.

## General info

- **DB engine:** Microsoft SQL Server
- **Schema:** `dbo`
- All queries should be valid **T‑SQL**.
- Prefer **read‑only** queries: `SELECT` with `JOIN`, aggregates, `GROUP BY`, filters, and ordering.
- Do **not** modify data (`INSERT`, `UPDATE`, `DELETE`) unless the user explicitly asks for it.

---

## Tables

### 1. `dbo.dim_attic_branch`

**Purpose:** Dimension table for company branches (offices).

**Key columns (known):**

- `branch_id` (int, PK) – unique ID of the branch.
- `branch_desc` (varchar(100)) – full branch name / description.
- `branch_short_name` (varchar(10)) – short code / abbreviation.
- `Sort_order` (int, null) – optional field used for ordering branches in reports.

Use this table whenever a query needs to show the **branch name** instead of just `branch_id`.

---

### 2. `dbo.fact_time_clock`

**Purpose:** Fact table storing time‑clock / shifts information per job and employee.

**Key columns (known):**

- `job_gk` (bigint, null) – foreign key to `dim_jobsite.job_gk` (job).
- `branch_id` (int, null) – foreign key to `dim_attic_branch.branch_id`.
- `name` (varchar(100), null) – tech / employee name.
- `report_date` (date or datetime, null) – date of the time entry (the "work date").
- `clocked_in_at` (datetime, null) – time the employee clocked in.
- `clocked_out_at` (datetime, null) – time the employee clocked out.
- `break_time` (int, null) – break time in minutes (if used).
- `regular_time` (int, null) – regular time in minutes.
- `minutes_overtime` (int, null) – overtime minutes.
- `Actual_Reg_Hrs` (real, null) – regular hours in decimal.
- `Actual_OT_Hrs` (real, null) – overtime hours in decimal.
- `minutes_double_overtime` (int, null) – double OT minutes (if used).
- `Actual_double_OT_Hrs` (real, null) – double OT hours (decimal).
- `calculate_actual_hours` (real, null) – pre‑computed hours (if used).
- `dw_load_date` (datetime, null) – ETL load date.

**Notes for the agent:**

- When the user wants **shifts / hours worked**, this is typically the main fact table.
- Often we need to compute **total time in hours** as:  
  `(regular_time + minutes_overtime) / 60.0` (decimal hours).
- Always try to join with `dim_attic_branch` to show the branch name, and with `dim_jobsite` to show job information.

---

### 3. `dbo.dim_jobsite`

**Purpose:** Dimension table for jobs / jobsites.

**Key columns (known):**

- `job_gk` (bigint, null) – primary key used to link to facts.
- `branch_id` (int, null) – foreign key to `dim_attic_branch.branch_id`.
- `job_id` (varchar(50), null) – external / human job ID.
- `job_name` (varchar(100), null) – readable job name.
- `starting_price` (float, null) – optional base price.
- `template` (varchar(100), null) – template identifier.
- `template_name` (varchar(100), null) – template name.
- `is_sample_job` (varchar(100), null) – flags test/sample jobs if used.
- `street` (varchar(1000), null) – address.
- `city` (varchar(50), null)
- `state` (varchar(50), null)
- `zip` (varchar(20), null)
- Other address/metadata fields (lot, permit, notes, default_color, etc.).
- `job_status` (varchar(50), null) – status such as `Closed`, `Open`, etc.
- `date_opened` (datetime, null)
- `projected_start_date`, `projected_end_date`, etc. (if present).

**Notes for the agent:**

- Use `job_status` to filter **closed jobs** or other statuses.
- Use `job_name` and/or `job_id` for display in the front‑end.
- Joins:
  - `dim_jobsite` ↔ `fact_time_clock` via `job_gk`.
  - `dim_jobsite` ↔ `fact_invoice_items` via `job_gk`.
  - `dim_jobsite` ↔ `dim_attic_branch` via `branch_id`.

---

### 4. `dbo.fact_invoice_items`

**Purpose:** Fact table for invoice line items and job revenue.

**Key columns (known):**

- `job_gk` (bigint, null) – foreign key to `dim_jobsite.job_gk`.
- `branch_id` (int, null) – foreign key to `dim_attic_branch.branch_id`.
- `job_id` (varchar(50), null) – external job ID (optional alt link).
- `invoice_id` (varchar(50), null) – invoice identifier.
- `custom_invoice_id` (varchar(50), null) – custom invoice ID.
- `title` (varchar(1000), null) – line item title/description.
- `amount` (real, null) – base amount of the line.
- `amount_paid` (real, null)
- `balance` (real, null)
- `due_date` (datetime, null)
- `paid_date` (date or datetime, null) – when the invoice/line got paid.
- `quantity` (real, null)
- `unit_cost` (real, null)
- `owner_price` (real, null)
- `base_cost` (real, null)
- `total_with_tax` (real, null) – total revenue for that line **including tax**.
- `tax_amount` (int, null)
- Other metadata like `added_by_name`, `released_by_name`, `CostCode`, etc.

**Notes for the agent:**

- Use `total_with_tax` to compute **job totals**.
- Use `paid_date` to determine **when a job was effectively paid/closed**.
- To get **total per job**, sum `total_with_tax` grouped by `job_gk` (and optionally `branch_id`).

---

## Relationships summary

For clarity, these are the most important relationships:

- `dbo.dim_attic_branch.branch_id`  
  ↔ `dbo.fact_time_clock.branch_id`  
  ↔ `dbo.dim_jobsite.branch_id`  
  ↔ `dbo.fact_invoice_items.branch_id`

- `dbo.dim_jobsite.job_gk`  
  ↔ `dbo.fact_time_clock.job_gk`  
  ↔ `dbo.fact_invoice_items.job_gk`

Use these joins in almost every reporting query.

Example join patterns:

```sql
-- Time clock with branch & job info
FROM dbo.fact_time_clock       AS t
INNER JOIN dbo.dim_attic_branch AS b ON t.branch_id = b.branch_id
LEFT  JOIN dbo.dim_jobsite      AS j ON t.job_gk   = j.job_gk;

-- Revenue with job & branch info
FROM dbo.fact_invoice_items    AS i
INNER JOIN dbo.dim_jobsite      AS j ON i.job_gk   = j.job_gk
INNER JOIN dbo.dim_attic_branch AS b ON j.branch_id = b.branch_id;
```

---

## Core example queries

### 1. Shifts de ayer ordenados por branch (con horas decimales y job_name)

**Descripción:**  
Devuelve todos los shifts del día anterior, con el nombre de la branch, el nombre del job y el total de horas trabajadas (regular + overtime) en formato decimal.

```sql
SELECT 
    b.branch_id,
    b.branch_desc,
    j.job_name,
    t.job_gk,
    t.name,
    t.report_date,
    t.clocked_in_at,
    t.clocked_out_at,
    t.regular_time,
    t.minutes_overtime,
    (t.regular_time + t.minutes_overtime)        AS total_minutes,
    (t.regular_time + t.minutes_overtime) / 60.0 AS total_hours
FROM dbo.fact_time_clock       AS t
INNER JOIN dbo.dim_attic_branch AS b
    ON t.branch_id = b.branch_id
LEFT JOIN dbo.dim_jobsite       AS j
    ON t.job_gk = j.job_gk
WHERE 
    CAST(t.report_date AS date) = CAST(DATEADD(day, -1, GETDATE()) AS date)
ORDER BY 
    b.branch_desc ASC,
    t.clocked_in_at ASC;
```

**Notas:**

- `total_hours` es decimal (ej.: 150 minutos → 2.5 horas).
- Útil para un front‑end que muestre una tabla de shifts, agrupada/ordenada por branch.

---

### 2. Jobs cerrados la semana pasada con su total y branch

**Descripción:**  
Muestra todos los jobs con `job_status = 'Closed'` cuya factura (o ítems de factura) fueron pagados durante los últimos 7 días. Calcula el total del job sumando `total_with_tax` de todos sus invoice items, y devuelve también la branch.

```sql
SELECT
    b.branch_desc,
    j.branch_id,
    j.job_gk,
    j.job_id,
    j.job_name,
    j.job_status,
    SUM(i.total_with_tax) AS job_total_with_tax,
    MAX(i.paid_date)      AS last_paid_date
FROM dbo.dim_jobsite       AS j
INNER JOIN dbo.fact_invoice_items AS i
    ON j.job_gk = i.job_gk
INNER JOIN dbo.dim_attic_branch   AS b
    ON j.branch_id = b.branch_id
WHERE
    -- Solo jobs cerrados
    j.job_status = 'Closed'
    
    -- Pagos dentro de los últimos 7 días (semana "móvil")
    AND CAST(i.paid_date AS date) >= DATEADD(day, -7, CAST(GETDATE() AS date))
    AND CAST(i.paid_date AS date) <  CAST(GETDATE() AS date)
GROUP BY
    b.branch_desc,
    j.branch_id,
    j.job_gk,
    j.job_id,
    j.job_name,
    j.job_status
ORDER BY
    b.branch_desc,
    last_paid_date DESC,
    j.job_name;
```

**Notas:**

- `job_total_with_tax` es el total del job (suma de todos los ítems).
- `last_paid_date` se usa para saber cuándo se terminó de pagar el job.
- Puede servir para dashboards de producción / revenue por branch y por periodo.

---

## Guidelines for the AI agent (Cursor)

When the user asks for something, the agent should:

1. **Identify which measure is needed:**
   - Hours worked → use `fact_time_clock`.
   - Jobs, statuses, addresses → use `dim_jobsite`.
   - Revenue, totals, paid amounts → use `fact_invoice_items`.
   - Branch names or grouping by office → use `dim_attic_branch`.

2. **Build SELECT queries** that:
   - Include proper `JOIN`s based on the relationships above.
   - Use `WHERE` clauses for date ranges (e.g., yesterday, last week, current month).
   - Use `GROUP BY` when the user wants totals per job, per branch, per tech, etc.
   - Use readable aliases (`AS b`, `AS j`, `AS t`, `AS i`) and column aliases for front‑end labels.

3. **Prefer computed columns for readability**, for example:
   - `total_hours` for hours in decimal.
   - `job_total_with_tax` for the job revenue.
   - `last_paid_date` for the latest payment date per job.

4. **Keep queries safe and simple** for direct execution from a JS front‑end API layer.
