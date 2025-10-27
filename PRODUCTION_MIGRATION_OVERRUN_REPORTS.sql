-- =====================================================
-- PRODUCTION MIGRATION: Overrun Reports System
-- Date: October 27, 2025
-- Description: Complete migration for Overrun Reports functionality
--              Includes overrun_report table and job relation
-- =====================================================
-- Prerequisites: Performance system migrations must be applied first
-- Estimated time: < 5 seconds
-- Rollback available: Yes (see end of file)
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Create overrun_report table
-- =====================================================

CREATE TABLE IF NOT EXISTS botzilla.overrun_report (
    id SERIAL PRIMARY KEY,
    report TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comments for documentation
COMMENT ON TABLE botzilla.overrun_report IS 'Stores AI-generated investigation reports for overrun jobs';
COMMENT ON COLUMN botzilla.overrun_report.id IS 'Primary key';
COMMENT ON COLUMN botzilla.overrun_report.report IS 'Long text report with investigation details from Make.com AI';
COMMENT ON COLUMN botzilla.overrun_report.created_at IS 'Timestamp when report was created';
COMMENT ON COLUMN botzilla.overrun_report.updated_at IS 'Timestamp when report was last updated';

-- =====================================================
-- 2. Add overrun_report_id to job table
-- =====================================================

-- Add column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'job' 
        AND column_name = 'overrun_report_id'
    ) THEN
        ALTER TABLE botzilla.job ADD COLUMN overrun_report_id INTEGER;
        RAISE NOTICE 'Column overrun_report_id added to job table';
    ELSE
        RAISE NOTICE 'Column overrun_report_id already exists in job table';
    END IF;
END $$;

-- Add foreign key constraint if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_job_overrun_report'
    ) THEN
        ALTER TABLE botzilla.job
        ADD CONSTRAINT fk_job_overrun_report
        FOREIGN KEY (overrun_report_id)
        REFERENCES botzilla.overrun_report(id)
        ON DELETE SET NULL;
        RAISE NOTICE 'Foreign key constraint fk_job_overrun_report added';
    ELSE
        RAISE NOTICE 'Foreign key constraint fk_job_overrun_report already exists';
    END IF;
END $$;

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_job_overrun_report_id ON botzilla.job(overrun_report_id);

-- Add comment
COMMENT ON COLUMN botzilla.job.overrun_report_id IS 'Foreign key to overrun_report table (nullable). Links job to its overrun investigation report.';

-- =====================================================
-- 3. Verify the changes
-- =====================================================

-- Check if overrun_report table exists
DO $$
DECLARE
    table_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'botzilla' 
        AND table_name = 'overrun_report'
    ) INTO table_exists;
    
    IF table_exists THEN
        RAISE NOTICE '✅ Table botzilla.overrun_report exists';
    ELSE
        RAISE EXCEPTION '❌ Table botzilla.overrun_report does NOT exist';
    END IF;
END $$;

-- Check if overrun_report_id column exists in job table
DO $$
DECLARE
    column_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'botzilla'
        AND table_name = 'job'
        AND column_name = 'overrun_report_id'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✅ Column job.overrun_report_id exists';
    ELSE
        RAISE EXCEPTION '❌ Column job.overrun_report_id does NOT exist';
    END IF;
END $$;

-- Check if foreign key constraint exists
DO $$
DECLARE
    fk_exists BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'fk_job_overrun_report'
    ) INTO fk_exists;
    
    IF fk_exists THEN
        RAISE NOTICE '✅ Foreign key constraint fk_job_overrun_report exists';
    ELSE
        RAISE EXCEPTION '❌ Foreign key constraint fk_job_overrun_report does NOT exist';
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
        AND indexname = 'idx_job_overrun_report_id'
    ) INTO index_exists;
    
    IF index_exists THEN
        RAISE NOTICE '✅ Index idx_job_overrun_report_id exists';
    ELSE
        RAISE EXCEPTION '❌ Index idx_job_overrun_report_id does NOT exist';
    END IF;
END $$;

-- Display summary
SELECT 
    'overrun_report' as table_name,
    (SELECT COUNT(*) FROM botzilla.overrun_report) as total_reports,
    (SELECT COUNT(*) FROM botzilla.job WHERE overrun_report_id IS NOT NULL) as jobs_with_reports;

COMMIT;

-- =====================================================
-- MIGRATION SUCCESSFUL
-- =====================================================

SELECT '
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        ✅ OVERRUN REPORTS MIGRATION COMPLETED ✅             ║
║                                                              ║
║  New Tables:                                                 ║
║  - botzilla.overrun_report                                   ║
║                                                              ║
║  Modified Tables:                                            ║
║  - botzilla.job (added overrun_report_id column)             ║
║                                                              ║
║  New Endpoints:                                              ║
║  - POST /api/jobs/overrun/:id/send-alert                     ║
║  - POST /api/jobs/overrun/save-report (API key protected)    ║
║                                                              ║
║  Environment Variables Required:                             ║
║  - MAKE_OVERRUN_ALERT_WEBHOOK_URL (in backend/.env)          ║
║                                                              ║
║  Next Steps:                                                 ║
║  1. Set MAKE_OVERRUN_ALERT_WEBHOOK_URL in .env               ║
║  2. Restart backend server (pm2 restart botzilla-api)        ║
║  3. Test: Go to Overrun Jobs → Send Alert                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
' as migration_status;

-- =====================================================
-- ROLLBACK SCRIPT (Use only if needed)
-- =====================================================

/*

-- ⚠️ WARNING: This will delete ALL overrun reports and remove the relation from jobs
-- Use with caution in production!

BEGIN;

-- Remove foreign key constraint
ALTER TABLE botzilla.job DROP CONSTRAINT IF EXISTS fk_job_overrun_report;

-- Remove index
DROP INDEX IF EXISTS botzilla.idx_job_overrun_report_id;

-- Remove column from job table
ALTER TABLE botzilla.job DROP COLUMN IF EXISTS overrun_report_id;

-- Drop overrun_report table
DROP TABLE IF EXISTS botzilla.overrun_report CASCADE;

COMMIT;

-- Verify rollback
SELECT 
    'Rollback completed' as status,
    NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'botzilla' AND table_name = 'overrun_report') as table_removed,
    NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'botzilla' AND table_name = 'job' AND column_name = 'overrun_report_id') as column_removed;

*/

