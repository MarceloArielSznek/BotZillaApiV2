-- =====================================================
-- Migration: Add in_payload column to job table
-- Date: 2025-10-27
-- Description: Adds boolean column to track if job is in PayLoad system
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add in_payload column to job table
-- =====================================================

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS in_payload BOOLEAN DEFAULT false NOT NULL;

-- Add comment
COMMENT ON COLUMN botzilla.job.in_payload IS 'Indicates if job is in PayLoad external system. Can be toggled by user.';

-- Add index for filtering (performance optimization)
CREATE INDEX IF NOT EXISTS idx_job_in_payload ON botzilla.job(in_payload);

-- =====================================================
-- 2. Verify the changes
-- =====================================================

-- Check if column exists
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'botzilla'
        AND table_name = 'job'
        AND column_name = 'in_payload'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✅ Column job.in_payload exists';
    ELSE
        RAISE EXCEPTION '❌ Column job.in_payload does NOT exist';
    END IF;
END $$;

-- Check if index exists
DO $$
DECLARE
    index_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE schemaname = 'botzilla' 
        AND tablename = 'job' 
        AND indexname = 'idx_job_in_payload'
    ) INTO index_exists;
    
    IF index_exists THEN
        RAISE NOTICE '✅ Index idx_job_in_payload exists';
    ELSE
        RAISE EXCEPTION '❌ Index idx_job_in_payload does NOT exist';
    END IF;
END $$;

-- Display summary
SELECT 
    'in_payload column added' as status,
    COUNT(*) as total_jobs,
    SUM(CASE WHEN in_payload = true THEN 1 ELSE 0 END) as jobs_in_payload,
    SUM(CASE WHEN in_payload = false THEN 1 ELSE 0 END) as jobs_not_in_payload
FROM botzilla.job;

COMMIT;

-- =====================================================
-- Migration Successful
-- =====================================================

SELECT '
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║          ✅ IN_PAYLOAD COLUMN MIGRATION COMPLETED ✅         ║
║                                                              ║
║  Modified Tables:                                            ║
║  - botzilla.job (added in_payload BOOLEAN column)            ║
║                                                              ║
║  Default Value: false (all existing jobs)                    ║
║  Index: idx_job_in_payload (for filtering performance)       ║
║                                                              ║
║  Frontend Changes Needed:                                    ║
║  - Add "In Payload" column to Jobs List                      ║
║  - Add filter dropdown for in_payload                        ║
║  - Add toggle in table row (checkbox/switch)                 ║
║  - Add checkbox in Job Edit modal                            ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
' as migration_status;

-- =====================================================
-- Rollback Script (if needed)
-- =====================================================

/*
-- To rollback this migration:

BEGIN;

DROP INDEX IF EXISTS botzilla.idx_job_in_payload;
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS in_payload;

COMMIT;

-- Verify rollback
SELECT 
    'Rollback completed' as status,
    NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'job' AND column_name = 'in_payload') as column_removed;
*/

