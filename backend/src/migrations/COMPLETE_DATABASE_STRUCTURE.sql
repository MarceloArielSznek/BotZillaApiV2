-- ============================================================================
-- ESTRUCTURA COMPLETA DE BASE DE DATOS - BOTZILLA
-- Generado: 2025-10-14
-- Propósito: Verificación y comparación de schema entre desarrollo y producción
-- ============================================================================

-- ============================================================================
-- SECCIÓN 1: LISTADO DE TODAS LAS TABLAS
-- ============================================================================

\echo '============================================================================'
\echo 'TODAS LAS TABLAS EN SCHEMA BOTZILLA'
\echo '============================================================================'

SELECT 
    table_name,
    (SELECT COUNT(*) FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_schema = 'botzilla' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;

\echo ''

-- ============================================================================
-- SECCIÓN 2: TODAS LAS COLUMNAS DE TODAS LAS TABLAS
-- ============================================================================

\echo '============================================================================'
\echo 'DETALLE DE COLUMNAS POR TABLA'
\echo '============================================================================'
\echo ''

SELECT 
    table_name,
    column_name,
    data_type,
    CASE WHEN character_maximum_length IS NOT NULL 
         THEN data_type || '(' || character_maximum_length || ')' 
         ELSE data_type 
    END as full_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla'
ORDER BY table_name, ordinal_position;

\echo ''
\echo '============================================================================'
\echo 'DETALLE ESPECÍFICO POR TABLA'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- TABLA: user
-- ============================================================================
\echo '--- TABLE: user ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'user'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: user_rol
-- ============================================================================
\echo '--- TABLE: user_rol ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'user_rol'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: user_branch
-- ============================================================================
\echo '--- TABLE: user_branch ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'user_branch'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: branch
-- ============================================================================
\echo '--- TABLE: branch ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'branch'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: employee
-- ============================================================================
\echo '--- TABLE: employee ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'employee'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: crew_member
-- ============================================================================
\echo '--- TABLE: crew_member ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'crew_member'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: crew_member_branch
-- ============================================================================
\echo '--- TABLE: crew_member_branch ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'crew_member_branch'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: sales_person
-- ============================================================================
\echo '--- TABLE: sales_person ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'sales_person'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: sales_person_branch
-- ============================================================================
\echo '--- TABLE: sales_person_branch ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'sales_person_branch'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: telegram_group
-- ============================================================================
\echo '--- TABLE: telegram_group ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'telegram_group'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: telegram_group_category
-- ============================================================================
\echo '--- TABLE: telegram_group_category ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'telegram_group_category'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: employee_telegram_group
-- ============================================================================
\echo '--- TABLE: employee_telegram_group ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'employee_telegram_group'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: job
-- ============================================================================
\echo '--- TABLE: job ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'job'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: job_status
-- ============================================================================
\echo '--- TABLE: job_status ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'job_status'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: estimate
-- ============================================================================
\echo '--- TABLE: estimate ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'estimate'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: estimate_status
-- ============================================================================
\echo '--- TABLE: estimate_status ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'estimate_status'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- TABLA: inspection_report
-- ============================================================================
\echo '--- TABLE: inspection_report ---'
SELECT 
    column_name,
    data_type,
    character_maximum_length,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'botzilla' 
AND table_name = 'inspection_report'
ORDER BY ordinal_position;

\echo ''

-- ============================================================================
-- SECCIÓN 3: ÍNDICES
-- ============================================================================

\echo '============================================================================'
\echo 'TODOS LOS ÍNDICES'
\echo '============================================================================'

SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'botzilla'
ORDER BY tablename, indexname;

\echo ''

-- ============================================================================
-- SECCIÓN 4: FOREIGN KEYS
-- ============================================================================

\echo '============================================================================'
\echo 'TODAS LAS FOREIGN KEYS'
\echo '============================================================================'

SELECT
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_schema = 'botzilla'
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- SECCIÓN 5: UNIQUE CONSTRAINTS
-- ============================================================================

\echo '============================================================================'
\echo 'TODOS LOS UNIQUE CONSTRAINTS'
\echo '============================================================================'

SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema = 'botzilla'
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- SECCIÓN 6: PRIMARY KEYS
-- ============================================================================

\echo '============================================================================'
\echo 'TODAS LAS PRIMARY KEYS'
\echo '============================================================================'

SELECT
    tc.table_name,
    kcu.column_name,
    tc.constraint_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
AND tc.table_schema = 'botzilla'
ORDER BY tc.table_name;

\echo ''
\echo '============================================================================'
\echo 'FIN DEL REPORTE'
\echo '============================================================================'

