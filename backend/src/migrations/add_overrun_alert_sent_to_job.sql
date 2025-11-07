-- =====================================================
-- Migration: Add overrun_alert_sent column to job table
-- Date: 2025-11-05
-- Description: Adds boolean column to track if automatic overrun alert has been sent
-- =====================================================

BEGIN;

-- =====================================================
-- 1. Add overrun_alert_sent column to job table
-- =====================================================

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS overrun_alert_sent BOOLEAN DEFAULT false NOT NULL;

-- Add comment
COMMENT ON COLUMN botzilla.job.overrun_alert_sent IS 'Indicates if automatic overrun alert has been sent when job was approved. User can manually send additional alerts.';

-- Add index for filtering (performance optimization)
CREATE INDEX IF NOT EXISTS idx_job_overrun_alert_sent ON botzilla.job(overrun_alert_sent);

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
        AND column_name = 'overrun_alert_sent'
    ) INTO column_exists;
    
    IF column_exists THEN
        RAISE NOTICE '✅ Column job.overrun_alert_sent exists';
    ELSE
        RAISE EXCEPTION '❌ Column job.overrun_alert_sent does NOT exist';
    END IF;
END $$;

COMMIT;

-- =====================================================
-- Rollback (si es necesario):
-- =====================================================
-- BEGIN;
-- DROP INDEX IF EXISTS botzilla.idx_job_overrun_alert_sent;
-- ALTER TABLE botzilla.job DROP COLUMN IF EXISTS overrun_alert_sent;
-- COMMIT;

