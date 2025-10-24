-- ============================================================================
-- SCRIPT DE VERIFICACIÓN DE SCHEMA DE BASE DE DATOS
-- BotZilla V2 - Production Schema Validation
-- ============================================================================
-- Descripción: Este script verifica que la estructura de la base de datos
--              en producción coincida con la estructura esperada de desarrollo
-- Fecha: 2025-10-14
-- Autor: BotZilla Dev Team
-- ============================================================================

\echo '============================================================================'
\echo 'VERIFICACIÓN DE SCHEMA - BOTZILLA DATABASE'
\echo '============================================================================'
\echo ''

-- ============================================================================
-- SECCIÓN 1: VERIFICAR TABLAS PRINCIPALES
-- ============================================================================

\echo '1. VERIFICANDO EXISTENCIA DE TABLAS PRINCIPALES...'
\echo '---------------------------------------------------'

SELECT 
    expected_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'botzilla' 
            AND table_name = expected_table
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('user'),
    ('user_rol'),
    ('user_branch'),
    ('branch'),
    ('employee'),
    ('crew_member'),
    ('crew_member_branch'),
    ('sales_person'),
    ('sales_person_branch'),
    ('telegram_group'),
    ('telegram_group_category'),
    ('employee_telegram_group'),
    ('job'),
    ('job_status'),
    ('estimate'),
    ('estimate_status'),
    ('inspection_report')
) AS expected(expected_table)
ORDER BY expected_table;

\echo ''

-- ============================================================================
-- SECCIÓN 2: VERIFICAR COLUMNAS CRÍTICAS EN EMPLOYEE
-- ============================================================================

\echo '2. VERIFICANDO COLUMNAS EN TABLA EMPLOYEE...'
\echo '---------------------------------------------------'

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default,
    CASE 
        WHEN column_name IN ('id', 'first_name', 'last_name', 'email', 'role', 'status', 
                             'branch_id', 'telegram_id', 'phone', 'registration_date', 
                             'approved_date', 'approved_by', 'attic_tech_user_id', 
                             'address', 'date_of_birth', 'notes')
        THEN '✅ EXPECTED'
        ELSE '⚠️  EXTRA'
    END as validation
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'employee'
ORDER BY ordinal_position;

-- Verificar columnas específicas requeridas
SELECT 
    expected_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'employee' 
            AND column_name = expected_column
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('id'),
    ('first_name'),
    ('last_name'),
    ('email'),
    ('role'),
    ('status'),
    ('branch_id'),
    ('telegram_id'),
    ('phone'),
    ('attic_tech_user_id'),
    ('registration_date'),
    ('approved_date'),
    ('approved_by')
) AS expected(expected_column)
ORDER BY expected_column;

\echo ''

-- ============================================================================
-- SECCIÓN 3: VERIFICAR COLUMNAS CRÍTICAS EN JOB
-- ============================================================================

\echo '3. VERIFICANDO COLUMNAS EN TABLA JOB...'
\echo '---------------------------------------------------'

SELECT 
    column_name,
    data_type,
    is_nullable,
    CASE 
        WHEN column_name IN ('id', 'name', 'status_id', 'crew_leader_id', 'branch_id', 
                             'estimate_id', 'closing_date', 'notification_sent',
                             'attic_tech_job_id', 'attic_tech_estimate_id', 
                             'last_known_status_id', 'last_synced_at', 
                             'last_notification_sent_at')
        THEN '✅ EXPECTED'
        ELSE '⚠️  EXTRA'
    END as validation
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job'
ORDER BY ordinal_position;

-- Verificar columnas específicas requeridas para JOB SYNC
SELECT 
    expected_column,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'botzilla' 
            AND table_name = 'job' 
            AND column_name = expected_column
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('id'),
    ('name'),
    ('status_id'),
    ('crew_leader_id'),
    ('branch_id'),
    ('estimate_id'),
    ('closing_date'),
    ('notification_sent'),
    ('attic_tech_job_id'),
    ('attic_tech_estimate_id'),
    ('last_known_status_id'),
    ('last_synced_at'),
    ('last_notification_sent_at')
) AS expected(expected_column)
ORDER BY expected_column;

\echo ''

-- ============================================================================
-- SECCIÓN 4: VERIFICAR ÍNDICES CRÍTICOS
-- ============================================================================

\echo '4. VERIFICANDO ÍNDICES CRÍTICOS...'
\echo '---------------------------------------------------'

SELECT 
    expected_index,
    expected_table,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE schemaname = 'botzilla' 
            AND indexname = expected_index
        ) THEN '✅ EXISTS'
        ELSE '❌ MISSING'
    END as status
