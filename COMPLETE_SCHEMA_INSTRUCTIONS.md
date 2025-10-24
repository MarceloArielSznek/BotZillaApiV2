# 📊 ESTRUCTURA COMPLETA DE BASE DE DATOS - BOTZILLA

**Fecha de generación:** 2025-10-14  
**Base de datos de referencia:** Desarrollo (localhost)  
**Propósito:** Comparación y sincronización con producción  

---

## 🎯 CÓMO USAR ESTE DOCUMENTO

Este paquete contiene la estructura **COMPLETA** de la base de datos de desarrollo para que puedas compararla con producción y agregar las columnas/índices/constraints faltantes.

---

## 📦 ARCHIVOS INCLUIDOS

1. **`COMPLETE_DATABASE_STRUCTURE.sql`** - Script SQL para generar reporte
2. **`COMPLETE_SCHEMA_REPORT.txt`** - Reporte completo generado (léelo para ver estructura actual)
3. **`COMPLETE_SCHEMA_INSTRUCTIONS.md`** - Este archivo (guía de uso)

---

## 🔍 CÓMO COMPARAR CON PRODUCCIÓN

### **PASO 1: Generar Reporte de Producción**

En el servidor de producción, ejecuta:

```bash
psql -U postgres -d botzilla_production -f COMPLETE_DATABASE_STRUCTURE.sql > production_schema_report.txt
```

### **PASO 2: Comparar Reportes**

```bash
# Comparar los dos archivos
diff COMPLETE_SCHEMA_REPORT.txt production_schema_report.txt

# O usar una herramienta visual
vimdiff COMPLETE_SCHEMA_REPORT.txt production_schema_report.txt
```

### **PASO 3: Identificar Diferencias**

Busca líneas con:
- `<` columnas que **SOLO** están en desarrollo (FALTAN en producción)
- `>` columnas que **SOLO** están en producción (EXTRAS, probablemente viejas)

---

## 📋 ESTRUCTURA ESPERADA POR TABLA

A continuación, te proporciono la estructura completa que DEBE existir en producción:

---

### 🔹 **TABLA: `user`**

```sql
CREATE TABLE botzilla.user (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol_id INTEGER REFERENCES botzilla.user_rol(id),
    is_active BOOLEAN DEFAULT true
);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, NOT NULL)
- `email` (character varying, UNIQUE, NOT NULL)
- `password` (character varying, NOT NULL)
- `rol_id` (integer, FOREIGN KEY → user_rol)
- `is_active` (boolean, DEFAULT true)

---

### 🔹 **TABLA: `user_rol`**

```sql
CREATE TABLE botzilla.user_rol (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) UNIQUE NOT NULL
);

-- Roles requeridos:
INSERT INTO botzilla.user_rol (name) VALUES
('admin'),
('user'),
('office_manager'),
('operation manager');  -- ⭐ NUEVO
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, UNIQUE, NOT NULL)

---

### 🔹 **TABLA: `user_branch`**

```sql
CREATE TABLE botzilla.user_branch (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES botzilla.user(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES botzilla.branch(id) ON DELETE CASCADE
);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `user_id` (integer, FOREIGN KEY → user)
- `branch_id` (integer, FOREIGN KEY → branch)

---

### 🔹 **TABLA: `branch`**

```sql
CREATE TABLE botzilla.branch (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, UNIQUE, NOT NULL)

---

### 🔹 **TABLA: `employee`** ⭐ **CRÍTICA - COLUMNA NUEVA**

```sql
CREATE TABLE botzilla.employee (
    id SERIAL PRIMARY KEY,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    phone VARCHAR(20),
    telegram_id VARCHAR(50),
    role VARCHAR(50) NOT NULL,  -- 'crew_member', 'crew_leader', 'salesperson', 'corporate'
    status VARCHAR(20) DEFAULT 'pending',  -- 'pending', 'active', 'rejected'
    branch_id INTEGER REFERENCES botzilla.branch(id),
    registration_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approved_date TIMESTAMP,
    approved_by INTEGER REFERENCES botzilla.user(id),
    address TEXT,
    date_of_birth DATE,
    notes TEXT,
    attic_tech_user_id INTEGER UNIQUE  -- ⭐ NUEVA COLUMNA
);

CREATE INDEX idx_employee_attic_tech_user_id ON botzilla.employee(attic_tech_user_id);  -- ⭐ NUEVO ÍNDICE
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `first_name` (character varying, NOT NULL)
- `last_name` (character varying, NOT NULL)
- `email` (character varying, UNIQUE, NOT NULL)
- `phone` (character varying, NULLABLE)
- `telegram_id` (character varying, NULLABLE)
- `role` (character varying, NOT NULL)
- `status` (character varying, DEFAULT 'pending')
- `branch_id` (integer, FOREIGN KEY → branch)
- `registration_date` (timestamp, DEFAULT now)
- `approved_date` (timestamp, NULLABLE)
- `approved_by` (integer, FOREIGN KEY → user)
- `address` (text, NULLABLE)
- `date_of_birth` (date, NULLABLE)
- `notes` (text, NULLABLE)
- **`attic_tech_user_id` (integer, UNIQUE, NULLABLE)** ⭐ **NUEVA**

**Índices obligatorios:**
- `employee_pkey` (PRIMARY KEY on id)
- `employee_email_key` (UNIQUE on email)
- **`idx_employee_attic_tech_user_id` (INDEX on attic_tech_user_id)** ⭐ **NUEVO**

---

### 🔹 **TABLA: `crew_member`**

```sql
CREATE TABLE botzilla.crew_member (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    telegram_id VARCHAR(50),
    is_leader BOOLEAN DEFAULT false,
    animal VARCHAR(50),
    employee_id INTEGER REFERENCES botzilla.employee(id)
);

