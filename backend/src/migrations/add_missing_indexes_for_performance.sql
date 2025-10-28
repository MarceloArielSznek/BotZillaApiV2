-- ============================================================================
-- Migration: Add Missing Indexes for Performance and Delete Operations
-- Description: Add indexes to improve job deletion and query performance
-- Created: 2025-10-28
-- ============================================================================

BEGIN;

-- ============================================================================
-- PASO 1: Índices para shift (mejora DELETE performance)
-- ============================================================================

-- Índice en shift.job_id (si no existe) para acelerar DELETE cascades
CREATE INDEX IF NOT EXISTS idx_shift_job_id 
ON botzilla.shift(job_id);

-- Índice en shift.employee_id (para queries de crew members)
CREATE INDEX IF NOT EXISTS idx_shift_employee_id 
ON botzilla.shift(employee_id);

-- Índice en shift.date (para filtros por fecha)
CREATE INDEX IF NOT EXISTS idx_shift_date 
ON botzilla.shift(date);

-- ============================================================================
-- PASO 2: Índices para job_special_shift (mejora DELETE performance)
-- ============================================================================

-- Índice en job_special_shift.job_id (si no existe)
CREATE INDEX IF NOT EXISTS idx_job_special_shift_job_id 
ON botzilla.job_special_shift(job_id);

-- Índice en job_special_shift.special_shift_id
CREATE INDEX IF NOT EXISTS idx_job_special_shift_special_shift_id 
ON botzilla.job_special_shift(special_shift_id);

-- Índice en job_special_shift.date
CREATE INDEX IF NOT EXISTS idx_job_special_shift_date 
ON botzilla.job_special_shift(date);

-- ============================================================================
-- PASO 3: Índices para job (mejora queries generales)
-- ============================================================================

-- Índice en job.performance_status (para filtrar pending_approval)
CREATE INDEX IF NOT EXISTS idx_job_performance_status 
ON botzilla.job(performance_status);

-- Índice en job.closing_date (para filtros por fecha)
CREATE INDEX IF NOT EXISTS idx_job_closing_date 
ON botzilla.job(closing_date);

-- Índice en job.in_payload (para filtro de Payload)
CREATE INDEX IF NOT EXISTS idx_job_in_payload 
ON botzilla.job(in_payload);

-- ============================================================================
-- PASO 4: Índices para overrun_report
-- ============================================================================

-- Índice en job.overrun_report_id (si hay FK)
CREATE INDEX IF NOT EXISTS idx_job_overrun_report_id 
ON botzilla.job(overrun_report_id);

-- ============================================================================
-- PASO 5: Índices para performance_sync_jobs (mejora queries de matching)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_performance_sync_jobs_sync_id 
ON botzilla.performance_sync_jobs(sync_id);

CREATE INDEX IF NOT EXISTS idx_performance_sync_jobs_branch 
ON botzilla.performance_sync_jobs(branch);

-- ============================================================================
-- PASO 6: Verificar índices creados
-- ============================================================================

DO $$
DECLARE
    idx_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO idx_count
    FROM pg_indexes
    WHERE schemaname = 'botzilla'
    AND (
        indexname LIKE 'idx_shift_%' OR
        indexname LIKE 'idx_job_special_shift_%' OR
        indexname LIKE 'idx_job_performance_%' OR
        indexname LIKE 'idx_job_closing_%' OR
        indexname LIKE 'idx_job_in_payload%' OR
        indexname LIKE 'idx_job_overrun_%' OR
        indexname LIKE 'idx_performance_sync_%'
    );
    
    RAISE NOTICE '✅ Total de índices de rendimiento creados/verificados: %', idx_count;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (si es necesario)
-- ============================================================================
-- DROP INDEX IF EXISTS botzilla.idx_shift_job_id;
-- DROP INDEX IF EXISTS botzilla.idx_shift_employee_id;
-- DROP INDEX IF EXISTS botzilla.idx_shift_date;
-- DROP INDEX IF EXISTS botzilla.idx_job_special_shift_job_id;
-- DROP INDEX IF EXISTS botzilla.idx_job_special_shift_special_shift_id;
-- DROP INDEX IF EXISTS botzilla.idx_job_special_shift_date;
-- DROP INDEX IF EXISTS botzilla.idx_job_performance_status;
-- DROP INDEX IF EXISTS botzilla.idx_job_closing_date;
-- DROP INDEX IF EXISTS botzilla.idx_job_in_payload;
-- DROP INDEX IF EXISTS botzilla.idx_job_overrun_report_id;
-- DROP INDEX IF EXISTS botzilla.idx_performance_sync_jobs_sync_id;
-- DROP INDEX IF EXISTS botzilla.idx_performance_sync_jobs_branch;

