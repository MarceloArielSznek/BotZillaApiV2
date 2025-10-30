-- =====================================================
-- MIGRATION: Fix jobs with NULL status_id
-- Date: 2025-10-30
-- Description: Assigns appropriate status to jobs that have NULL status_id
--              - Jobs with crew_leader_id → "In Progress"
--              - Jobs without crew_leader_id → "Requires Crew Lead"
-- =====================================================

-- 1. Check jobs with NULL status
SELECT 
    id,
    name,
    branch_id,
    crew_leader_id,
    status_id,
    closing_date
FROM botzilla.job
WHERE status_id IS NULL
ORDER BY id DESC
LIMIT 20;

-- 2. Update jobs WITH crew_leader_id to "In Progress"
DO $$ 
DECLARE
    in_progress_status_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get "In Progress" status ID
    SELECT id INTO in_progress_status_id
    FROM botzilla.job_status
    WHERE name = 'In Progress'
    LIMIT 1;
    
    IF in_progress_status_id IS NOT NULL THEN
        -- Update jobs with crew leader to "In Progress"
        WITH updated AS (
            UPDATE botzilla.job
            SET status_id = in_progress_status_id
            WHERE status_id IS NULL
            AND crew_leader_id IS NOT NULL
            RETURNING id
        )
        SELECT COUNT(*) INTO updated_count FROM updated;
        
        RAISE NOTICE '✅ Updated % jobs with crew leader to "In Progress" status', updated_count;
    ELSE
        RAISE WARNING '❌ Status "In Progress" not found in database';
    END IF;
END $$;

-- 3. Update jobs WITHOUT crew_leader_id to "Requires Crew Lead"
DO $$ 
DECLARE
    requires_cl_status_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get "Requires Crew Lead" status ID
    SELECT id INTO requires_cl_status_id
    FROM botzilla.job_status
    WHERE name = 'Requires Crew Lead'
    LIMIT 1;
    
    IF requires_cl_status_id IS NOT NULL THEN
        -- Update jobs without crew leader to "Requires Crew Lead"
        WITH updated AS (
            UPDATE botzilla.job
            SET status_id = requires_cl_status_id
            WHERE status_id IS NULL
            AND crew_leader_id IS NULL
            RETURNING id
        )
        SELECT COUNT(*) INTO updated_count FROM updated;
        
        RAISE NOTICE '✅ Updated % jobs without crew leader to "Requires Crew Lead" status', updated_count;
    ELSE
        RAISE WARNING '❌ Status "Requires Crew Lead" not found in database';
    END IF;
END $$;

-- 4. Verify no more NULL status_id jobs
SELECT 
    COUNT(*) as remaining_null_status_jobs
FROM botzilla.job
WHERE status_id IS NULL;

-- 5. Summary of job status distribution
SELECT 
    js.name as status_name,
    COUNT(j.id) as job_count
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
GROUP BY js.name
ORDER BY job_count DESC;