FROM (VALUES 
    ('idx_employee_attic_tech_user_id', 'employee'),
    ('idx_job_attic_tech_job_id', 'job'),
    ('idx_job_attic_tech_estimate_id', 'job'),
    ('idx_job_last_synced_at', 'job'),
    ('idx_job_last_known_status_id', 'job'),
    ('idx_job_notification_sent', 'job')
) AS expected(expected_index, expected_table)
ORDER BY expected_index;

\echo ''

-- ============================================================================
-- SECCIÓN 5: VERIFICAR FOREIGN KEYS CRÍTICAS
-- ============================================================================

\echo '5. VERIFICANDO FOREIGN KEYS CRÍTICAS...'
\echo '---------------------------------------------------'

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name,
    '✅ EXISTS' as status
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
AND tc.table_schema = 'botzilla'
AND tc.table_name IN ('employee', 'job', 'crew_member', 'sales_person')
ORDER BY tc.table_name, tc.constraint_name;

\echo ''

-- ============================================================================
-- SECCIÓN 6: VERIFICAR USER_ROL (Roles de Usuario)
-- ============================================================================

\echo '6. VERIFICANDO ROLES DE USUARIO...'
\echo '---------------------------------------------------'

SELECT 
    id,
    name,
    CASE 
        WHEN name IN ('admin', 'user', 'office_manager', 'operation manager')
        THEN '✅ EXPECTED'
        ELSE '⚠️  EXTRA'
    END as validation
FROM botzilla.user_rol
ORDER BY name;

-- Verificar rol específico 'operation manager'
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM botzilla.user_rol WHERE name = 'operation manager')
        THEN '✅ PASS: Role "operation manager" exists'
        ELSE '❌ FAIL: Role "operation manager" is MISSING'
    END as validation;

\echo ''

-- ============================================================================
-- SECCIÓN 7: VERIFICAR JOB_STATUS (Estados de Job)
-- ============================================================================

\echo '7. VERIFICANDO ESTADOS DE JOB...'
\echo '---------------------------------------------------'

SELECT 
    id,
    name,
    CASE 
        WHEN name IN ('Requires Scheduling', 'Requires Crew Lead', 'Plans In Progress',
                      'In Production', 'Production Complete', 'Closed Job',
                      'Cancelled', 'On Hold', 'Pending Review')
        THEN '✅ EXPECTED'
        ELSE '⚠️  EXTRA'
    END as validation
FROM botzilla.job_status
ORDER BY name;

-- Verificar cantidad mínima de estados
SELECT 
    COUNT(*) as total_statuses,
    CASE 
        WHEN COUNT(*) >= 9 THEN '✅ PASS: All 9 required statuses present'
        ELSE '❌ FAIL: Missing job statuses'
    END as validation
FROM botzilla.job_status;

\echo ''

-- ============================================================================
-- SECCIÓN 8: VERIFICAR CONSTRAINTS UNIQUE
-- ============================================================================

\echo '8. VERIFICANDO CONSTRAINTS UNIQUE...'
\echo '---------------------------------------------------'

SELECT 
    tc.table_name,
    tc.constraint_name,
    kcu.column_name,
    '✅ EXISTS' as status
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'UNIQUE'
AND tc.table_schema = 'botzilla'
AND tc.table_name IN ('employee', 'job', 'user')
AND kcu.column_name IN ('email', 'attic_tech_user_id', 'attic_tech_job_id')
ORDER BY tc.table_name, kcu.column_name;

\echo ''

-- ============================================================================
-- SECCIÓN 9: VERIFICAR TIPOS DE DATOS CRÍTICOS
-- ============================================================================

\echo '9. VERIFICANDO TIPOS DE DATOS CRÍTICOS...'
\echo '---------------------------------------------------'

SELECT 
    table_name,
    column_name,
    data_type,
    CASE 
        WHEN (table_name = 'employee' AND column_name = 'attic_tech_user_id' AND data_type = 'integer')
        THEN '✅ CORRECT'
        WHEN (table_name = 'job' AND column_name = 'attic_tech_job_id' AND data_type = 'integer')
        THEN '✅ CORRECT'
        WHEN (table_name = 'job' AND column_name = 'last_synced_at' AND data_type = 'timestamp without time zone')
        THEN '✅ CORRECT'
        WHEN (table_name = 'job' AND column_name = 'notification_sent' AND data_type = 'boolean')
        THEN '✅ CORRECT'
        ELSE '⚠️  CHECK'
    END as validation
