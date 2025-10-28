-- =====================================================
-- Migration: Remove 'Done' status and use only 'Closed Job'
-- Date: 2025-10-28
-- Description: Eliminates 'Done' status from job_status table and migrates all jobs using it to 'Closed Job'
-- =====================================================

BEGIN;

SET search_path TO botzilla;

-- =====================================================
-- 1. Verify 'Closed Job' status exists
-- =====================================================

DO $$
DECLARE
    closed_job_id INTEGER;
    done_id INTEGER;
BEGIN
    -- Get 'Closed Job' ID
    SELECT id INTO closed_job_id FROM botzilla.job_status WHERE name = 'Closed Job';
    
    -- If 'Closed Job' doesn't exist, create it
    IF closed_job_id IS NULL THEN
        INSERT INTO botzilla.job_status (name) VALUES ('Closed Job')
        ON CONFLICT (name) DO NOTHING
        RETURNING id INTO closed_job_id;
        RAISE NOTICE '✅ Created "Closed Job" status (ID: %)', closed_job_id;
    ELSE
        RAISE NOTICE '✅ "Closed Job" status already exists (ID: %)', closed_job_id;
    END IF;
    
    -- Get 'Done' ID
    SELECT id INTO done_id FROM botzilla.job_status WHERE name = 'Done';
    
    IF done_id IS NOT NULL THEN
        RAISE NOTICE '⚠️  Found "Done" status (ID: %) - will be migrated', done_id;
    ELSE
        RAISE NOTICE 'ℹ️  No "Done" status found in database';
    END IF;
END $$;

-- =====================================================
-- 2. Migrate all jobs with 'Done' status to 'Closed Job'
-- =====================================================

DO $$
DECLARE
    closed_job_id INTEGER;
    done_id INTEGER;
    jobs_updated INTEGER;
BEGIN
    -- Get IDs
    SELECT id INTO closed_job_id FROM botzilla.job_status WHERE name = 'Closed Job';
    SELECT id INTO done_id FROM botzilla.job_status WHERE name = 'Done';
    
    IF done_id IS NOT NULL THEN
        -- Update jobs with status_id = 'Done' to 'Closed Job'
        UPDATE botzilla.job
        SET status_id = closed_job_id
        WHERE status_id = done_id;
        
        GET DIAGNOSTICS jobs_updated = ROW_COUNT;
        RAISE NOTICE '✅ Migrated % jobs from "Done" to "Closed Job"', jobs_updated;
        
        -- Update jobs with last_known_status_id = 'Done' to 'Closed Job'
        UPDATE botzilla.job
        SET last_known_status_id = closed_job_id
        WHERE last_known_status_id = done_id;
        
        GET DIAGNOSTICS jobs_updated = ROW_COUNT;
        RAISE NOTICE '✅ Updated % jobs last_known_status_id from "Done" to "Closed Job"', jobs_updated;
    ELSE
        RAISE NOTICE 'ℹ️  No jobs to migrate (Done status does not exist)';
    END IF;
END $$;

-- =====================================================
-- 3. Remove 'Done' status from job_status table
-- =====================================================

DO $$
DECLARE
    done_id INTEGER;
    jobs_with_done_status INTEGER;
BEGIN
    SELECT id INTO done_id FROM botzilla.job_status WHERE name = 'Done';
    
    IF done_id IS NOT NULL THEN
        -- Verify no jobs still reference 'Done' (safety check)
        SELECT COUNT(*) INTO jobs_with_done_status
        FROM botzilla.job
        WHERE status_id = done_id OR last_known_status_id = done_id;
        
        IF jobs_with_done_status > 0 THEN
            RAISE EXCEPTION '❌ Cannot delete "Done" status: % jobs still reference it', jobs_with_done_status;
        END IF;
        
        -- Delete 'Done' status
        DELETE FROM botzilla.job_status WHERE name = 'Done';
        RAISE NOTICE '✅ Deleted "Done" status from job_status table';
    ELSE
        RAISE NOTICE 'ℹ️  "Done" status already removed';
    END IF;
END $$;

-- =====================================================
-- 4. Verification
-- =====================================================

DO $$
DECLARE
    closed_job_id INTEGER;
    done_id INTEGER;
    jobs_with_closed_job INTEGER;
BEGIN
    -- Verify 'Closed Job' exists
    SELECT id INTO closed_job_id FROM botzilla.job_status WHERE name = 'Closed Job';
    IF closed_job_id IS NULL THEN
        RAISE EXCEPTION '❌ "Closed Job" status does not exist!';
    END IF;
    
    -- Verify 'Done' is gone
    SELECT id INTO done_id FROM botzilla.job_status WHERE name = 'Done';
    IF done_id IS NOT NULL THEN
        RAISE EXCEPTION '❌ "Done" status still exists!';
    END IF;
    
    -- Count jobs with 'Closed Job'
    SELECT COUNT(*) INTO jobs_with_closed_job
    FROM botzilla.job
    WHERE status_id = closed_job_id;
    
    RAISE NOTICE '✅ Verification passed: Closed Job exists, Done is removed';
    RAISE NOTICE 'ℹ️  Total jobs with "Closed Job" status: %', jobs_with_closed_job;
END $$;

COMMIT;

-- =====================================================
-- Migration Summary
-- =====================================================

SELECT '
╔══════════════════════════════════════════════════════════════╗
║                                                              ║
║        ✅ DONE STATUS REMOVED - CLOSED JOB ONLY ✅           ║
║                                                              ║
║  Changes:                                                    ║
║  - All jobs with "Done" status migrated to "Closed Job"      ║
║  - "Done" status removed from job_status table               ║
║  - Only "Closed Job" should be used for completed jobs       ║
║                                                              ║
║  Code Changes Needed:                                        ║
║  - Update performance.controller.js to use "Closed Job"      ║
║  - Remove "Done" from validStatuses array                    ║
║  - Update any hardcoded "Done" references                    ║
║                                                              ║
╚══════════════════════════════════════════════════════════════╝
' as migration_status;

-- Display current job_status table
SELECT 'Current job_status table:' as info;
SELECT id, name FROM botzilla.job_status ORDER BY id;

-- =====================================================
-- Rollback Script (if needed)
-- =====================================================

/*
-- To rollback this migration (NOT RECOMMENDED):

BEGIN;

-- Recreate 'Done' status
INSERT INTO botzilla.job_status (name) VALUES ('Done')
ON CONFLICT (name) DO NOTHING;

-- Optionally revert some jobs back to 'Done' (manual decision required)
-- UPDATE botzilla.job
-- SET status_id = (SELECT id FROM botzilla.job_status WHERE name = 'Done')
-- WHERE status_id = (SELECT id FROM botzilla.job_status WHERE name = 'Closed Job')
-- AND closing_date >= '2025-10-28'; -- Example condition

COMMIT;
*/

