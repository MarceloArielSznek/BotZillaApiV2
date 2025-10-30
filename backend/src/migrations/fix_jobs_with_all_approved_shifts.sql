-- =====================================================
-- MIGRATION: Fix jobs with all shifts approved but wrong status
-- Date: 2025-10-30
-- Description: Updates jobs to "Closed Job" status when all their
--              shifts are approved but the job status is not "Closed Job"
-- =====================================================

-- 1. Preview: Jobs that will be affected
SELECT 
    j.id,
    j.name,
    b.name as branch_name,
    js.name as current_status,
    j.closing_date,
    COUNT(DISTINCT s.crew_member_id) as regular_shifts_count,
    COUNT(DISTINCT CASE WHEN s.approved_shift = false THEN s.crew_member_id END) as pending_regular_shifts,
    COUNT(DISTINCT jss.id) as special_shifts_count,
    COUNT(DISTINCT CASE WHEN jss.approved_shift = false THEN jss.id END) as pending_special_shifts
FROM botzilla.job j
LEFT JOIN botzilla.branch b ON j.branch_id = b.id
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
LEFT JOIN botzilla.shift s ON j.id = s.job_id
LEFT JOIN botzilla.job_special_shift jss ON j.id = jss.job_id
WHERE js.name != 'Closed Job' -- No está en "Closed Job"
AND j.status_id IS NOT NULL   -- Tiene un status válido
GROUP BY j.id, j.name, b.name, js.name, j.closing_date
HAVING 
    COUNT(DISTINCT s.crew_member_id) > 0 -- Tiene shifts
    AND COUNT(DISTINCT CASE WHEN s.approved_shift = false THEN s.crew_member_id END) = 0 -- No tiene shifts pendientes
    AND COUNT(DISTINCT CASE WHEN jss.approved_shift = false THEN jss.id END) = 0 -- No tiene special shifts pendientes
ORDER BY j.id DESC;

-- 2. Update jobs to "Closed Job" status
DO $$ 
DECLARE
    closed_job_status_id INTEGER;
    updated_count INTEGER;
BEGIN
    -- Get "Closed Job" status ID
    SELECT id INTO closed_job_status_id
    FROM botzilla.job_status
    WHERE name = 'Closed Job'
    LIMIT 1;
    
    IF closed_job_status_id IS NOT NULL THEN
        -- Update jobs with all shifts approved to "Closed Job"
        WITH jobs_to_update AS (
            SELECT DISTINCT j.id
            FROM botzilla.job j
            LEFT JOIN botzilla.job_status js ON j.status_id = js.id
            LEFT JOIN botzilla.shift s ON j.id = s.job_id
            LEFT JOIN botzilla.job_special_shift jss ON j.id = jss.job_id
            WHERE js.name != 'Closed Job'
            AND j.status_id IS NOT NULL
            GROUP BY j.id, js.name
            HAVING 
                COUNT(DISTINCT s.crew_member_id) > 0
                AND COUNT(DISTINCT CASE WHEN s.approved_shift = false THEN s.crew_member_id END) = 0
                AND COUNT(DISTINCT CASE WHEN jss.approved_shift = false THEN jss.id END) = 0
        ),
        updated AS (
            UPDATE botzilla.job
            SET 
                status_id = closed_job_status_id,
                closing_date = COALESCE(closing_date, CURRENT_TIMESTAMP)
            WHERE id IN (SELECT id FROM jobs_to_update)
            RETURNING id, name
        )
        SELECT COUNT(*) INTO updated_count FROM updated;
        
        RAISE NOTICE '✅ Updated % jobs with all shifts approved to "Closed Job" status', updated_count;
        
        -- Log the updated jobs
        FOR job_record IN 
            SELECT j.id, j.name 
            FROM botzilla.job j
            WHERE j.status_id = closed_job_status_id
            AND j.id IN (SELECT id FROM jobs_to_update)
            LIMIT 10
        LOOP
            RAISE NOTICE '  - Job ID %, Name: %', job_record.id, job_record.name;
        END LOOP;
        
    ELSE
        RAISE WARNING '❌ Status "Closed Job" not found in database';
    END IF;
END $$;

-- 3. Verify the update
SELECT 
    js.name as status_name,
    COUNT(j.id) as job_count
FROM botzilla.job j
LEFT JOIN botzilla.job_status js ON j.status_id = js.id
WHERE j.id IN (
    SELECT DISTINCT j2.id
    FROM botzilla.job j2
    LEFT JOIN botzilla.shift s ON j2.id = s.job_id
    GROUP BY j2.id
    HAVING COUNT(DISTINCT s.crew_member_id) > 0
)
GROUP BY js.name
ORDER BY job_count DESC;