FROM information_schema.columns
WHERE table_schema = 'botzilla'
AND (
    (table_name = 'employee' AND column_name = 'attic_tech_user_id') OR
    (table_name = 'job' AND column_name IN ('attic_tech_job_id', 'attic_tech_estimate_id', 
                                             'last_known_status_id', 'last_synced_at', 
                                             'last_notification_sent_at', 'notification_sent'))
)
ORDER BY table_name, column_name;

\echo ''

-- ============================================================================
-- SECCIÓN 10: ESTADÍSTICAS GENERALES
-- ============================================================================

\echo '10. ESTADÍSTICAS GENERALES DE LA BASE DE DATOS...'
\echo '---------------------------------------------------'

-- Total de tablas en schema botzilla
SELECT 
    'Total Tables' as metric,
    COUNT(*) as value
FROM information_schema.tables
WHERE table_schema = 'botzilla'
AND table_type = 'BASE TABLE';

-- Total de índices
SELECT 
    'Total Indexes' as metric,
    COUNT(*) as value
FROM pg_indexes
WHERE schemaname = 'botzilla';

-- Total de foreign keys
SELECT 
    'Total Foreign Keys' as metric,
    COUNT(*) as value
FROM information_schema.table_constraints
WHERE constraint_type = 'FOREIGN KEY'
AND table_schema = 'botzilla';

-- Total de unique constraints
SELECT 
    'Total Unique Constraints' as metric,
    COUNT(*) as value
FROM information_schema.table_constraints
WHERE constraint_type = 'UNIQUE'
AND table_schema = 'botzilla';

\echo ''

-- ============================================================================
-- SECCIÓN 11: DATOS DE MUESTRA (VERIFICACIÓN DE INTEGRIDAD)
-- ============================================================================

\echo '11. VERIFICACIÓN DE INTEGRIDAD DE DATOS...'
\echo '---------------------------------------------------'

-- Employees
SELECT 
    'Employees (Total)' as metric,
    COUNT(*) as count
FROM botzilla.employee;

SELECT 
    'Employees (with AT ID)' as metric,
    COUNT(*) as count
FROM botzilla.employee
WHERE attic_tech_user_id IS NOT NULL;

-- Jobs
SELECT 
    'Jobs (Total)' as metric,
    COUNT(*) as count
FROM botzilla.job;

SELECT 
    'Jobs (synced from AT)' as metric,
    COUNT(*) as count
FROM botzilla.job
WHERE attic_tech_job_id IS NOT NULL;

-- Crew Members
SELECT 
    'Crew Members (Total)' as metric,
    COUNT(*) as count
FROM botzilla.crew_member;

SELECT 
    'Crew Members (linked to employee)' as metric,
    COUNT(*) as count
FROM botzilla.crew_member
WHERE employee_id IS NOT NULL;

-- Sales Persons
SELECT 
    'Sales Persons (Total)' as metric,
    COUNT(*) as count
FROM botzilla.sales_person;

SELECT 
    'Sales Persons (linked to employee)' as metric,
    COUNT(*) as count
FROM botzilla.sales_person
WHERE employee_id IS NOT NULL;

\echo ''

-- ============================================================================
-- SECCIÓN 12: RESUMEN FINAL
-- ============================================================================

\echo '============================================================================'
\echo 'RESUMEN DE VERIFICACIÓN'
\echo '============================================================================'

SELECT 
    'Schema Verification' as check_name,
    CASE 
        WHEN 
            -- Verificar tablas críticas
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'botzilla' AND table_name = 'employee') AND
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'botzilla' AND table_name = 'job') AND
            -- Verificar columnas de employee
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'employee' AND column_name = 'attic_tech_user_id') AND
            -- Verificar columnas de job
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'job' AND column_name = 'attic_tech_job_id') AND
            EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'job' AND column_name = 'last_synced_at') AND
            -- Verificar rol operation manager
            EXISTS (SELECT 1 FROM botzilla.user_rol WHERE name = 'operation manager') AND
            -- Verificar cantidad de job statuses
            (SELECT COUNT(*) FROM botzilla.job_status) >= 9
        THEN '✅ PASS - Schema is correct and ready for production'
        ELSE '❌ FAIL - Schema has issues that need to be fixed'
    END as status;

\echo ''
\echo '============================================================================'
\echo 'VERIFICACIÓN COMPLETADA'
\echo '============================================================================'
\echo ''
\echo 'Si todos los checks muestran ✅, la base de datos está lista.'
\echo 'Si hay ❌, revisa los detalles arriba y ejecuta las migraciones faltantes.'
\echo ''