CREATE INDEX idx_crew_member_employee_id ON botzilla.crew_member(employee_id);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, NOT NULL)
- `phone` (character varying, NULLABLE)
- `telegram_id` (character varying, NULLABLE)
- `is_leader` (boolean, DEFAULT false)
- `animal` (character varying, NULLABLE)
- `employee_id` (integer, FOREIGN KEY → employee)

---

### 🔹 **TABLA: `sales_person`**

```sql
CREATE TABLE botzilla.sales_person (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    telegram_id VARCHAR(50),
    warning_count INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    employee_id INTEGER REFERENCES botzilla.employee(id)
);

CREATE INDEX idx_sales_person_employee_id ON botzilla.sales_person(employee_id);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, NOT NULL)
- `phone` (character varying, NULLABLE)
- `telegram_id` (character varying, NULLABLE)
- `warning_count` (integer, DEFAULT 0)
- `is_active` (boolean, DEFAULT true)
- `employee_id` (integer, FOREIGN KEY → employee)

---

### 🔹 **TABLA: `job`** ⭐ **CRÍTICA - COLUMNAS NUEVAS**

```sql
CREATE TABLE botzilla.job (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status_id INTEGER REFERENCES botzilla.job_status(id),
    crew_leader_id INTEGER REFERENCES botzilla.crew_member(id),
    branch_id INTEGER REFERENCES botzilla.branch(id),
    estimate_id INTEGER REFERENCES botzilla.estimate(id),
    closing_date TIMESTAMP,
    notification_sent BOOLEAN DEFAULT false,
    
    -- ⭐ NUEVAS COLUMNAS PARA JOB SYNC
    attic_tech_job_id INTEGER UNIQUE,
    attic_tech_estimate_id INTEGER,
    last_known_status_id INTEGER REFERENCES botzilla.job_status(id),
    last_synced_at TIMESTAMP,
    last_notification_sent_at TIMESTAMP
);

-- ⭐ NUEVOS ÍNDICES
CREATE INDEX idx_job_attic_tech_job_id ON botzilla.job(attic_tech_job_id);
CREATE INDEX idx_job_attic_tech_estimate_id ON botzilla.job(attic_tech_estimate_id);
CREATE INDEX idx_job_last_synced_at ON botzilla.job(last_synced_at);
CREATE INDEX idx_job_last_known_status_id ON botzilla.job(last_known_status_id);
CREATE INDEX idx_job_notification_sent ON botzilla.job(notification_sent);
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, NOT NULL)
- `status_id` (integer, FOREIGN KEY → job_status)
- `crew_leader_id` (integer, FOREIGN KEY → crew_member)
- `branch_id` (integer, FOREIGN KEY → branch)
- `estimate_id` (integer, FOREIGN KEY → estimate)
- `closing_date` (timestamp, NULLABLE)
- `notification_sent` (boolean, DEFAULT false)
- **`attic_tech_job_id` (integer, UNIQUE, NULLABLE)** ⭐ **NUEVA**
- **`attic_tech_estimate_id` (integer, NULLABLE)** ⭐ **NUEVA**
- **`last_known_status_id` (integer, FOREIGN KEY → job_status)** ⭐ **NUEVA**
- **`last_synced_at` (timestamp, NULLABLE)** ⭐ **NUEVA**
- **`last_notification_sent_at` (timestamp, NULLABLE)** ⭐ **NUEVA**

**Índices obligatorios:**
- `job_pkey` (PRIMARY KEY on id)
- **`idx_job_attic_tech_job_id` (INDEX)** ⭐ **NUEVO**
- **`idx_job_attic_tech_estimate_id` (INDEX)** ⭐ **NUEVO**
- **`idx_job_last_synced_at` (INDEX)** ⭐ **NUEVO**
- **`idx_job_last_known_status_id` (INDEX)** ⭐ **NUEVO**
- **`idx_job_notification_sent` (INDEX)** ⭐ **NUEVO**

