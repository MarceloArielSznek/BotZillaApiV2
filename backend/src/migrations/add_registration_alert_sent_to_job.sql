-- ============================================================================
-- Migration: Add registration_alert_sent to job table
-- Description: Prevent spam of registration alerts to crew leaders
-- Created: 2025-10-28
-- ============================================================================

BEGIN;

-- ============================================================================
-- STEP 1: Add registration_alert_sent column
-- ============================================================================

ALTER TABLE botzilla.job 
ADD COLUMN IF NOT EXISTS registration_alert_sent BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN botzilla.job.registration_alert_sent IS 
'Indicates if a Make.com registration alert webhook has been sent for this job. 
Prevents spamming crew leaders with daily alerts. 
Reset to false when crew leader changes or completes registration.';

-- ============================================================================
-- STEP 2: Add index for performance
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_job_registration_alert_sent 
ON botzilla.job(registration_alert_sent);

-- ============================================================================
-- STEP 3: Initialize existing jobs
-- ============================================================================

-- Set to false for all existing jobs (fresh start)
UPDATE botzilla.job
SET registration_alert_sent = false
WHERE registration_alert_sent IS NULL;

-- ============================================================================
-- VERIFICATION
-- ============================================================================

DO $$
DECLARE
    col_exists BOOLEAN;
    idx_exists BOOLEAN;
BEGIN
    -- Check column exists
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'botzilla' 
          AND table_name = 'job' 
          AND column_name = 'registration_alert_sent'
    ) INTO col_exists;
    
    -- Check index exists
    SELECT EXISTS (
        SELECT 1 
        FROM pg_indexes 
        WHERE schemaname = 'botzilla' 
          AND tablename = 'job' 
          AND indexname = 'idx_job_registration_alert_sent'
    ) INTO idx_exists;
    
    IF col_exists AND idx_exists THEN
        RAISE NOTICE '✅ Migration completed successfully!';
        RAISE NOTICE '✅ Column registration_alert_sent added to job table';
        RAISE NOTICE '✅ Index idx_job_registration_alert_sent created';
    ELSE
        RAISE EXCEPTION '❌ Migration failed - column or index missing';
    END IF;
END $$;

COMMIT;

-- ============================================================================
-- ROLLBACK (if needed)
-- ============================================================================
-- DROP INDEX IF EXISTS botzilla.idx_job_registration_alert_sent;
-- ALTER TABLE botzilla.job DROP COLUMN IF EXISTS registration_alert_sent;

