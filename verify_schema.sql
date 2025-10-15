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