---

### 🔹 **TABLA: `job_status`**

```sql
CREATE TABLE botzilla.job_status (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL
);

-- ⭐ ESTADOS REQUERIDOS (9 estados oficiales de Attic Tech)
INSERT INTO botzilla.job_status (name) VALUES
('Requires Scheduling'),
('Requires Crew Lead'),
('Plans In Progress'),
('In Production'),
('Production Complete'),
('Closed Job'),
('Cancelled'),
('On Hold'),
('Pending Review')
ON CONFLICT (name) DO NOTHING;
```

**Columnas obligatorias:**
- `id` (integer, PRIMARY KEY)
- `name` (character varying, UNIQUE, NOT NULL)

**Datos obligatorios:**
- Al menos 9 estados listados arriba

---

### 🔹 **TABLA: `estimate`**

```sql
CREATE TABLE botzilla.estimate (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255),
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    customer_address TEXT,
    sales_person_id INTEGER REFERENCES botzilla.sales_person(id),
    branch_id INTEGER REFERENCES botzilla.branch(id),
    status_id INTEGER REFERENCES botzilla.estimate_status(id),
    attic_tech_estimate_id INTEGER UNIQUE,
    attic_tech_hours DECIMAL(10,2),
    price DECIMAL(10,2),
    final_price DECIMAL(10,2),
    crew_notes TEXT,
    -- ... (más columnas según tu schema)
);
```

**Nota:** Esta tabla puede tener más columnas. Revisa el reporte completo.

---

## 🚨 COLUMNAS CRÍTICAS QUE DEBEN EXISTIR EN PRODUCCIÓN

### **Prioridad ALTA (si faltan, el sistema NO funcionará):**

1. ✅ `employee.attic_tech_user_id` - Para sync con Attic Tech
2. ✅ `job.attic_tech_job_id` - Para sync de jobs
3. ✅ `job.attic_tech_estimate_id` - Para vincular jobs
4. ✅ `job.last_known_status_id` - Para detectar cambios de estado
5. ✅ `job.last_synced_at` - Para tracking de sincronización
6. ✅ `job.last_notification_sent_at` - Para evitar notificaciones duplicadas
7. ✅ `job.notification_sent` - Flag de notificación enviada

### **Prioridad MEDIA:**

8. ✅ Rol "operation manager" en `user_rol`
9. ✅ 9 estados en `job_status`

---

## 🔧 SCRIPT DE VERIFICACIÓN RÁPIDA

Usa este script en producción para verificar las columnas críticas:

```sql
-- Verificar employee.attic_tech_user_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'employee' 
            AND column_name = 'attic_tech_user_id'
        ) THEN '✅ employee.attic_tech_user_id EXISTS'
        ELSE '❌ employee.attic_tech_user_id MISSING'
    END;

-- Verificar job.attic_tech_job_id
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'job' 
            AND column_name = 'attic_tech_job_id'
        ) THEN '✅ job.attic_tech_job_id EXISTS'
        ELSE '❌ job.attic_tech_job_id MISSING'
    END;

-- Verificar job.last_synced_at
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'job' 
            AND column_name = 'last_synced_at'
        ) THEN '✅ job.last_synced_at EXISTS'
        ELSE '❌ job.last_synced_at MISSING'
    END;

-- Verificar rol operation manager
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM botzilla.user_rol 
            WHERE name = 'operation manager'
        ) THEN '✅ operation manager role EXISTS'
        ELSE '❌ operation manager role MISSING'
    END;

-- Verificar cantidad de job statuses
SELECT 
    COUNT(*) as total_statuses,
    CASE 
        WHEN COUNT(*) >= 9 THEN '✅ All 9 statuses present'
        ELSE '❌ Missing job statuses'
    END as validation
FROM botzilla.job_status;
```

---

## 📝 SI ENCUENTRAS COLUMNAS FALTANTES

Si al comparar encuentras que **faltan columnas** en producción, usa las migraciones SQL que ya preparamos:

1. `add_operation_manager_role.sql` - Para el rol
2. `add_attic_tech_user_id_to_employee.sql` - Para employee
3. `add_sync_fields_to_job.sql` - Para job (la más importante)

O ejecuta los `ALTER TABLE` manualmente basándote en las estructuras de este documento.

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Todas las tablas existen
- [ ] `employee.attic_tech_user_id` existe
- [ ] `job.attic_tech_job_id` existe
- [ ] `job.attic_tech_estimate_id` existe
- [ ] `job.last_known_status_id` existe
- [ ] `job.last_synced_at` existe
- [ ] `job.last_notification_sent_at` existe
- [ ] `job.notification_sent` existe
- [ ] Rol "operation manager" existe
- [ ] 9 job statuses existen
- [ ] Todos los índices existen
- [ ] Todas las foreign keys existen

---

**¡Usa este documento como referencia completa para sincronizar producción!** 🚀

