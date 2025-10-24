-- =====================================================
-- POST-MIGRATION VERIFICATION SCRIPT
-- Run this after applying PRODUCTION_MIGRATION_QC_SHIFTS.sql
-- =====================================================

\echo '==========================================';
\echo 'MIGRATION VERIFICATION';
\echo '==========================================';
\echo '';

-- =====================================================
-- 1. Check new columns in job table
-- =====================================================
\echo '1. Checking job table columns...';
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job' 
AND column_name IN ('sold_price', 'performance_status')
ORDER BY column_name;

\echo '';
\echo '   Expected: sold_price (numeric, nullable), performance_status (character varying, not null, default: synced)';
\echo '';

-- =====================================================
-- 2. Verify removed columns from job table
-- =====================================================
\echo '2. Checking removed columns from job table...';
SELECT COUNT(*) as should_be_zero
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'job' 
AND column_name IN ('crew_leader_hours', 'note');

\echo '';
\echo '   Expected: 0 (both columns should be removed)';
\echo '';

-- =====================================================
-- 3. Check new columns in shift table
-- =====================================================
\echo '3. Checking shift table columns...';
SELECT 
    column_name, 
    data_type, 
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_schema = 'botzilla' 
AND table_name = 'shift' 
AND column_name IN ('employee_id', 'performance_status')
ORDER BY column_name;

\echo '';
\echo '   Expected: employee_id (integer, nullable), performance_status (character varying, not null, default: approved)';
\echo '';

-- =====================================================
-- 4. Check constraints
-- =====================================================
\echo '4. Checking performance_status constraints...';
SELECT 
    constraint_name, 
    table_name
FROM information_schema.table_constraints 
WHERE table_schema = 'botzilla' 
AND constraint_name LIKE '%performance_status%'
ORDER BY table_name, constraint_name;

\echo '';
\echo '   Expected: check_job_performance_status (job), check_shift_performance_status (shift)';
\echo '';

-- =====================================================
-- 5. Check indexes
-- =====================================================
\echo '5. Checking new indexes...';
SELECT 
    tablename,
    indexname
FROM pg_indexes
WHERE schemaname = 'botzilla'
AND (
    indexname LIKE '%performance_status%'
    OR indexname LIKE 'idx_shift_employee%'
    OR indexname LIKE 'idx_job_sold_price%'
)
ORDER BY tablename, indexname;

\echo '';
\echo '   Expected: idx_job_performance_status, idx_job_branch_performance_status, idx_shift_performance_status, idx_shift_job_performance_status, idx_shift_employee_id, idx_shift_employee_job, idx_job_sold_price';
\echo '';

-- =====================================================
-- 6. Check shift.crew_member_id FK points to employee
-- =====================================================
\echo '6. Checking shift.crew_member_id FK constraint...';
SELECT 
    tc.constraint_name, 
    tc.table_name, 
    ccu.table_name as references_table,
    ccu.column_name as references_column
FROM information_schema.table_constraints tc
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_schema = 'botzilla' 
AND tc.table_name = 'shift'
AND tc.constraint_name = 'shift_crew_member_id_fkey';

\echo '';
\echo '   Expected: shift_crew_member_id_fkey references employee(id)';
\echo '';

-- =====================================================
-- 7. Check QC Special Shift exists
-- =====================================================
\echo '7. Checking QC Special Shift...';
SELECT 
    id,
    name, 
    description
FROM botzilla.special_shift 
WHERE name = 'QC';

\echo '';
\echo '   Expected: 1 row with name = QC, description = Quality Control - 3 hours per shift';
\echo '';

-- =====================================================
-- 8. Check foreign keys on shift table
-- =====================================================
\echo '8. Checking all foreign keys on shift table...';
SELECT 
    tc.constraint_name, 
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_schema = 'botzilla'
  AND tc.table_name = 'shift'
ORDER BY tc.constraint_name;

\echo '';
\echo '   Expected: crew_member_id -> employee(id), employee_id -> employee(id), job_id -> job(id)';
\echo '';

-- =====================================================
-- 9. Sample data check (jobs with performance data)
-- =====================================================
\echo '9. Checking jobs with performance data...';
SELECT 
    COUNT(*) as jobs_with_sold_price
FROM botzilla.job 
WHERE sold_price IS NOT NULL;

SELECT 
    performance_status,
    COUNT(*) as count
FROM botzilla.job
GROUP BY performance_status
ORDER BY performance_status;

\echo '';
\echo '   Note: Performance status distribution';
\echo '';

-- =====================================================
-- 10. Sample data check (shifts)
-- =====================================================
\echo '10. Checking shifts data...';
SELECT 
    COUNT(*) as total_shifts,
    COUNT(employee_id) as shifts_with_employee_id,
    COUNT(CASE WHEN performance_status = 'pending_approval' THEN 1 END) as pending_approval,
    COUNT(CASE WHEN performance_status = 'approved' THEN 1 END) as approved,
    COUNT(CASE WHEN performance_status = 'rejected' THEN 1 END) as rejected
FROM botzilla.shift;

\echo '';
\echo '   Note: Shift status distribution';
\echo '';

-- =====================================================
-- SUMMARY
-- =====================================================
\echo '==========================================';
\echo 'VERIFICATION COMPLETE';
\echo '==========================================';
\echo '';
\echo 'Review the output above to ensure:';
\echo '  - All new columns exist with correct types';
\echo '  - All removed columns are gone';
\echo '  - All constraints and indexes are in place';
\echo '  - shift.crew_member_id FK points to employee';
\echo '  - QC Special Shift exists';
\echo '';
\echo 'If all checks pass, the migration was successful!';
\echo '';

