-- =====================================================
-- MIGRATION: Fix duplicate special shifts
-- Date: 2025-10-30
-- Description: Fixes special shifts (QC, Job Delivery) that were duplicated
--              when the same job was synced multiple times
-- =====================================================

-- 1. Preview: Jobs with potentially duplicated special shifts
-- (QC should be 3 hours per person, Job Delivery should be 3 hours per person)
SELECT 
    j.id as job_id,
    j.name as job_name,
    b.name as branch_name,
    ss.name as shift_type,
    jss.hours,
    jss.approved_shift,
    jss.date
FROM botzilla.job_special_shift jss
JOIN botzilla.job j ON jss.job_id = j.id
JOIN botzilla.branch b ON j.branch_id = b.id
JOIN botzilla.special_shift ss ON jss.special_shift_id = ss.id
WHERE ss.name IN ('QC', 'Job Delivery')
AND jss.hours > 3
ORDER BY j.id, ss.name;

-- 2. Fix QC special shifts with more than 3 hours
-- Reset to 3 hours if it's a multiple of 3 (duplicated)
DO $$ 
DECLARE
    updated_count INTEGER := 0;
BEGIN
    WITH qc_shifts_to_fix AS (
        SELECT jss.job_id, jss.special_shift_id, jss.hours
        FROM botzilla.job_special_shift jss
        JOIN botzilla.special_shift ss ON jss.special_shift_id = ss.id
        WHERE ss.name = 'QC'
        AND jss.hours > 3
        AND MOD(jss.hours::INTEGER, 3) = 0  -- Solo si es múltiplo de 3 (duplicado)
    )
    UPDATE botzilla.job_special_shift jss
    SET hours = 3
    FROM qc_shifts_to_fix qstf
    JOIN botzilla.special_shift ss ON ss.id = qstf.special_shift_id
    WHERE jss.job_id = qstf.job_id
    AND jss.special_shift_id = qstf.special_shift_id
    AND ss.name = 'QC';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Fixed % QC special shifts (reset to 3 hours)', updated_count;
END $$;

-- 3. Fix Job Delivery special shifts with more than 3 hours
DO $$ 
DECLARE
    updated_count INTEGER := 0;
BEGIN
    WITH delivery_shifts_to_fix AS (
        SELECT jss.job_id, jss.special_shift_id, jss.hours
        FROM botzilla.job_special_shift jss
        JOIN botzilla.special_shift ss ON jss.special_shift_id = ss.id
        WHERE ss.name = 'Job Delivery'
        AND jss.hours > 3
        AND MOD(jss.hours::INTEGER, 3) = 0  -- Solo si es múltiplo de 3 (duplicado)
    )
    UPDATE botzilla.job_special_shift jss
    SET hours = 3
    FROM delivery_shifts_to_fix dstf
    JOIN botzilla.special_shift ss ON ss.id = dstf.special_shift_id
    WHERE jss.job_id = dstf.job_id
    AND jss.special_shift_id = dstf.special_shift_id
    AND ss.name = 'Job Delivery';
    
    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE '✅ Fixed % Job Delivery special shifts (reset to 3 hours)', updated_count;
END $$;

-- 4. Verify the fixes
SELECT 
    'After Fix' as status,
    ss.name as shift_type,
    COUNT(*) as total_shifts,
    MIN(jss.hours) as min_hours,
    MAX(jss.hours) as max_hours,
    AVG(jss.hours) as avg_hours
FROM botzilla.job_special_shift jss
JOIN botzilla.special_shift ss ON jss.special_shift_id = ss.id
WHERE ss.name IN ('QC', 'Job Delivery')
GROUP BY ss.name
ORDER BY ss.name;

-- 5. Show any remaining problematic special shifts (if any)
SELECT 
    j.id as job_id,
    j.name as job_name,
    ss.name as shift_type,
    jss.hours,
    jss.approved_shift
FROM botzilla.job_special_shift jss
JOIN botzilla.job j ON jss.job_id = j.id
JOIN botzilla.special_shift ss ON jss.special_shift_id = ss.id
WHERE ss.name IN ('QC', 'Job Delivery')
AND jss.hours != 3
ORDER BY j.id, ss.name;

